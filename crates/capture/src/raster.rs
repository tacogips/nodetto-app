//! Orthographic rasterization of the frontmost solid, with bounded sample storage.

use std::ops::RangeInclusive;
use std::thread;

use crate::census::{self, Liveness};
use crate::interference;
use crate::interval::{combine, Boundary, Intervals, MERGE_EPS};
use crate::overlay::{self, MarkTable, SampleBody};
use crate::report::{BodyReport, BodyState, Report};
use crate::scene::{Camera, Op, Scene};
use crate::shade::{self, Hit};
use crate::tiles::{self, SampleRect, TileLists};
use crate::tool_view::{self, ToolView};
use crate::view::{cross, dot, Ray, RayFamily};
use crate::CaptureError;

mod budget;
#[cfg(test)]
mod reference;
#[cfg(test)]
mod tests;

use budget::{ScanBudget, WorkerBudget};

const BAND_ROWS: usize = 32;
const MAX_THREADS: usize = 8;
const SCAN_ALLOWANCE: u64 = 16_000_000_000;

#[cfg_attr(not(test), allow(dead_code))]
struct RenderStats {
    reads: u64,
    workers: usize,
    liveness: Vec<Liveness>,
    census: census::CensusStats,
}

type Visibility = Vec<(bool, bool, Vec<usize>)>;

#[derive(Clone, Copy, Default)]
struct Sample {
    solid: Option<Hit>,
    translucent: Option<Hit>,
    marked: bool,
}

struct ScreenRect {
    x: RangeInclusive<f64>,
    y: RangeInclusive<f64>,
}

impl ScreenRect {
    fn new((min, max): ([f64; 3], [f64; 3]), origin: [f64; 3], camera: &Camera) -> Self {
        // Dual axes give the sample-plane coordinates even when the accepted
        // camera vectors are only orthonormal to within the reader tolerance.
        let extent = (0..3)
            .map(|axis| {
                min[axis].abs().max(max[axis].abs())
                    + origin[axis].abs()
                    + camera.centre[axis].abs()
            })
            .sum::<f64>();
        let margin = MERGE_EPS + 1e-8 * extent;
        let project = |direction: [f64; 3], dual: [f64; 3]| {
            let length = dot(direction, dual);
            let [lo, hi] = dual
                .map(|value| value / length)
                .into_iter()
                .enumerate()
                .fold([0.0, 0.0], |[lo, hi], (axis, value)| {
                    let a = value * (min[axis] - camera.centre[axis]);
                    let b = value * (max[axis] - camera.centre[axis]);
                    [lo + a.min(b), hi + a.max(b)]
                });
            lo - margin..=hi + margin
        };
        Self {
            x: project(camera.right, cross(camera.up, camera.forward)),
            y: project(camera.up, cross(camera.forward, camera.right)),
        }
    }

    fn contains(&self, [x, y]: [f64; 2]) -> bool {
        self.x.contains(&x) && self.y.contains(&y)
    }
}

struct ProjectedPrism {
    view: ToolView,
    rect: ScreenRect,
}

#[derive(Default)]
struct RayScratch {
    crossings: Vec<Boundary>,
    tool: Intervals,
    current: Intervals,
    next: Intervals,
    body_intervals: Vec<Intervals>,
    visited: Vec<u32>,
    overlaps: Vec<(u32, u32, f64, f64)>,
}

struct Raster<'a> {
    scene: &'a Scene,
    tools: Vec<Option<ProjectedPrism>>,
    weights: Vec<u64>,
    solid_tools: Vec<bool>,
    open_bodies: Vec<bool>,
    tiles: TileLists,
    light: [f64; 3],
    samples_wide: usize,
    samples_high: usize,
    factor: usize,
    step: f64,
}

