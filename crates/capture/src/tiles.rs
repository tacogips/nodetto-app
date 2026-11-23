//! Per-tile picture steps and a bounded work estimate.
use crate::scene::{Op, Scene};
use crate::CaptureError;

pub const TILE: u32 = 32;
pub const WORK_LIMIT: u64 = 4_000_000_000;

#[derive(Clone, Copy, Debug)]
pub struct SampleRect {
    pub x0: u32,
    pub y0: u32,
    pub x1: u32,
    pub y1: u32,
}

struct BodyTiles {
    offsets: Vec<usize>,
    indices: Vec<u32>,
    tools: Vec<u32>,
}

pub struct TileLists {
    columns: u32,
    rows: u32,
    samples_x: u32,
    samples_y: u32,
    bodies: Vec<BodyTiles>,
}

impl TileLists {
    pub fn build(
        scene: &Scene,
        rects: &[Option<SampleRect>],
        samples_x: u32,
        samples_y: u32,
    ) -> Self {
        let columns = samples_x.div_ceil(TILE);
        let rows = samples_y.div_ceil(TILE);
        let count = (columns as usize).saturating_mul(rows as usize);
        let mut bodies = Vec::with_capacity(scene.bodies.len());
        for body in &scene.bodies {
            let mut counts = vec![0usize; count];
            let tiles_for = |step: &crate::scene::Step| -> Option<(u32, u32, u32, u32)> {
                if step.op == Op::Intersection {
                    return Some((0, 0, columns, rows));
                }
                let rect = rects.get(step.tool as usize).copied().flatten()?;
                let x0 = rect.x0.min(samples_x);
                let y0 = rect.y0.min(samples_y);
                let x1 = rect.x1.min(samples_x);
                let y1 = rect.y1.min(samples_y);
                if x0 >= x1 || y0 >= y1 {
                    return None;
                }
                Some((
                    x0 / TILE,
                    y0 / TILE,
                    (x1 - 1) / TILE + 1,
                    (y1 - 1) / TILE + 1,
                ))
            };
            for step in &body.steps {
                if let Some((x0, y0, x1, y1)) = tiles_for(step) {
                    for y in y0..y1 {
                        for x in x0..x1 {
                            let i = y as usize * columns as usize + x as usize;
                            counts[i] = counts[i].saturating_add(1);
                        }
                    }
                }
            }
            let mut offsets = Vec::with_capacity(count.saturating_add(1));
            offsets.push(0usize);
            for &n in &counts {
                offsets.push(offsets.last().copied().unwrap_or(0).saturating_add(n));
            }
            let total = offsets.last().copied().unwrap_or(0);
            let mut indices = vec![0u32; total];
            let mut cursor = offsets[..count].to_vec();
            for (step_index, step) in body.steps.iter().enumerate() {
                if let Some((x0, y0, x1, y1)) = tiles_for(step) {
                    for y in y0..y1 {
                        for x in x0..x1 {
                            let i = y as usize * columns as usize + x as usize;
                            indices[cursor[i]] = u32::try_from(step_index).unwrap_or(u32::MAX);
                            cursor[i] += 1;
                        }
                    }
                }
            }
            bodies.push(BodyTiles {
                offsets,
                indices,
                tools: body.steps.iter().map(|s| s.tool).collect(),
            });
        }
        Self {
            columns,
            rows,
            samples_x,
            samples_y,
            bodies,
        }
    }

    pub fn steps(&self, body: u32, tile_x: u32, tile_y: u32) -> &[u32] {
        if tile_x >= self.columns || tile_y >= self.rows {
            return &[];
        }
        let Some(body) = self.bodies.get(body as usize) else {
            return &[];
        };
        let i = tile_y as usize * self.columns as usize + tile_x as usize;
        &body.indices[body.offsets[i]..body.offsets[i + 1]]
    }

    pub fn work(&self, weights: &[u64]) -> u64 {
        let mut work = 0u64;
        for body in &self.bodies {
            for y in 0..self.rows {
                for x in 0..self.columns {
                    let i = y as usize * self.columns as usize + x as usize;
                    let mut weight = 0u64;
                    for &step in &body.indices[body.offsets[i]..body.offsets[i + 1]] {
                        let tool = body.tools.get(step as usize).copied().unwrap_or(u32::MAX);
                        weight =
                            weight.saturating_add(weights.get(tool as usize).copied().unwrap_or(1));
                    }
                    let width = self
                        .samples_x
                        .saturating_sub(x.saturating_mul(TILE))
                        .min(TILE);
                    let height = self
                        .samples_y
                        .saturating_sub(y.saturating_mul(TILE))
                        .min(TILE);
                    work = work.saturating_add(
                        u64::from(width)
                            .saturating_mul(u64::from(height))
                            .saturating_mul(weight),
                    );
                }
            }
        }
        work
    }
}

pub fn tool_weight(average_occupancy: f64) -> u64 {
    (average_occupancy.ceil() as u64).max(1)
}

