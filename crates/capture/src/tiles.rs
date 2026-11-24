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

pub const ENTRY_LIMIT: u64 = 4_194_304;

pub struct Admission {
    pub work: u64,
    pub entries: u64,
}

fn tiles_for(
    step: &crate::scene::Step,
    rects: &[Option<SampleRect>],
    sx: u32,
    sy: u32,
) -> Option<(u32, u32, u32, u32)> {
    if step.op == Op::Intersection {
        return Some((0, 0, sx.div_ceil(TILE), sy.div_ceil(TILE)));
    }
    let r = rects.get(step.tool as usize).copied().flatten()?;
    let (x0, y0, x1, y1) = (r.x0.min(sx), r.y0.min(sy), r.x1.min(sx), r.y1.min(sy));
    if x0 >= x1 || y0 >= y1 {
        return None;
    }
    Some((
        x0 / TILE,
        y0 / TILE,
        (x1 - 1) / TILE + 1,
        (y1 - 1) / TILE + 1,
    ))
}

pub fn admit(
    scene: &Scene,
    rects: &[Option<SampleRect>],
    samples_x: u32,
    samples_y: u32,
    weights: &[u64],
) -> Result<Admission, CaptureError> {
    let columns = samples_x.div_ceil(TILE) as usize;
    let rows = samples_y.div_ceil(TILE) as usize;
    let stride = columns + 1;
    let mut w = vec![0i128; stride * (rows + 1)];
    let mut e = vec![0i128; stride * (rows + 1)];
    for step in scene.bodies.iter().flat_map(|b| &b.steps) {
        if let Some((x0, y0, x1, y1)) = tiles_for(step, rects, samples_x, samples_y) {
            let weight = i128::from(weights.get(step.tool as usize).copied().unwrap_or(1));
            for (x, y, sign) in [(x0, y0, 1i128), (x1, y0, -1), (x0, y1, -1), (x1, y1, 1)] {
                let i = y as usize * stride + x as usize;
                w[i] += sign * weight;
                e[i] += sign;
            }
        }
    }
    let (mut work, mut entries) = (0i128, 0i128);
    for y in 0..rows {
        for x in 0..columns {
            let i = y * stride + x;
            if x > 0 {
                w[i] += w[i - 1];
                e[i] += e[i - 1];
            }
            if y > 0 {
                w[i] += w[i - stride];
                e[i] += e[i - stride];
            }
            if x > 0 && y > 0 {
                w[i] -= w[i - stride - 1];
                e[i] -= e[i - stride - 1];
            }
            let width = samples_x.saturating_sub(x as u32 * TILE).min(TILE);
            let height = samples_y.saturating_sub(y as u32 * TILE).min(TILE);
            work = work.saturating_add(w[i].saturating_mul(i128::from(width) * i128::from(height)));
            entries = entries.saturating_add(e[i]);
        }
    }
    let work = work.min(i128::from(u64::MAX)) as u64;
    let entries = entries.min(i128::from(u64::MAX)) as u64;
    if work > WORK_LIMIT {
        return Err(work_error(work));
    }
    if entries > ENTRY_LIMIT {
        return Err(CaptureError(format!("The scene is too heavy for this picture size (tile list entries {entries}, limit 4194304). Use a smaller --size.")));
    }
    Ok(Admission { work, entries })
}