impl Raster<'_> {
    fn sample(
        &self,
        position: [f64; 2],
        tile: [u32; 2],
        scratch: &mut RayScratch,
        visibility: &mut Visibility,
        marks: &mut MarkTable,
        budget: &mut WorkerBudget<'_>,
    ) -> Sample {
        let camera = &self.scene.camera;
        let [x, y] = position;
        let ray = Ray {
            origin: std::array::from_fn(|i| {
                camera.centre[i] + camera.right[i] * x + camera.up[i] * y
            }),
        };
        let mut nearest: Option<(usize, Boundary)> = None;
        let mut translucent: Option<(usize, Boundary)> = None;
        scratch
            .body_intervals
            .resize_with(self.scene.bodies.len(), Vec::new);
        for &index in &scratch.visited {
            scratch.body_intervals[index as usize].clear();
        }
        scratch.visited.clear();
        for (body_index, steps) in self.tiles.bodies(tile[0], tile[1]) {
            scratch.visited.push(body_index);
            let index = body_index as usize;
            let body = &self.scene.bodies[index];
            let (present, _, live) = &mut visibility[index];
            if self.open_bodies[index] {
                if let Some(projected) = body
                    .steps
                    .first()
                    .and_then(|step| self.tools.get(step.tool as usize).and_then(Option::as_ref))
                    .filter(|tool| tool.rect.contains(position))
                {
                    let admitted = self.weights[body.steps[0].tool as usize];
                    if !budget.scan(projected.view.scan_cost(&ray), admitted) {
                        return Sample::default();
                    }
                    if let Some(hit) = projected.view.first_surface_hit(&ray) {
                        *present = true;
                        if translucent.is_none_or(|(_, old)| hit.s < old.s - MERGE_EPS) {
                            translucent = Some((index, hit));
                        }
                    }
                }
                continue;
            }
            scratch.current.clear();
            for (offset, &step_index) in steps.iter().enumerate() {
                let step = &body.steps[step_index as usize];
                let projected = self.tools.get(step.tool as usize).and_then(Option::as_ref);
                if let Some(prism) = projected.filter(|tool| {
                    self.solid_tools
                        .get(step.tool as usize)
                        .copied()
                        .unwrap_or(false)
                        && tool.rect.contains(position)
                }) {
                    let admitted = self.weights[step.tool as usize];
                    if !budget.scan(prism.view.scan_cost(&ray), admitted) {
                        return Sample::default();
                    }
                    prism
                        .view
                        .surface_intervals(&ray, &mut scratch.crossings, &mut scratch.tool);
                    if !budget.charge((scratch.current.len() + scratch.tool.len()) as u64) {
                        return Sample::default();
                    }
                    combine(&scratch.current, &scratch.tool, step.op, &mut scratch.next);
                    std::mem::swap(&mut scratch.current, &mut scratch.next);
                } else if step.op == Op::Intersection {
                    scratch.current.clear();
                }
                if !scratch.current.is_empty() {
                    let end = steps
                        .get(offset + 1)
                        .copied()
                        .map_or(body.steps.len(), |v| v as usize);
                    let start = step_index as usize;
                    live[start] = live[start].max(end);
                }
            }
            if let Some(&first) = scratch.current.first() {
                *present = true;
                if body.analysed {
                    scratch.body_intervals[index].clone_from(&scratch.current);
                }
                let target = if body.reference {
                    &mut translucent
                } else {
                    &mut nearest
                };
                if target.is_none_or(|(_, hit)| first.s < hit.s - MERGE_EPS) {
                    *target = Some((index, first));
                }
            }
        }
        let mut marked = false;
        if self.scene.draw_interference {
            let bodies = scratch.visited.iter().filter_map(|&body| {
                let intervals = &scratch.body_intervals[body as usize];
                (!intervals.is_empty()).then_some(SampleBody { body, intervals })
            });
            scratch.overlaps.clear();
            overlay::overlapping_pairs_iter(
                bodies,
                self.scene.tolerance,
                &mut 0,
                &mut scratch.overlaps,
            );
            for &(a, b, s0, s1) in &scratch.overlaps {
                let (min, max) = overlay::stretch_box(
                    &ray,
                    camera.forward,
                    camera.right,
                    camera.up,
                    self.step / 2.0,
                    s0,
                    s1,
                );
                marks.record(a, b, min, max);
                marked = true;
            }
        }
        let make_hit = |(body, boundary): (usize, Boundary)| -> Option<Hit> {
            let (face, normal) = self
                .tools
                .get(boundary.tool as usize)?
                .as_ref()?
                .view
                .surface(boundary.face)?;
            Some(Hit {
                depth: boundary.s,
                body,
                tool: boundary.tool,
                face,
                normal: shade::facing(normal, camera.forward),
            })
        };
        let solid = nearest.and_then(make_hit);
        let translucent = translucent
            .and_then(make_hit)
            .filter(|hit| solid.is_none_or(|s| hit.depth < s.depth - MERGE_EPS));
        if let Some(hit) = solid {
            visibility[hit.body].1 = true;
        }
        if let Some(hit) = translucent {
            visibility[hit.body].1 = true;
        }
        Sample {
            solid,
            translucent,
            marked,
        }
    }

    fn sample_row(
        &self,
        y: usize,
        row: &mut [Sample],
        scratch: &mut RayScratch,
        visibility: &mut Visibility,
        marks: &mut MarkTable,
        budget: &mut WorkerBudget<'_>,
    ) {
        let up = (self.samples_high as f64 / 2.0 - (y as f64 + 0.5)) * self.step;
        for (x, hit) in row.iter_mut().enumerate() {
            let right = (x as f64 + 0.5 - self.samples_wide as f64 / 2.0) * self.step;
            *hit = self.sample(
                [right, up],
                [x as u32 / tiles::TILE, y as u32 / tiles::TILE],
                scratch,
                visibility,
                marks,
                budget,
            );
            if budget.stopped() {
                return;
            }
        }
    }

    fn bands(
        &self,
        first_pixel_row: usize,
        output: &mut [u8],
        shared: &ScanBudget,
    ) -> (Visibility, MarkTable) {
        let mut budget = shared.worker();
        let forward = self.scene.camera.forward;
        let right = self.scene.camera.right.map(|value| value * self.step);
        let down = self.scene.camera.up.map(|value| -value * self.step);
        let stride = self.scene.width as usize * 3;
        let palette = &self.scene.colours;
        let sample_count = (self.factor * self.factor) as f32;
        let mut visibility: Visibility = self
            .scene
            .bodies
            .iter()
            .map(|b| (false, false, vec![0; b.steps.len()]))
            .collect();
        let mut scratch = RayScratch::default();
        let mut marks = MarkTable::default();
        // Keep the rows for one output row plus its lower neighbor. At the
        // band boundary that neighbor is sampled again by the next band.
        let mut samples = vec![Sample::default(); self.samples_wide * (self.factor + 1)];
        for (band, pixels) in output.chunks_mut(stride * BAND_ROWS).enumerate() {
            let first_row = (first_pixel_row + band * BAND_ROWS) * self.factor;
            self.sample_row(
                first_row,
                &mut samples[..self.samples_wide],
                &mut scratch,
                &mut visibility,
                &mut marks,
                &mut budget,
            );
            if shared.stopped() {
                break;
            }
            for (pixel_row, row) in pixels.chunks_exact_mut(stride).enumerate() {
                let sample_y = first_row + pixel_row * self.factor;
                for (offset, sample_row) in samples
                    .chunks_exact_mut(self.samples_wide)
                    .enumerate()
                    .skip(1)
                {
                    let y = sample_y + offset;
                    if y < self.samples_high {
                        self.sample_row(
                            y,
                            sample_row,
                            &mut scratch,
                            &mut visibility,
                            &mut marks,
                            &mut budget,
                        );
                    }
                }
                if shared.stopped() {
                    break;
                }
                for (pixel_x, pixel) in row.as_chunks_mut::<3>().0.iter_mut().enumerate() {
                    let mut sum = [0.0f32; 3];
                    for dy in 0..self.factor {
                        for dx in 0..self.factor {
                            let x = pixel_x * self.factor + dx;
                            let i = dy * self.samples_wide + x;
                            let sample = samples[i];
                            let hit = sample.solid;
                            let edge = (x + 1 < self.samples_wide
                                && shade::is_edge(hit, samples[i + 1].solid, right, forward))
                                || (sample_y + dy + 1 < self.samples_high
                                    && shade::is_edge(
                                        hit,
                                        samples[i + self.samples_wide].solid,
                                        down,
                                        forward,
                                    ));
                            let mut colour = if edge {
                                palette.edge
                            } else if let Some(hit) = hit {
                                shade::lit_colour(palette.body, hit.normal, self.light)
                            } else {
                                palette.background
                            };
                            if let Some(reference) = sample.translucent {
                                let ref_edge = (x + 1 < self.samples_wide
                                    && shade::is_edge(
                                        sample.translucent,
                                        samples[i + 1].translucent,
                                        right,
                                        forward,
                                    ))
                                    || (sample_y + dy + 1 < self.samples_high
                                        && shade::is_edge(
                                            sample.translucent,
                                            samples[i + self.samples_wide].translucent,
                                            down,
                                            forward,
                                        ));
                                let ref_colour = if ref_edge {
                                    palette.edge
                                } else {
                                    shade::lit_colour(palette.body, reference.normal, self.light)
                                };
                                colour = shade::reference_mix(
                                    colour,
                                    ref_colour,
                                    self.scene.reference_opacity,
                                );
                            }
                            if sample.marked {
                                let outline = (x == 0 || !samples[i - 1].marked)
                                    || (x + 1 >= self.samples_wide || !samples[i + 1].marked)
                                    || (sample_y + dy + 1 >= self.samples_high
                                        || !samples[i + self.samples_wide].marked);
                                colour = overlay::hatch(
                                    x as u32,
                                    (sample_y + dy) as u32,
                                    palette.body,
                                    palette.interference,
                                    outline,
                                );
                            }
                            for (total, channel) in sum.iter_mut().zip(colour) {
                                *total += f32::from(channel);
                            }
                        }
                    }
                    for (channel, total) in pixel.iter_mut().zip(sum) {
                        *channel = (total / sample_count).round() as u8;
                    }
                }
                samples.copy_within(self.samples_wide * self.factor.., 0);
            }
            if !budget.flush() {
                break;
            }
        }
        (visibility, marks)
    }
}