pub fn work_error(work: u64) -> CaptureError {
    CaptureError(format!("The scene is too heavy for this picture size (work {work}, limit 4000000000). Use a smaller --size."))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::scene::{Body, Camera, Colours, Loop, Mesh, Prism, Step, Tool};

    fn scene(steps: Vec<Step>, tools: usize) -> Scene {
        Scene {
            width: 128,
            height: 96,
            supersample: 1,
            camera: Camera {
                right: [1., 0., 0.],
                up: [0., 1., 0.],
                forward: [0., 0., 1.],
                centre: [0.; 3],
                mm_per_pixel: 1.,
            },
            colours: Colours {
                background: [0; 3],
                body: [0; 3],
                edge: [0; 3],
                interference: [0; 3],
            },
            reference_opacity: 0,
            analyse: false,
            draw_interference: false,
            budget_million_rays: 24,
            tolerance: 0.001,
            target_cell: 0.25,
            tools: (0..tools)
                .map(|_| {
                    Tool::Mesh(Mesh {
                        positions: vec![],
                        triangles: vec![],
                    })
                })
                .collect(),
            bodies: vec![Body {
                reference: false,
                analysed: false,
                steps,
            }],
        }
    }
    fn step(op: Op, tool: u32) -> Step {
        Step { op, tool }
    }
    fn rect(x0: u32, y0: u32, x1: u32, y1: u32) -> Option<SampleRect> {
        Some(SampleRect { x0, y0, x1, y1 })
    }

    #[test]
    fn lists_preserve_order_and_intersections() {
        let s = scene(
            vec![
                step(Op::Union, 0),
                step(Op::Difference, 1),
                step(Op::Union, 1),
                step(Op::Intersection, 2),
            ],
            3,
        );
        let lists = TileLists::build(
            &s,
            &[rect(0, 0, 32, 32), rect(96, 64, 128, 96), None],
            128,
            96,
        );
        assert_eq!(lists.steps(0, 0, 0), &[0, 3]);
        assert_eq!(lists.steps(0, 3, 2), &[1, 2, 3]);
        assert_eq!(lists.steps(0, 1, 1), &[3]);
        let s = scene(vec![step(Op::Union, 0)], 1);
        assert!(TileLists::build(&s, &[rect(0, 0, 32, 32)], 128, 96)
            .steps(0, 1, 1)
            .is_empty());
    }
    #[test]
    fn partial_tiles_and_saturation() {
        let s = scene(vec![step(Op::Union, 0), step(Op::Union, 1)], 2);
        let lists = TileLists::build(&s, &[rect(0, 0, 65, 33), rect(32, 0, 65, 33)], 65, 33);
        assert_eq!(lists.work(&[1, 5]), 65 * 33 + 33 * 33 * 5);
        assert_eq!(lists.work(&[u64::MAX, 5]), u64::MAX);
        assert_eq!(tool_weight(0.2), 1);
        assert_eq!(tool_weight(3.1), 4);
        assert_eq!(tool_weight(f64::INFINITY), u64::MAX);
        assert_eq!(work_error(42).to_string(), "The scene is too heavy for this picture size (work 42, limit 4000000000). Use a smaller --size.");
    }
    #[test]
    #[cfg_attr(debug_assertions, ignore)]
    fn many_tools_exceed_limit_within_budget() {
        let s = scene((0..20_000).map(|i| step(Op::Union, i)).collect(), 20_000);
        let rects = vec![rect(0, 0, 2048, 2048); 20_000];
        let start = std::time::Instant::now();
        let lists = TileLists::build(&s, &rects, 2048, 2048);
        let elapsed = start.elapsed();
        println!("20,000-tool tile build: {} ms", elapsed.as_millis());
        assert!(elapsed.as_millis() < 1000);
        assert!(lists.work(&vec![1; 20_000]) > WORK_LIMIT);
    }
    #[test]
    #[cfg_attr(debug_assertions, ignore)]
    fn zigzag_prism_exceeds_limit() {
        use crate::prism::PrismView;
        use crate::view::RayFamily;
        let points = (0..20_000)
            .flat_map(|i| [f64::from(i), f64::from(i % 2)])
            .collect();
        let prism = Prism {
            o: [0.; 3],
            u: [1., 0., 0.],
            v: [0., 1., 0.],
            n: [0., 0., 1.],
            t0: 0.,
            t1: 1.,
            loops: vec![Loop {
                points,
                faces: vec![0; 20_000],
            }],
        };
        let view = PrismView::new(&prism, 0, &RayFamily { forward: prism.u });
        let weight = tool_weight(view.average_occupancy());
        assert!(weight > 1);
        let s = scene(vec![step(Op::Union, 0)], 1);
        assert!(
            TileLists::build(&s, &[rect(0, 0, 2048, 2048)], 2048, 2048).work(&[weight])
                > WORK_LIMIT
        );
    }
}
