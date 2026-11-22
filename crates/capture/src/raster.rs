//! Orthographic rasterization of the frontmost solid, with bounded sample storage.

use std::ops::RangeInclusive;
use std::thread;

use crate::interval::{combine, Boundary, Intervals, MERGE_EPS};
use crate::prism::PrismView;
use crate::report::{BodyReport, BodyState, Report};
use crate::scene::{Camera, Op, Scene, Tool};
use crate::shade::{self, Hit};
use crate::view::{cross, dot, Ray, RayFamily};
use crate::CaptureError;

const BAND_ROWS: usize = 32;
const MAX_THREADS: usize = 8;

type Visibility = Vec<(bool, bool)>;

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
    view: PrismView,
    rect: ScreenRect,
}

#[derive(Default)]
struct RayScratch {
    crossings: Vec<Boundary>,
    tool: Intervals,
    current: Intervals,
    next: Intervals,
}

struct Raster<'a> {
    scene: &'a Scene,
    tools: Vec<Option<ProjectedPrism>>,
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
        scratch: &mut RayScratch,
        visibility: &mut Visibility,
    ) -> Option<Hit> {
        let camera = &self.scene.camera;
        let [x, y] = position;
        let ray = Ray {
            origin: std::array::from_fn(|i| {
                camera.centre[i] + camera.right[i] * x + camera.up[i] * y
            }),
        };
        let mut nearest: Option<(usize, Boundary)> = None;
        for (index, (body, (present, _))) in
            self.scene.bodies.iter().zip(&mut *visibility).enumerate()
        {
            if body.reference {
                continue;
            }
            scratch.current.clear();
            for step in &body.steps {
                let projected = self.tools.get(step.tool as usize).and_then(Option::as_ref);
                if let Some(prism) = projected.filter(|tool| tool.rect.contains(position)) {
                    prism
                        .view
                        .surface_intervals(&ray, &mut scratch.crossings, &mut scratch.tool);
                    combine(&scratch.current, &scratch.tool, step.op, &mut scratch.next);
                    std::mem::swap(&mut scratch.current, &mut scratch.next);
                } else if step.op == Op::Intersection {
                    scratch.current.clear();
                }
            }
            if let Some(&first) = scratch.current.first() {
                *present = true;
                if nearest.is_none_or(|(_, hit)| first.s < hit.s - MERGE_EPS) {
                    nearest = Some((index, first));
                }
            }
        }
        let (body, boundary) = nearest?;
        let (face, normal) = self
            .tools
            .get(boundary.tool as usize)?
            .as_ref()?
            .view
            .surface(boundary.face)?;
        visibility[body].1 = true;
        Some(Hit {
            depth: boundary.s,
            body,
            tool: boundary.tool,
            face,
            normal: shade::facing(normal, camera.forward),
        })
    }

    fn sample_row(
        &self,
        y: usize,
        row: &mut [Option<Hit>],
        scratch: &mut RayScratch,
        visibility: &mut Visibility,
    ) {
        let up = (self.samples_high as f64 / 2.0 - (y as f64 + 0.5)) * self.step;
        for (x, hit) in row.iter_mut().enumerate() {
            let right = (x as f64 + 0.5 - self.samples_wide as f64 / 2.0) * self.step;
            *hit = self.sample([right, up], scratch, visibility);
        }
    }

    fn bands(&self, first_pixel_row: usize, output: &mut [u8]) -> Visibility {
        let forward = self.scene.camera.forward;
        let right = self.scene.camera.right.map(|value| value * self.step);
        let down = self.scene.camera.up.map(|value| -value * self.step);
        let stride = self.scene.width as usize * 3;
        let palette = &self.scene.colours;
        let sample_count = (self.factor * self.factor) as f32;
        let mut visibility = vec![(false, false); self.scene.bodies.len()];
        let mut scratch = RayScratch::default();
        // Keep the rows for one output row plus its lower neighbor. At the
        // band boundary that neighbor is sampled again by the next band.
        let mut samples = vec![None; self.samples_wide * (self.factor + 1)];
        for (band, pixels) in output.chunks_mut(stride * BAND_ROWS).enumerate() {
            let first_row = (first_pixel_row + band * BAND_ROWS) * self.factor;
            self.sample_row(
                first_row,
                &mut samples[..self.samples_wide],
                &mut scratch,
                &mut visibility,
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
                        self.sample_row(y, sample_row, &mut scratch, &mut visibility);
                    }
                }
                for (pixel_x, pixel) in row.as_chunks_mut::<3>().0.iter_mut().enumerate() {
                    let mut sum = [0.0f32; 3];
                    for dy in 0..self.factor {
                        for dx in 0..self.factor {
                            let x = pixel_x * self.factor + dx;
                            let i = dy * self.samples_wide + x;
                            let hit = samples[i];
                            let edge = (x + 1 < self.samples_wide
                                && shade::is_edge(hit, samples[i + 1], right, forward))
                                || (sample_y + dy + 1 < self.samples_high
                                    && shade::is_edge(
                                        hit,
                                        samples[i + self.samples_wide],
                                        down,
                                        forward,
                                    ));
                            let colour = if edge {
                                palette.edge
                            } else if let Some(hit) = hit {
                                shade::lit_colour(palette.body, hit.normal, self.light)
                            } else {
                                palette.background
                            };
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
        visibility
    }
}

/// Render row-major RGB and a report. Zero threads uses available parallelism,
/// capped at eight. An orthonormal left-handed camera mirrors the picture.
pub fn render_rgb(scene: &Scene, threads: usize) -> Result<(Vec<u8>, Report), CaptureError> {
    let (width, height, factor) = (scene.width, scene.height, scene.supersample);
    if !(64..=2048).contains(&width) || !(64..=2048).contains(&height) || !(1..=3).contains(&factor)
    {
        return Err(CaptureError(
            "Invalid capture scene: invalid raster dimensions or sampling factor.".into(),
        ));
    }
    let camera = &scene.camera;
    let family = RayFamily {
        forward: camera.forward,
    };
    let tools = scene
        .tools
        .iter()
        .enumerate()
        .map(|(index, tool)| {
            let Tool::Prism(prism) = tool else {
                return None;
            };
            let view = PrismView::new(prism, index as u32, &family);
            let rect = ScreenRect::new(view.bounds(), prism.o, camera);
            Some(ProjectedPrism { view, rect })
        })
        .collect();
    let raster = Raster {
        scene,
        tools,
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
    .min(MAX_THREADS)
    .min(bands);
    let visibility = if threads == 1 {
        raster.bands(0, &mut output)
    } else {
        let rows_per_worker = bands.div_ceil(threads) * BAND_ROWS;
        let raster = &raster;
        thread::scope(|scope| {
            let mut workers = Vec::new();
            for (index, rows) in output.chunks_mut(rows_per_worker * stride).enumerate() {
                let first_row = index * rows_per_worker;
                let worker = thread::Builder::new()
                    .spawn_scoped(scope, move || raster.bands(first_row, rows))
                    .map_err(|err| CaptureError(format!("Cannot start capture worker: {err}.")))?;
                workers.push(worker);
            }
            let mut visibility = vec![(false, false); scene.bodies.len()];
            for worker in workers {
                let states = worker
                    .join()
                    .map_err(|_| CaptureError("A capture worker failed.".into()))?;
                for ((present, drawn), (worker_present, worker_drawn)) in
                    visibility.iter_mut().zip(states)
                {
                    *present |= worker_present;
                    *drawn |= worker_drawn;
                }
            }
            Ok(visibility)
        })?
    };
    let bodies = visibility
        .into_iter()
        .map(|(present, drawn)| BodyReport {
            state: if drawn {
                BodyState::Drawn
            } else if present {
                BodyState::Hidden
            } else {
                BodyState::Absent
            },
            emptied_by_step: -1,
            open: false,
        })
        .collect();
    Ok((
        output,
        Report {
            width,
            height,
            bodies,
            analysis: None,
            pairs: Vec::new(),
        },
    ))
}