impl<'a> Raster<'a> {
    /// Project the tools, refuse a picture over the work limit and build
    /// the per-tile body lists.
    fn prepare(scene: &'a Scene) -> Result<Self, CaptureError> {
        let (width, height, factor) = (scene.width, scene.height, scene.supersample);
        if !(64..=2048).contains(&width)
            || !(64..=2048).contains(&height)
            || !(1..=3).contains(&factor)
        {
            return Err(CaptureError(
                "Invalid capture scene: invalid raster dimensions or sampling factor.".into(),
            ));
        }
        let camera = &scene.camera;
        let family = RayFamily {
            forward: camera.forward,
        };
        let tools: Vec<_> = scene
            .tools
            .iter()
            .enumerate()
            .map(|(index, tool)| {
                let bounds = tool_view::tool_bounds(tool)?;
                let view = ToolView::picture(tool, index as u32, &family, None);
                let rect = ScreenRect::new(bounds, [0.0; 3], camera);
                Some(ProjectedPrism { view, rect })
            })
            .collect();
        let solid_tools: Vec<bool> = scene.tools.iter().map(tool_view::is_solid).collect();
        let open_bodies: Vec<bool> = scene
            .bodies
            .iter()
            .map(|body| {
                body.steps.first().is_some_and(|step| {
                    !solid_tools
                        .get(step.tool as usize)
                        .copied()
                        .unwrap_or(false)
                })
            })
            .collect();
        let samples_wide = width * factor;
        let samples_high = height * factor;
        let step = camera.mm_per_pixel / f64::from(factor);
        let rects: Vec<_> = tools
            .iter()
            .map(|tool: &Option<ProjectedPrism>| {
                tool.as_ref().map(|t| {
                    let x = |v: f64| {
                        ((v / step + f64::from(samples_wide) / 2.0)
                            .floor()
                            .clamp(0.0, f64::from(samples_wide))) as u32
                    };
                    let y = |v: f64| {
                        ((f64::from(samples_high) / 2.0 - v / step)
                            .floor()
                            .clamp(0.0, f64::from(samples_high))) as u32
                    };
                    SampleRect {
                        x0: x(*t.rect.x.start()),
                        x1: x(*t.rect.x.end()).saturating_add(1).min(samples_wide),
                        y0: y(*t.rect.y.end()),
                        y1: y(*t.rect.y.start()).saturating_add(1).min(samples_high),
                    }
                })
            })
            .collect();
        let weights: Vec<_> = tools
            .iter()
            .map(|t| {
                t.as_ref()
                    .map_or(1, |t| tiles::tool_weight(t.view.average_occupancy()))
            })
            .collect();
        tiles::admit(scene, &rects, samples_wide, samples_high, &weights)?;
        let tiles = TileLists::build(scene, &rects, samples_wide, samples_high);
        let work = tiles.work(&weights);
        if work > tiles::WORK_LIMIT {
            return Err(tiles::work_error(work));
        }
        Ok(Raster {
            scene,
            tools,
            weights,
            solid_tools,
            open_bodies,
            tiles,
            light: shade::light(camera),
            samples_wide: (width * factor) as usize,
            samples_high: (height * factor) as usize,
            factor: factor as usize,
            step: camera.mm_per_pixel / f64::from(factor),
        })
    }

