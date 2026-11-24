//! A straightforward renderer without tiles, bands or budgets. The tests
//! compare the production renderer against it.

use super::*;

pub(super) struct ReferenceRaster<'a> {
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

pub(super) fn render_reference_full(scene: &Scene) -> (Vec<u8>, Report, Vec<census::Liveness>) {
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

pub(super) fn render_reference(scene: &Scene) -> (Vec<u8>, Report) {
    let (rgb, report, _) = render_reference_full(scene);
    (rgb, report)
}
