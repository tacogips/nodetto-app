//! A straightforward renderer without tiles, bands or budgets. The tests
//! compare the production renderer against it.

use super::*;

#[derive(Clone, Default)]
struct ReferenceSample {
    solid: Option<Hit>,
    layers: Vec<Hit>,
    marked: bool,
}

pub(super) struct ReferenceRaster<'a> {
    scene: &'a Scene,
    tools: Vec<Option<ProjectedPrism>>,
    solid_tools: Vec<bool>,
    body_boxes: Vec<crate::lattice::Bounds>,
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
    ) -> ReferenceSample {
        let camera = &self.scene.camera;
        let [x, y] = position;
        let ray = Ray {
            origin: std::array::from_fn(|i| {
                camera.centre[i] + camera.right[i] * x + camera.up[i] * y
            }),
        };
        let mut nearest: Option<(usize, Boundary)> = None;
        let mut layers: Vec<(usize, Boundary)> = Vec::new();
        let mut witness = Intervals::new();
        let mut volume = Intervals::new();
        let mut witness_next = Intervals::new();
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
                        layers.push((index, hit));
                    }
                }
                continue;
            }
            scratch.current.clear();
            witness.clear();
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
                    if self.scene.draw_interference && body.analysed {
                        prism
                            .view
                            .intervals(&ray, &mut scratch.crossings, &mut volume);
                        combine(&witness, &volume, step.op, &mut witness_next);
                        std::mem::swap(&mut witness, &mut witness_next);
                    }
                    combine(&scratch.current, &scratch.tool, step.op, &mut scratch.next);
                    std::mem::swap(&mut scratch.current, &mut scratch.next);
                } else if step.op == Op::Intersection {
                    scratch.current.clear();
                    witness.clear();
                }
                if !scratch.current.is_empty() {
                    liveness[index].mark(step_index, step_index + 1);
                }
            }
            if self.scene.draw_interference && body.analysed {
                scratch.body_intervals[index].clone_from(&witness);
            }
            if let Some(&first) = scratch.current.first() {
                *present = true;
                if body.reference {
                    layers.push((index, first));
                } else if nearest.is_none_or(|(_, hit)| first.s < hit.s - MERGE_EPS) {
                    nearest = Some((index, first));
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
                if !self
                    .body_boxes
                    .get(a as usize)
                    .zip(self.body_boxes.get(b as usize))
                    .is_some_and(|(&a, &b)| crate::lattice::shares_extent(a, b))
                {
                    continue;
                }
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
        let mut layers: Vec<Hit> = layers
            .into_iter()
            .filter_map(make_hit)
            .filter(|hit| solid.is_none_or(|s| hit.depth < s.depth - MERGE_EPS))
            .collect();
        layers.sort_by(|a, b| a.depth.total_cmp(&b.depth).then(a.body.cmp(&b.body)));
        if let Some(hit) = solid {
            visibility[hit.body].1 = true;
        }
        for hit in &layers {
            visibility[hit.body].1 = true;
        }
        ReferenceSample {
            solid,
            layers,
            marked,
        }
    }

    fn reference_sample_row(
        &self,
        y: usize,
        row: &mut [ReferenceSample],
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
        let mut samples = vec![ReferenceSample::default(); self.samples_wide * (self.factor + 1)];
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
                            let sample = &samples[i];
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
                            for reference in sample.layers.iter().rev() {
                                let neighbour = |index: usize| {
                                    samples[index]
                                        .layers
                                        .iter()
                                        .copied()
                                        .find(|hit| hit.body == reference.body)
                                };
                                let ref_edge = (x + 1 < self.samples_wide
                                    && shade::is_edge(
                                        Some(*reference),
                                        neighbour(i + 1),
                                        right,
                                        forward,
                                    ))
                                    || (sample_y + dy + 1 < self.samples_high
                                        && shade::is_edge(
                                            Some(*reference),
                                            neighbour(i + self.samples_wide),
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
                samples.rotate_left(self.samples_wide * self.factor);
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
        body_boxes: crate::lattice::body_boxes(scene, &crate::lattice::scene_tool_bounds(scene)),
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

pub(in crate::raster) mod fixtures {
    use super::*;
    use crate::scene::{Body, Loop, Prism, Step, Tool};

    fn blank() -> Scene {
        let mut scene =
            crate::scene::parse_scene(include_bytes!("../../tests/fixtures/plate-iso.ncs1"))
                .unwrap();
        scene.tools.clear();
        scene.bodies.clear();
        scene.width = 64;
        scene.height = 512;
        scene.supersample = 1;
        scene.analyse = true;
        scene.draw_interference = true;
        scene.tolerance = 0.001;
        scene
    }

    fn box_tool(o: [f64; 3], width: f64, depth: f64, height: f64, opposed: bool) -> Tool {
        Tool::Prism(Prism {
            o,
            u: if opposed {
                [-1.0, 0.0, 0.0]
            } else {
                [1.0, 0.0, 0.0]
            },
            v: if opposed {
                [0.0, -1.0, 0.0]
            } else {
                [0.0, 1.0, 0.0]
            },
            n: [0.0, 0.0, 1.0],
            t0: 0.0,
            t1: height,
            loops: vec![Loop {
                points: vec![0.0, 0.0, width, 0.0, width, depth, 0.0, depth],
                faces: vec![2, 3, 4, u32::MAX],
            }],
        })
    }

    fn bodies() -> Vec<Body> {
        (0..2)
            .map(|tool| Body {
                reference: false,
                analysed: true,
                steps: vec![Step {
                    op: Op::Union,
                    tool,
                }],
            })
            .collect()
    }

    pub(in crate::raster) fn sheets_over_board(sheets: &[f64], board: bool) -> Scene {
        let mut scene = blank();
        scene.width = 96;
        scene.height = 96;
        scene.analyse = false;
        scene.draw_interference = false;
        scene.camera = Camera {
            right: [1.0, 0.0, 0.0],
            up: [0.0, 1.0, 0.0],
            forward: [0.0, 0.0, -1.0],
            centre: [5.0, 5.0, 0.0],
            mm_per_pixel: 0.25,
        };
        if board {
            scene
                .tools
                .push(box_tool([0.0, 0.0, 0.0], 10.0, 10.0, 1.0, false));
            scene.bodies.push(Body {
                reference: true,
                analysed: false,
                steps: vec![Step {
                    op: Op::Union,
                    tool: 0,
                }],
            });
        }
        for &z in sheets {
            let tool = scene.tools.len() as u32;
            scene.tools.push(Tool::Mesh(crate::scene::Mesh {
                positions: vec![-1.0, -1.0, z, 11.0, -1.0, z, 11.0, 11.0, z, -1.0, 11.0, z],
                triangles: vec![0, 1, 2, 0, 2, 3],
            }));
            scene.bodies.push(Body {
                reference: false,
                analysed: false,
                steps: vec![Step {
                    op: Op::Union,
                    tool,
                }],
            });
        }
        scene
    }

    pub(in crate::raster) fn opaque_over_board(board: bool) -> Scene {
        let mut scene = sheets_over_board(&[3.0], board);
        let tool = scene.tools.len() as u32;
        scene
            .tools
            .push(box_tool([-0.5, -0.5, 1.5], 11.0, 11.0, 1.0, false));
        scene.bodies.push(Body {
            reference: false,
            analysed: false,
            steps: vec![Step {
                op: Op::Union,
                tool,
            }],
        });
        scene
    }

    pub(in crate::raster) fn stacked_caps(overlap: f64) -> Scene {
        let mut scene = blank();
        scene.tools = vec![
            box_tool([0.0, 0.0, 0.0], 16.0, 8.0, 0.9375, false),
            box_tool(
                [0.0, 0.0, 0.9375 - overlap],
                16.0,
                8.0,
                1.0625 + overlap,
                false,
            ),
        ];
        scene.bodies = bodies();
        scene.camera = Camera {
            right: [1.0, 0.0, 0.0],
            up: [0.0, 0.0, 1.0],
            forward: [0.0, 1.0, 0.0],
            centre: [8.0, -4.0, 0.9375 - overlap / 2.0 + 44.5 * 0.25],
            mm_per_pixel: 0.25,
        };
        scene
    }

    pub(in crate::raster) fn mesh_under_prism(back: bool, overlap: f64) -> Scene {
        let mut scene = stacked_caps(overlap);
        scene.tools[0] = Tool::Mesh(crate::scene::Mesh {
            positions: vec![
                0., 0., 0., 16., 0., 0., 16., 8., 0., 0., 8., 0., 0., 0., 0.9375, 16., 0., 0.9375,
                16., 8., 0.9375, 0., 8., 0.9375,
            ],
            triangles: vec![
                0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2,
                7, 6, 3, 0, 4, 3, 4, 7,
            ],
        });
        if back {
            scene.camera.forward = [0., -1., 0.];
            scene.camera.right = [-1., 0., 0.];
            scene.camera.centre[1] = 12.;
        }
        scene
    }

    pub(in crate::raster) fn tall_mesh_under_prism(back: bool, overlap: f64) -> Scene {
        let mut scene = stacked_caps(overlap);
        scene.width = 64;
        scene.height = 64;
        scene.supersample = 2;
        scene.tools = vec![
            Tool::Mesh(crate::scene::Mesh {
                positions: vec![
                    -1., 0., -35.25, 1., 0., -35.25, 1., 8., -35.25, -1., 8., -35.25, -1., 0., 0.,
                    1., 0., 0., 1., 8., 0., -1., 8., 0.,
                ],
                triangles: vec![
                    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3,
                    7, 2, 7, 6, 3, 0, 4, 3, 4, 7,
                ],
            }),
            box_tool([-1.0, 0.0, -overlap], 2.0, 8.0, 156.75 + overlap, false),
        ];
        // Default-fit camera from tmp/car13-r13/car13-p1-touching-witness/camera-probe.log.
        scene.camera = Camera {
            right: if back {
                [-1.0, 0.0, 0.0]
            } else {
                [1.0, 0.0, 0.0]
            },
            up: [0.0, 0.0, 1.0],
            forward: if back {
                [0.0, -1.0, 0.0]
            } else {
                [0.0, 1.0, 0.0]
            },
            centre: [0.0, 0.0, 60.75],
            mm_per_pixel: 3.24,
        };
        scene
    }

    pub(in crate::raster) fn tall_mesh_with_boss(back: bool, overlap: f64, boss: bool) -> Scene {
        let mut scene = tall_mesh_under_prism(back, overlap);
        scene.tools[1] = box_tool([-1.0, 0.0, -overlap], 2.0, 10.0, 156.75 + overlap, false);
        if boss {
            scene
                .tools
                .push(box_tool([-0.5, 8.5, -1.0], 1.0, 1.0, 2.0, false));
            scene.bodies[1].steps.push(Step {
                op: Op::Union,
                tool: 2,
            });
        }
        // Camera confirmed by tmp/car14-r14/car14-p1-prism-slab-proof/camera-probe.log.
        scene
    }

    pub(in crate::raster) fn shared_side(opposed: bool, overlap: f64) -> Scene {
        let mut scene = blank();
        let origin = if opposed {
            [8.0, 8.0, 0.0]
        } else {
            [0.0, 0.0, 0.0]
        };
        scene.tools = vec![
            box_tool(origin, 8.0, 8.0, 2.0, opposed),
            box_tool([8.0 - overlap, 0.0, 0.0], 8.0 + overlap, 8.0, 2.0, false),
        ];
        scene.bodies = bodies();
        scene.camera = Camera {
            right: [1.0, 0.0, 0.0],
            up: [0.0, 1.0, 0.0],
            forward: [0.0, 0.0, -1.0],
            centre: [8.0 - overlap / 2.0 - 8.5 * 0.25, 4.0, 0.0],
            mm_per_pixel: 0.25,
        };
        scene
    }
}

mod witness_tests {
    use super::*;

    fn touching(scene: Scene, mut plain: Scene) {
        let (rgb, report) = render_reference(&scene);
        assert!(
            report.pairs.is_empty(),
            "unexpected pairs: {:?}",
            report.pairs
        );
        assert_eq!(report.analysis.unwrap().candidates, 0);
        plain.draw_interference = false;
        assert_eq!(rgb, render_reference(&plain).0);
    }
    fn touching_with_candidates(scene: Scene, mut plain: Scene, candidates: usize) {
        let (rgb, report) = render_reference(&scene);
        assert!(
            report.pairs.is_empty(),
            "unexpected pairs: {:?}",
            report.pairs
        );
        assert_eq!(report.analysis.unwrap().candidates as usize, candidates);
        plain.draw_interference = false;
        assert_eq!(rgb, render_reference(&plain).0);
    }
    #[test]
    fn tall_mesh_boss_touch() {
        for back in [false, true] {
            touching_with_candidates(
                fixtures::tall_mesh_with_boss(back, 0.0, true),
                fixtures::tall_mesh_with_boss(back, 0.0, true),
                1,
            );
            touching(
                fixtures::tall_mesh_with_boss(back, 0.0, false),
                fixtures::tall_mesh_with_boss(back, 0.0, false),
            );
        }
    }
    fn overlap(scene: Scene, mut plain: Scene) {
        let (rgb, report) = render_reference(&scene);
        assert_eq!(report.pairs.len(), 1);
        plain.draw_interference = false;
        assert_ne!(rgb, render_reference(&plain).0);
    }
    #[test]
    fn tall_mesh_touch() {
        for back in [false, true] {
            touching(
                fixtures::tall_mesh_under_prism(back, 0.0),
                fixtures::tall_mesh_under_prism(back, 0.0),
            );
        }
    }
    #[test]
    fn stacked_caps_touch() {
        touching(fixtures::stacked_caps(0.0), fixtures::stacked_caps(0.0));
    }
    #[test]
    fn opposed_side_touch() {
        touching(
            fixtures::shared_side(true, 0.0),
            fixtures::shared_side(true, 0.0),
        );
    }
    #[test]
    fn aligned_side_touch() {
        touching(
            fixtures::shared_side(false, 0.0),
            fixtures::shared_side(false, 0.0),
        );
    }
    #[test]
    fn stacked_caps_overlap() {
        overlap(fixtures::stacked_caps(0.01), fixtures::stacked_caps(0.01));
    }
    #[test]
    fn opposed_side_overlap() {
        overlap(
            fixtures::shared_side(true, 0.01),
            fixtures::shared_side(true, 0.01),
        );
    }
}

mod layer_tests {
    use super::*;

    fn check_sheets(sheets: &[f64]) {
        let (rgb, report) = render_reference(&fixtures::sheets_over_board(sheets, true));
        let (plain, _) = render_reference(&fixtures::sheets_over_board(sheets, false));
        let pixel = |bytes: &[u8], x: usize, y: usize| -> [u8; 3] {
            bytes[(y * 96 + x) * 3..][..3].try_into().unwrap()
        };
        assert_ne!(pixel(&rgb, 48, 48), pixel(&plain, 48, 48), "board interior");
        assert_ne!(pixel(&rgb, 67, 48), pixel(&rgb, 48, 48), "board outline");
        assert_ne!(
            pixel(&rgb, 67, 48),
            pixel(&plain, 67, 48),
            "outline versus sheet"
        );
        assert!(report
            .bodies
            .iter()
            .all(|body| body.state == BodyState::Drawn));
    }

    #[test]
    fn one_sheet_over_board() {
        check_sheets(&[3.0]);
    }
    #[test]
    fn four_sheets_over_board() {
        check_sheets(&[3.0, 4.0, 5.0, 6.0]);
    }
    #[test]
    fn opaque_foreground_hides_board() {
        let (rgb, report) = render_reference(&fixtures::opaque_over_board(true));
        assert_eq!(report.bodies[0].state, BodyState::Hidden);
        assert_eq!(rgb, render_reference(&fixtures::opaque_over_board(false)).0);
    }
}