    /// Paint the picture into `output` on up to `threads` workers and merge
    /// what each worker saw of every body.
    fn paint(
        &self,
        output: &mut [u8],
        threads: usize,
        shared: &ScanBudget,
    ) -> Result<(Visibility, MarkTable), CaptureError> {
        let scene = self.scene;
        let stride = self.samples_wide / self.factor * 3;
        let bands = (output.len() / stride).div_ceil(BAND_ROWS);
        let picture_threads = threads.min(bands);
        if picture_threads == 1 {
            return Ok(self.bands(0, output, shared));
        }
        let rows_per_worker = bands.div_ceil(picture_threads) * BAND_ROWS;
        thread::scope(|scope| {
            let mut workers = Vec::new();
            for (index, rows) in output.chunks_mut(rows_per_worker * stride).enumerate() {
                let first_row = index * rows_per_worker;
                let worker = thread::Builder::new()
                    .spawn_scoped(scope, move || self.bands(first_row, rows, shared))
                    .map_err(|err| CaptureError(format!("Cannot start capture worker: {err}.")))?;
                workers.push(worker);
            }
            let mut visibility: Visibility = scene
                .bodies
                .iter()
                .map(|b| (false, false, vec![0; b.steps.len()]))
                .collect();
            let mut marks = MarkTable::default();
            for worker in workers {
                let (states, worker_marks) = worker
                    .join()
                    .map_err(|_| CaptureError("A capture worker failed.".into()))?;
                marks.merge(worker_marks);
                for ((present, drawn, live), (worker_present, worker_drawn, worker_live)) in
                    visibility.iter_mut().zip(states)
                {
                    *present |= worker_present;
                    *drawn |= worker_drawn;
                    for (end, worker_end) in live.iter_mut().zip(worker_live) {
                        *end = (*end).max(worker_end);
                    }
                }
            }
            Ok((visibility, marks))
        })
    }