struct Group {
    body: u32,
    start: usize,
    end: usize,
}
pub struct TileLists {
    columns: u32,
    rows: u32,
    samples_x: u32,
    samples_y: u32,
    offsets: Vec<usize>,
    groups: Vec<Group>,
    indices: Vec<u32>,
    tools: Vec<u32>,
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
        let count = columns as usize * rows as usize;
        let mut group_counts = vec![0usize; count];
        let mut entry_counts = vec![0usize; count];
        let mut body_counts = vec![0usize; count];
        let mut touched = Vec::new();
        // The tiles one step covers, as indices into the tile grid.
        let step_tiles = |step: &crate::scene::Step| {
            tiles_for(step, rects, samples_x, samples_y)
                .into_iter()
                .flat_map(move |(x0, y0, x1, y1)| {
                    (y0..y1).flat_map(move |y| {
                        (x0..x1).map(move |x| y as usize * columns as usize + x as usize)
                    })
                })
        };
        // Count a body's steps per tile and note the tiles it touches.
        let count_steps =
            |body: &crate::scene::Body, counts: &mut [usize], touched: &mut Vec<usize>| {
                for i in body.steps.iter().flat_map(step_tiles) {
                    if counts[i] == 0 {
                        touched.push(i);
                    }
                    counts[i] += 1;
                }
            };
        for body in &scene.bodies {
            count_steps(body, &mut body_counts, &mut touched);
            for i in touched.drain(..) {
                group_counts[i] += 1;
                entry_counts[i] += body_counts[i];
                body_counts[i] = 0;
            }
        }
        let mut offsets = vec![0usize; count + 1];
        let mut entry_offsets = vec![0usize; count + 1];
        for i in 0..count {
            offsets[i + 1] = offsets[i] + group_counts[i];
            entry_offsets[i + 1] = entry_offsets[i] + entry_counts[i];
        }
        let mut groups: Vec<Group> = (0..offsets[count])
            .map(|_| Group {
                body: 0,
                start: 0,
                end: 0,
            })
            .collect();
        let mut indices = vec![0u32; entry_offsets[count]];
        let mut tools = vec![0u32; entry_offsets[count]];
        let mut group_cursor = offsets[..count].to_vec();
        let mut entry_cursor = entry_offsets[..count].to_vec();
        for (body_index, body) in scene.bodies.iter().enumerate() {
            count_steps(body, &mut body_counts, &mut touched);
            for &i in &touched {
                let start = entry_cursor[i];
                groups[group_cursor[i]] = Group {
                    body: body_index as u32,
                    start,
                    end: start + body_counts[i],
                };
                group_cursor[i] += 1;
                body_counts[i] = 0;
            }
            for (step_index, step) in body.steps.iter().enumerate() {
                for i in step_tiles(step) {
                    indices[entry_cursor[i]] = step_index as u32;
                    tools[entry_cursor[i]] = step.tool;
                    entry_cursor[i] += 1;
                }
            }
            touched.clear();
        }
        Self {
            columns,
            rows,
            samples_x,
            samples_y,
            offsets,
            groups,
            indices,
            tools,
        }
    }
    pub fn bodies(&self, tile_x: u32, tile_y: u32) -> impl Iterator<Item = (u32, &[u32])> {
        let range = if tile_x < self.columns && tile_y < self.rows {
            let i = tile_y as usize * self.columns as usize + tile_x as usize;
            self.offsets[i]..self.offsets[i + 1]
        } else {
            0..0
        };
        self.groups[range]
            .iter()
            .map(|g| (g.body, &self.indices[g.start..g.end]))
    }
    pub fn steps(&self, body: u32, tile_x: u32, tile_y: u32) -> &[u32] {
        self.bodies(tile_x, tile_y)
            .find(|(b, _)| *b == body)
            .map_or(&[], |(_, steps)| steps)
    }
    pub fn work(&self, weights: &[u64]) -> u64 {
        let mut work = 0u64;
        for y in 0..self.rows {
            for x in 0..self.columns {
                let area = u64::from(self.samples_x.saturating_sub(x * TILE).min(TILE))
                    * u64::from(self.samples_y.saturating_sub(y * TILE).min(TILE));
                let i = y as usize * self.columns as usize + x as usize;
                for group in &self.groups[self.offsets[i]..self.offsets[i + 1]] {
                    for &tool in &self.tools[group.start..group.end] {
                        work = work.saturating_add(
                            area.saturating_mul(weights.get(tool as usize).copied().unwrap_or(1)),
                        );
                    }
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
    fn admission_matches_lists_for_seeded_rectangles() {
        let mut seed = 0x12345678u32;
        let mut next = || {
            seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
            seed
        };
        for _ in 0..100 {
            let rects: Vec<_> = (0..20)
                .map(|_| {
                    let x = next() % 100;
                    let y = next() % 70;
                    rect(x, y, x + next() % 40, y + next() % 40)
                })
                .collect();
            let steps = (0..20)
                .map(|i| {
                    step(
                        if next() % 7 == 0 {
                            Op::Intersection
                        } else {
                            Op::Union
                        },
                        i,
                    )
                })
                .collect();
            let s = scene(steps, 20);
            let weights: Vec<_> = (0..20).map(|_| u64::from(next() % 9 + 1)).collect();
            let a = admit(&s, &rects, 100, 70, &weights).unwrap();
            let lists = TileLists::build(&s, &rects, 100, 70);
            assert_eq!(a.work, lists.work(&weights));
            assert_eq!(a.entries, lists.indices.len() as u64);
        }
    }
    #[test]
    #[cfg_attr(debug_assertions, ignore = "release only")]
    fn many_sparse_bodies_build_within_budget() {
        let mut s = scene(vec![], 1);
        s.bodies = (0..20_000)
            .map(|_| crate::scene::Body {
                reference: false,
                analysed: false,
                steps: vec![step(Op::Union, 0)],
            })
            .collect();
        let rects = [rect(0, 0, 32, 32)];
        let a = admit(&s, &rects, 6144, 6144, &[1]).unwrap();
        assert_eq!((a.work, a.entries), (20_480_000, 20_000));
        let start = std::time::Instant::now();
        let lists = TileLists::build(&s, &rects, 6144, 6144);
        assert!(start.elapsed().as_millis() < 1000);
        assert_eq!(lists.work(&[1]), a.work);
        assert_eq!(lists.indices.len() as u64, a.entries);
    }
    #[test]
    fn admission_matches_m12_cases_and_multiple_bodies() {
        let mut s = scene(
            vec![
                step(Op::Union, 0),
                step(Op::Difference, 1),
                step(Op::Union, 1),
                step(Op::Intersection, 2),
            ],
            3,
        );
        s.bodies.push(Body {
            reference: false,
            analysed: false,
            steps: vec![step(Op::Union, 1)],
        });
        let rects = [rect(0, 0, 32, 32), rect(96, 64, 128, 96), None];
        let a = admit(&s, &rects, 128, 96, &[1, 5, 2]).unwrap();
        let lists = TileLists::build(&s, &rects, 128, 96);
        assert_eq!(a.work, lists.work(&[1, 5, 2]));
        assert_eq!(a.entries, lists.indices.len() as u64);
        assert_eq!(
            lists.bodies(3, 2).collect::<Vec<_>>(),
            vec![(0, &[1, 2, 3][..]), (1, &[0][..])]
        );
        let s = scene(vec![step(Op::Union, 0), step(Op::Union, 1)], 2);
        let rects = [rect(0, 0, 65, 33), rect(32, 0, 65, 33)];
        let a = admit(&s, &rects, 65, 33, &[1, 5]).unwrap();
        let lists = TileLists::build(&s, &rects, 65, 33);
        assert_eq!(
            (a.work, a.entries),
            (lists.work(&[1, 5]), lists.indices.len() as u64)
        );
    }
    #[test]
    fn off_frame_steps_do_not_allocate_tile_entries() {
        let s = scene((0..20_000).map(|_| step(Op::Difference, 0)).collect(), 1);
        let lists = TileLists::build(&s, &[None], 64, 64);
        assert!(lists.indices.is_empty());
        assert!(lists.tools.is_empty());
        assert_eq!(admit(&s, &[None], 64, 64, &[1]).unwrap().entries, 0);
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
