//! Orthographic rasterization of the frontmost solid, with bounded sample storage.

use std::ops::RangeInclusive;
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
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

const BAND_ROWS: usize = 32;
const MAX_THREADS: usize = 8;
const CHUNK: u64 = 1_048_576;
const SCAN_ALLOWANCE: u64 = 16_000_000_000;

#[cfg_attr(not(test), allow(dead_code))]
struct RenderStats {
    reads: u64,
    workers: usize,
    liveness: Vec<Liveness>,
    census: census::CensusStats,
}

struct ScanBudget {
    allowance: u64,
    charged: AtomicU64,
    reads: AtomicU64,
    workers: AtomicUsize,
    stopped: AtomicBool,
}

struct WorkerBudget<'a> {
    shared: &'a ScanBudget,
    pending: u64,
    reads: u64,
}

impl WorkerBudget<'_> {
    fn flush(&mut self) -> bool {
        let total = self
            .shared
            .charged
            .fetch_add(self.pending, Ordering::Relaxed)
            + self.pending;
        self.pending = 0;
        if total > self.shared.allowance {
            self.shared.stopped.store(true, Ordering::Relaxed);
        }
        !self.shared.stopped.load(Ordering::Relaxed)
    }

    fn charge(&mut self, count: u64) -> bool {
        self.pending += count;
        if self.pending >= CHUNK && !self.flush() {
            return false;
        }
        self.reads += count;
        true
    }

    /// Charge the edges or triangles a ray tests beyond the weight its
    /// tool was admitted with. Admission averages a tool's buckets, so a
    /// view zoomed onto one dense bucket would otherwise scan it for every
    /// sample without limit.
    fn scan(&mut self, tested: usize, admitted: u64) -> bool {
        let surplus = (tested as u64).saturating_sub(admitted);
        if surplus == 0 {
            return true;
        }
        self.pending += surplus;
        self.pending < CHUNK || self.flush()
    }
}