    /// What the picture shows of each body, and which of its steps matter.
    fn body_states(&self, visibility: Visibility) -> (Vec<Liveness>, Vec<BodyReport>) {
        let liveness: Vec<_> = visibility
            .iter()
            .enumerate()
            .map(|(index, (_, _, spans))| {
                if self.open_bodies[index] {
                    let mut live = Liveness::new(spans.len());
                    live.mark(0, spans.len());
                    live
                } else {
                    materialize_spans(spans)
                }
            })
            .collect();
        let bodies: Vec<_> = visibility
            .into_iter()
            .enumerate()
            .map(|(index, (present, drawn, _))| BodyReport {
                state: if drawn {
                    BodyState::Drawn
                } else if present {
                    BodyState::Hidden
                } else if self.open_bodies[index] {
                    BodyState::Outside
                } else {
                    BodyState::Absent
                },
                emptied_by_step: -1,
                open: self.open_bodies[index],
            })
            .collect();
        (liveness, bodies)
    }
}

fn materialize_spans(spans: &[usize]) -> Liveness {
    let mut live = Liveness::new(spans.len());
    let mut end = 0;
    for (i, &span_end) in spans.iter().enumerate() {
        end = end.max(span_end);
        live.alive_after[i] = i < end;
    }
    live
}

/// Render row-major RGB and a report. Zero threads uses available parallelism,
/// capped at eight. An orthonormal left-handed camera mirrors the picture.
pub fn render_rgb(scene: &Scene, threads: usize) -> Result<(Vec<u8>, Report), CaptureError> {
    render_with(scene, threads, SCAN_ALLOWANCE).0
}

fn render_with(
    scene: &Scene,
    threads: usize,
    allowance: u64,
) -> (Result<(Vec<u8>, Report), CaptureError>, RenderStats) {
    let shared = ScanBudget::new(allowance);
    let mut liveness_out = Vec::new();
    let mut census_out = census::CensusStats::default();
    let result = (|| {
        let (width, height) = (scene.width, scene.height);
        let raster = Raster::prepare(scene)?;
        let mut output = vec![0; width as usize * 3 * height as usize];
        let threads = if threads == 0 {
            thread::available_parallelism().map_or(1, usize::from)
        } else {
            threads
        }
        .min(MAX_THREADS);
        let (visibility, marks) = raster.paint(&mut output, threads, &shared)?;
        if shared.stopped() {
            return Err(CaptureError(format!("The scene is too heavy for this picture size (picture boundary scans over {allowance}). Use a smaller --size.")));
        }
        let (liveness, mut bodies) = raster.body_states(visibility);
        let census = census::resolve(
            scene,
            &mut bodies,
            &liveness,
            scene.target_cell,
            if scene.analyse {
                u64::from(scene.budget_million_rays) * 1_000_000
            } else {
                24_000_000
            },
        );
        drop(raster);
        let (analysis, mut pairs) = if scene.analyse {
            let (analysis, pairs) = interference::analyse_scene(scene, threads)?;
            (Some(analysis), pairs)
        } else {
            (None, Vec::new())
        };
        if scene.analyse && scene.draw_interference {
            let seen = marks.picture_only(&pairs)?;
            interference::add_view_pairs(scene, &mut pairs, &seen, scene.target_cell);
        }
        liveness_out = liveness;
        census_out = census;
        Ok((
            output,
            Report {
                width,
                height,
                bodies,
                analysis,
                pairs,
            },
        ))
    })();
    let stats = RenderStats {
        reads: shared.reads(),
        workers: shared.workers(),
        liveness: liveness_out,
        census: census_out,
    };
    (result, stats)
}