impl Drop for WorkerBudget<'_> {
    fn drop(&mut self) {
        self.flush();
        self.shared.reads.fetch_add(self.reads, Ordering::Relaxed);
    }
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
            let bodies: Vec<_> = scratch
                .visited
                .iter()
                .filter_map(|&body| {
                    let intervals = &scratch.body_intervals[body as usize];
                    (!intervals.is_empty()).then_some(SampleBody { body, intervals })
                })
                .collect();
            scratch.overlaps.clear();
            overlay::overlapping_pairs(
                &bodies,
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
            if budget.shared.stopped.load(Ordering::Relaxed) {
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
        shared.workers.fetch_add(1, Ordering::Relaxed);
        let mut budget = WorkerBudget {
            shared,
            pending: 0,
            reads: 0,
        };
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
            if shared.stopped.load(Ordering::Relaxed) {
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
                if shared.stopped.load(Ordering::Relaxed) {
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
    let shared = ScanBudget {
        allowance,
        charged: AtomicU64::new(0),
        reads: AtomicU64::new(0),
        workers: AtomicUsize::new(0),
        stopped: AtomicBool::new(false),
    };
    let mut liveness_out = Vec::new();
    let mut census_out = census::CensusStats::default();
    let result = (|| {
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
        let raster = Raster {
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
        };
        let stride = width as usize * 3;
        let height_pixels = height as usize;
        let mut output = vec![0; stride * height_pixels];
        let bands = height_pixels.div_ceil(BAND_ROWS);
        let threads = if threads == 0 {
            thread::available_parallelism().map_or(1, usize::from)
        } else {
            threads
        }
        .min(MAX_THREADS);
        let picture_threads = threads.min(bands);
        let (visibility, marks) = if picture_threads == 1 {
            raster.bands(0, &mut output, &shared)
        } else {
            let rows_per_worker = bands.div_ceil(picture_threads) * BAND_ROWS;
            let raster = &raster;
            thread::scope(|scope| {
                let mut workers = Vec::new();
                let shared = &shared;
                for (index, rows) in output.chunks_mut(rows_per_worker * stride).enumerate() {
                    let first_row = index * rows_per_worker;
                    let worker = thread::Builder::new()
                        .spawn_scoped(scope, move || raster.bands(first_row, rows, shared))
                        .map_err(|err| {
                            CaptureError(format!("Cannot start capture worker: {err}."))
                        })?;
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
            })?
        };
        if shared.stopped.load(Ordering::Relaxed) {
            return Err(CaptureError(format!("The scene is too heavy for this picture size (picture boundary scans over {allowance}). Use a smaller --size.")));
        }
        let liveness: Vec<_> = visibility
            .iter()
            .enumerate()
            .map(|(index, (_, _, spans))| {
                if raster.open_bodies[index] {
                    let mut live = Liveness::new(spans.len());
                    live.mark(0, spans.len());
                    live
                } else {
                    materialize_spans(spans)
                }
            })
            .collect();
        let mut bodies: Vec<_> = visibility
            .into_iter()
            .enumerate()
            .map(|(index, (present, drawn, _))| BodyReport {
                state: if drawn {
                    BodyState::Drawn
                } else if present {
                    BodyState::Hidden
                } else if raster.open_bodies[index] {
                    BodyState::Outside
                } else {
                    BodyState::Absent
                },
                emptied_by_step: -1,
                open: raster.open_bodies[index],
            })
            .collect();
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
        reads: shared.reads.load(Ordering::Relaxed),
        workers: shared.workers.load(Ordering::Relaxed),
        liveness: liveness_out,
        census: census_out,
    };
    (result, stats)
}

#[cfg(test)]
struct ReferenceRaster<'a> {
    scene: &'a Scene,
    tools: Vec<Option<ProjectedPrism>>,
    solid_tools: Vec<bool>,
    open_bodies: Vec<bool>,
    light: [f64; 3],
    samples_wide: usize,
    samples_high: usize,
    factor: usize,
    step: f64,
}
#[cfg(test)]
impl ReferenceRaster<'_> {
    fn reference_sample(
        &self,
        position: [f64; 2],
        scratch: &mut RayScratch,
        visibility: &mut Visibility,
        marks: &mut MarkTable,
        liveness: &mut [Liveness],
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
        for intervals in &mut scratch.body_intervals {
            intervals.clear();
        }
        for (index, (body, (present, _, _))) in
            self.scene.bodies.iter().zip(&mut *visibility).enumerate()
        {
            if self.open_bodies[index] {
                if let Some(projected) = body
                    .steps
                    .first()
                    .and_then(|step| self.tools.get(step.tool as usize).and_then(Option::as_ref))
                    .filter(|tool| tool.rect.contains(position))
                {
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
            for (step_index, step) in body.steps.iter().enumerate() {
                let projected = self.tools.get(step.tool as usize).and_then(Option::as_ref);
                if let Some(prism) = projected.filter(|tool| {
                    self.solid_tools
                        .get(step.tool as usize)
                        .copied()
                        .unwrap_or(false)
                        && tool.rect.contains(position)
                }) {
                    prism
                        .view
                        .surface_intervals(&ray, &mut scratch.crossings, &mut scratch.tool);
                    combine(&scratch.current, &scratch.tool, step.op, &mut scratch.next);
                    std::mem::swap(&mut scratch.current, &mut scratch.next);
                } else if step.op == Op::Intersection {
                    scratch.current.clear();
                }
                if !scratch.current.is_empty() {
                    liveness[index].mark(step_index, step_index + 1);
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
            let bodies: Vec<_> = scratch
                .body_intervals
                .iter()
                .enumerate()
                .filter(|(_, intervals)| !intervals.is_empty())
                .map(|(body, intervals)| SampleBody {
                    body: body as u32,
                    intervals,
                })
                .collect();
            scratch.overlaps.clear();
            overlay::overlapping_pairs(
                &bodies,
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

    fn reference_sample_row(
        &self,
        y: usize,
        row: &mut [Sample],
        scratch: &mut RayScratch,
        visibility: &mut Visibility,
        marks: &mut MarkTable,
        liveness: &mut [Liveness],
    ) {
        let up = (self.samples_high as f64 / 2.0 - (y as f64 + 0.5)) * self.step;
        for (x, hit) in row.iter_mut().enumerate() {
            let right = (x as f64 + 0.5 - self.samples_wide as f64 / 2.0) * self.step;
            *hit = self.reference_sample([right, up], scratch, visibility, marks, liveness);
        }
    }

    fn reference_bands(
        &self,
        first_pixel_row: usize,
        output: &mut [u8],
        liveness: &mut [Liveness],
    ) -> (Visibility, MarkTable) {
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
            self.reference_sample_row(
                first_row,
                &mut samples[..self.samples_wide],
                &mut scratch,
                &mut visibility,
                &mut marks,
                liveness,
            );
            for (pixel_row, row) in pixels.chunks_exact_mut(stride).enumerate() {
                let sample_y = first_row + pixel_row * self.factor;
                for (offset, sample_row) in samples
                    .chunks_exact_mut(self.samples_wide)
                    .enumerate()
                    .skip(1)
                {
                    let y = sample_y + offset;
                    if y < self.samples_high {
                        self.reference_sample_row(
                            y,
                            sample_row,
                            &mut scratch,
                            &mut visibility,
                            &mut marks,
                            liveness,
                        );
                    }
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
        }
        (visibility, marks)
    }
}

#[cfg(test)]
fn render_reference_full(scene: &Scene) -> (Vec<u8>, Report, Vec<census::Liveness>) {
    let (width, height, factor) = (scene.width, scene.height, scene.supersample);
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
    let raster = ReferenceRaster {
        scene,
        tools,
        solid_tools,
        open_bodies,
        light: shade::light(camera),
        samples_wide: (width * factor) as usize,
        samples_high: (height * factor) as usize,
        factor: factor as usize,
        step: camera.mm_per_pixel / f64::from(factor),
    };
    let mut liveness: Vec<_> = scene
        .bodies
        .iter()
        .map(|b| Liveness::new(b.steps.len()))
        .collect();
    for (i, live) in liveness.iter_mut().enumerate() {
        if raster.open_bodies[i] {
            live.mark(0, scene.bodies[i].steps.len());
        }
    }
    let mut output = vec![0; width as usize * height as usize * 3];
    let (visibility, marks) = raster.reference_bands(0, &mut output, &mut liveness);
    let mut bodies: Vec<_> = visibility
        .into_iter()
        .enumerate()
        .map(|(index, (present, drawn, _))| BodyReport {
            state: if drawn {
                BodyState::Drawn
            } else if present {
                BodyState::Hidden
            } else if raster.open_bodies[index] {
                BodyState::Outside
            } else {
                BodyState::Absent
            },
            emptied_by_step: -1,
            open: raster.open_bodies[index],
        })
        .collect();
    census::resolve(
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
        let (analysis, pairs) = interference::analyse_scene(scene, 1).unwrap();
        (Some(analysis), pairs)
    } else {
        (None, Vec::new())
    };
    if scene.analyse && scene.draw_interference {
        let seen = marks.picture_only(&pairs).unwrap();
        interference::add_view_pairs(scene, &mut pairs, &seen, scene.target_cell);
    }
    (
        output,
        Report {
            width,
            height,
            bodies,
            analysis,
            pairs,
        },
        liveness,
    )
}

#[cfg(test)]
fn render_reference(scene: &Scene) -> (Vec<u8>, Report) {
    let (rgb, report, _) = render_reference_full(scene);
    (rgb, report)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::scene::{Body, Loop, Prism, Step, Tool};

    fn plate() -> Scene {
        crate::scene::parse_scene(include_bytes!("../tests/fixtures/plate-iso.ncs1")).unwrap()
    }
    fn box_tool(o: [f64; 3], width: f64, depth: f64, height: f64) -> Tool {
        Tool::Prism(Prism {
            o,
            u: [1.0, 0.0, 0.0],
            v: [0.0, 1.0, 0.0],
            n: [0.0, 0.0, 1.0],
            t0: 0.0,
            t1: height,
            loops: vec![Loop {
                points: vec![0.0, 0.0, width, 0.0, width, depth, 0.0, depth],
                faces: vec![2, 3, 4, u32::MAX],
            }],
        })
    }
    fn body(steps: &[(Op, u32)]) -> Body {
        Body {
            reference: false,
            analysed: true,
            steps: steps.iter().map(|&(op, tool)| Step { op, tool }).collect(),
        }
    }
    fn base() -> Scene {
        let mut s = plate();
        s.width = 96;
        s.height = 96;
        s.supersample = 1;
        s.camera = Camera {
            right: [1.0, 0.0, 0.0],
            up: [0.0, 1.0, 0.0],
            forward: [0.0, 0.0, -1.0],
            centre: [0.0; 3],
            mm_per_pixel: 0.25,
        };
        s.tools.clear();
        s.bodies.clear();
        s.analyse = false;
        s.draw_interference = false;
        s
    }
    fn compare(s: &Scene) -> Report {
        let (rgb, report) = render_reference(s);
        for threads in [1, 2, 5] {
            let (actual_rgb, actual_report) = render_rgb(s, threads).unwrap();
            assert_eq!(actual_rgb, rgb, "RGB differs with {threads} threads");
            assert_eq!(
                actual_report, report,
                "report differs with {threads} threads"
            );
        }
        report
    }
    fn refilled() -> Scene {
        let mut s = base();
        s.tools = vec![
            box_tool([-4.0, -4.0, 0.0], 8.0, 8.0, 4.0),
            box_tool([-5.0, -5.0, -1.0], 10.0, 10.0, 6.0),
        ];
        s.bodies = vec![body(&[(Op::Union, 0), (Op::Difference, 1), (Op::Union, 0)])];
        s
    }
    #[test]
    fn reduced_plate_matches_reference() {
        let mut s = plate();
        s.width = 64;
        s.height = 64;
        s.supersample = 1;
        compare(&s);
    }
    #[test]
    fn reduced_refilled_matches_reference() {
        let mut s = refilled();
        s.width = 64;
        s.height = 64;
        assert_eq!(compare(&s).bodies[0].emptied_by_step, 1);
    }
    #[test]
    #[cfg_attr(debug_assertions, ignore = "release only")]
    fn plate_matches_reference() {
        compare(&plate());
    }
    #[test]
    #[cfg_attr(debug_assertions, ignore = "release only")]
    fn holes_match_reference() {
        let mut s = base();
        s.tools.push(box_tool([-10.0, -10.0, 0.0], 20.0, 20.0, 2.0));
        let mut steps = vec![(Op::Union, 0)];
        for i in 0..600 {
            let x = (i % 30) as f64 * 0.6 - 9.0;
            let y = (i / 30) as f64 * 0.8 - 8.0;
            s.tools.push(box_tool([x, y, -1.0], 0.2, 0.2, 4.0));
            steps.push((Op::Difference, (i + 1) as u32));
        }
        s.bodies.push(body(&steps));
        compare(&s);
    }
    #[test]
    #[cfg_attr(debug_assertions, ignore = "release only")]
    fn grid_matches_reference() {
        let mut s = base();
        for y in 0..15 {
            for x in 0..20 {
                let index = s.tools.len() as u32;
                s.tools.push(box_tool(
                    [x as f64 * 1.0 - 10.0, y as f64 * 1.0 - 7.5, 0.0],
                    0.8,
                    0.8,
                    2.0,
                ));
                s.bodies.push(body(&[(Op::Union, index)]));
            }
        }
        compare(&s);
    }
    #[test]
    #[cfg_attr(debug_assertions, ignore = "release only")]
    fn intersections_match_reference() {
        let mut s = base();
        s.draw_interference = true;
        for i in 0..50 {
            let x = (i % 10) as f64 * 2.0 - 10.0;
            let y = (i / 10) as f64 * 2.0 - 5.0;
            let index = s.tools.len() as u32;
            s.tools.push(box_tool([x, y, 0.0], 1.6, 1.6, 2.0));
            s.tools
                .push(box_tool([x + 0.4, y + 0.4, -1.0], 1.6, 1.6, 4.0));
            s.bodies
                .push(body(&[(Op::Union, index), (Op::Intersection, index + 1)]));
        }
        compare(&s);
    }
    #[test]
    #[cfg_attr(debug_assertions, ignore = "release only")]
    fn refilled_matches_reference() {
        assert_eq!(compare(&refilled()).bodies[0].emptied_by_step, 1);
    }
    #[test]
    fn span_maxima_match_individual_marks() {
        let mut seed = 173u32;
        for len in 1..100 {
            let mut spans = vec![0usize; len];
            let mut expected = Liveness::new(len);
            for _ in 0..300 {
                seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
                let start = seed as usize % len;
                seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
                let end = start + seed as usize % (len - start + 1);
                spans[start] = spans[start].max(end);
                expected.mark(start, end);
            }
            assert_eq!(materialize_spans(&spans), expected);
        }
    }

    fn disjoint_scene(n: usize) -> Scene {
        let mut s = base();
        s.width = 64;
        s.height = 320;
        for i in 0..n {
            s.tools.push(box_tool(
                [-100.0, -100.0, i as f64 * 3.0],
                200.0,
                200.0,
                1.0,
            ));
        }
        s.bodies.push(body(
            &(0..n).map(|i| (Op::Union, i as u32)).collect::<Vec<_>>(),
        ));
        s
    }

    /// A profile whose 4,000 zigzag edges all lie in one 0.2 mm band.
    fn dense_band_scene(mm_per_pixel: f64, centre: [f64; 3]) -> Scene {
        const TEETH: usize = 4_000;
        let length = TEETH as f64 * 0.01;
        let mut points = Vec::with_capacity(TEETH * 2 + 4);
        for tooth in 0..TEETH {
            points.extend([tooth as f64 * 0.01, (tooth % 2) as f64 * 0.2]);
        }
        points.extend([length, -50.0, 0.0, -50.0]);
        let mut s = base();
        s.width = 256;
        s.height = 256;
        s.camera.mm_per_pixel = mm_per_pixel;
        s.camera.centre = centre;
        s.tools.push(Tool::Prism(Prism {
            o: [0.0; 3],
            u: [1.0, 0.0, 0.0],
            v: [0.0, 1.0, 0.0],
            n: [0.0, 0.0, 1.0],
            t0: 0.0,
            t1: 1.0,
            loops: vec![Loop {
                faces: (0..points.len() as u32 / 2).collect(),
                points,
            }],
        }));
        s.bodies.push(body(&[(Op::Union, 0)]));
        s
    }

    #[test]
    fn a_view_zoomed_onto_a_dense_bucket_is_refused_by_the_scan_budget() {
        let fitted = dense_band_scene(0.25, [20.0, -25.0, 0.0]);
        let zoomed = dense_band_scene(0.2 / 256.0, [20.0, 0.1, 0.0]);
        for threads in [1, 2, 5] {
            assert!(render_with(&fitted, threads, 50_000_000).0.is_ok());
            let error = render_with(&zoomed, threads, 50_000_000).0.unwrap_err();
            assert!(error.0.contains("too heavy"), "{}", error.0);
        }
    }

    #[test]
    fn disjoint_boundary_reads_follow_formula() {
        for n in [3usize, 7] {
            let s = disjoint_scene(n);
            let samples = 64 * (320 + 320usize.div_ceil(BAND_ROWS) - 1);
            for threads in [1, 2, 5] {
                let (result, stats) = render_with(&s, threads, SCAN_ALLOWANCE);
                result.unwrap();
                assert_eq!(
                    stats.reads,
                    (samples * n * (n - 1) + samples * 2 * n) as u64
                );
            }
        }
        let mut invalid = base();
        invalid.width = 1;
        let (result, stats) = render_with(&invalid, 1, SCAN_ALLOWANCE);
        assert!(result.is_err());
        assert_eq!((stats.reads, stats.workers), (0, 0));
        assert!(stats.liveness.is_empty());
        assert_eq!(stats.census.rays, 0);
    }

    #[test]
    #[cfg_attr(debug_assertions, ignore = "release only")]
    fn boundary_read_counts_and_refusal_are_bounded() {
        let s = disjoint_scene(50);
        let mut expected = None;
        for threads in [1, 2, 5] {
            let (result, stats) = render_with(&s, threads, 100_000_000);
            assert_eq!(stats.workers, threads);
            assert_eq!(stats.reads, 53_692_800);
            let output = result.unwrap();
            if let Some(ref old) = expected {
                assert_eq!(&output, old);
            }
            expected = Some(output);
        }
        let s = disjoint_scene(2000);
        for threads in [1, 2, 5] {
            let (result, stats) = render_with(&s, threads, 10_000_000);
            assert_eq!(stats.workers, threads);
            assert!(stats.reads <= 10_000_000 + threads as u64 * CHUNK);
            assert_eq!(result.unwrap_err().to_string(), "The scene is too heavy for this picture size (picture boundary scans over 10000000). Use a smaller --size.");
            assert!(stats.liveness.is_empty());
            assert_eq!(stats.census.rays, 0);
        }
    }

    #[test]
    fn off_view_liveness_matches_reference_and_census_rays() {
        let mut s = base();
        s.width = 64;
        s.height = 64;
        s.tools.push(box_tool([-20.0, -20.0, 0.0], 40.0, 40.0, 2.0));
        s.tools.push(box_tool([100.0, 100.0, 0.0], 2.0, 2.0, 2.0));
        let count = if cfg!(debug_assertions) { 2000 } else { 20_000 };
        let mut steps = vec![(Op::Union, 0)];
        steps.extend(std::iter::repeat_n((Op::Difference, 1), count));
        for intersection in [false, true] {
            let mut history = steps.clone();
            if intersection {
                history.push((Op::Intersection, 1));
            }
            s.bodies = vec![body(&history)];
            let reference = render_reference_full(&s);
            for threads in [1, 2, 5] {
                let (result, stats) = render_with(&s, threads, SCAN_ALLOWANCE);
                assert_eq!(result.unwrap(), (reference.0.clone(), reference.1.clone()));
                assert_eq!(stats.liveness, reference.2);
                if !intersection {
                    assert_eq!(stats.census.rays, 0);
                }
            }
        }
        let sound = plate();
        assert_eq!(render_with(&sound, 1, SCAN_ALLOWANCE).1.census.rays, 0);
        s.tools = vec![Tool::Mesh(crate::scene::Mesh {
            positions: vec![100.0, 100.0, 0.0, 101.0, 100.0, 0.0, 100.0, 101.0, 0.0],
            triangles: vec![0, 1, 2],
        })];
        s.bodies = vec![body(&[(Op::Union, 0)])];
        assert_eq!(render_with(&s, 1, SCAN_ALLOWANCE).1.census.rays, 0);
    }
}
