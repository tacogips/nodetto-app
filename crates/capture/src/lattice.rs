//! Camera-independent sampling of one or two folded prism bodies.

use crate::interval::{combine, overlap, Boundary, Intervals};
use crate::prism::PrismView;
use crate::scene::{Op, Scene, Step, Tool};
use crate::view::{Ray, RayFamily};

pub(crate) type Bounds = ([f64; 3], [f64; 3]);

const AXIS_REFINEMENT_LIMIT: u64 = 2_000_000;
const SMALL_LOOP_CELLS: f64 = 4.0;
const BOUNDARY_DIVISIONS: u8 = 8;

pub struct LatticeRequest<'a> {
    pub scene: &'a Scene,
    pub bodies: (u32, Option<u32>),
    pub min: [f64; 3],
    pub max: [f64; 3],
    pub cell: f64,
    pub tolerance: f64,
}

#[derive(Debug)]
pub struct AxisSample {
    pub hit: bool,
    pub volume: f64,
    pub min: [f64; 3],
    pub max: [f64; 3],
    pub cell: f64,
    pub rays: u64,
    pub capped: bool,
}

/// Bounds of each swept loop, in world coordinates. Meshes enter analysis in M11.
pub(crate) fn tool_loops(scene: &Scene) -> Vec<Vec<Bounds>> {
    scene
        .tools
        .iter()
        .map(|tool| {
            let Tool::Prism(prism) = tool else {
                return Vec::new();
            };
            if !crate::prism::orthonormal([prism.u, prism.v, prism.n]) || prism.t0 == prism.t1 {
                return Vec::new();
            }
            prism
                .loops
                .iter()
                .filter_map(|profile| {
                    let (points, remainder) = profile.points.as_chunks::<2>();
                    if !remainder.is_empty()
                        || points.len() < 3
                        || points.len() != profile.faces.len()
                    {
                        return None;
                    }
                    let mut bounds = empty_bounds();
                    for &[x, y] in points {
                        for axis in 0..3 {
                            let base = prism.o[axis] + prism.u[axis] * x + prism.v[axis] * y;
                            let a = base + prism.n[axis] * prism.t0;
                            let b = base + prism.n[axis] * prism.t1;
                            bounds.0[axis] = bounds.0[axis].min(a.min(b));
                            bounds.1[axis] = bounds.1[axis].max(a.max(b));
                        }
                    }
                    valid_bounds(bounds).then_some(bounds)
                })
                .collect()
        })
        .collect()
}

pub(crate) fn empty_bounds() -> Bounds {
    ([f64::INFINITY; 3], [f64::NEG_INFINITY; 3])
}

pub(crate) fn valid_bounds((min, max): Bounds) -> bool {
    (0..3).all(|axis| min[axis].is_finite() && max[axis].is_finite() && min[axis] <= max[axis])
}

pub(crate) fn extend((min, max): &mut Bounds, (lo, hi): Bounds) {
    for axis in 0..3 {
        min[axis] = min[axis].min(lo[axis]);
        max[axis] = max[axis].max(hi[axis]);
    }
}

pub(crate) fn tool_bounds(loops: &[Vec<Bounds>]) -> Vec<Bounds> {
    loops
        .iter()
        .map(|loops| {
            let mut bounds = empty_bounds();
            for &bounds_of_loop in loops {
                extend(&mut bounds, bounds_of_loop);
            }
            bounds
        })
        .collect()
}

pub(crate) fn active_step(step: &Step, tools: &[Bounds], (min, max): Bounds) -> bool {
    step.op == Op::Intersection
        || tools.get(step.tool as usize).is_some_and(|&(lo, hi)| {
            (0..3).all(|axis| lo[axis] <= max[axis] && hi[axis] >= min[axis])
        })
}

fn side_count(extent: f64, cell: f64) -> usize {
    (extent / cell).ceil().clamp(16.0, 1024.0) as usize
}

/// Sum of the level-0 lattice sizes along the three world axes.
pub fn level0_rays(min: [f64; 3], max: [f64; 3], cell: f64) -> u64 {
    let [x, y, z] = std::array::from_fn(|axis| side_count(max[axis] - min[axis], cell) as u64);
    x * y + y * z + z * x
}

#[derive(Clone, Copy)]
struct Grid {
    axis: usize,
    plane: [usize; 2],
    size: [usize; 2],
    side: [f64; 2],
}

impl Grid {
    fn new(request: &LatticeRequest, axis: usize) -> Self {
        let plane = [(axis + 1) % 3, (axis + 2) % 3];
        let extent = plane.map(|i| request.max[i] - request.min[i]);
        let size = extent.map(|extent| side_count(extent, request.cell));
        let side = std::array::from_fn(|i| extent[i] / size[i] as f64);
        Self {
            axis,
            plane,
            size,
            side,
        }
    }

    fn small_loops(
        &self,
        request: &LatticeRequest,
        bounds: impl Iterator<Item = Bounds>,
    ) -> Vec<u8> {
        let [width, height] = self.size;
        let mut refinements = Vec::new();
        for (lo, hi) in bounds {
            let span = self.plane.map(|i| hi[i] - lo[i]);
            if (0..2).all(|i| span[i] >= SMALL_LOOP_CELLS * self.side[i]) {
                continue;
            }
            let [x, y] = self.plane;
            if hi[x] < request.min[x]
                || lo[x] > request.max[x]
                || hi[y] < request.min[y]
                || lo[y] > request.max[y]
            {
                continue;
            }
            let first: [usize; 2] = std::array::from_fn(|i| {
                let offset = lo[self.plane[i]] - request.min[self.plane[i]];
                ((offset / self.side[i]).ceil() as usize)
                    .saturating_sub(1)
                    .min(self.size[i] - 1)
            });
            let last: [usize; 2] = std::array::from_fn(|i| {
                let offset = hi[self.plane[i]] - request.min[self.plane[i]];
                ((offset / self.side[i]) as usize).min(self.size[i] - 1)
            });
            let ratio = (self.side[0] / span[0]).max(self.side[1] / span[1]);
            let divisions = (8.0 * ratio).ceil().clamp(8.0, 64.0) as u8;
            if refinements.is_empty() {
                refinements.resize(width * height, 0);
            }
            for row in first[1]..=last[1] {
                for value in &mut refinements[row * width + first[0]..=row * width + last[0]] {
                    *value = (*value).max(divisions);
                }
            }
        }
        refinements
    }
}

#[derive(Default)]
struct Scratch {
    crossings: Vec<Boundary>,
    tool: Intervals,
    next: Intervals,
    bodies: [Intervals; 2],
}

struct AxisFold {
    prisms: Vec<(PrismView, Bounds)>,
    steps: [Vec<(Op, Option<usize>)>; 2],
}

impl AxisFold {
    fn new(request: &LatticeRequest, grid: Grid, steps: &[Vec<Step>; 2], tools: &[Bounds]) -> Self {
        let mut forward = [0.0; 3];
        forward[grid.axis] = 1.0;
        let family = RayFamily { forward };
        let mut prisms = Vec::new();
        // Most pairs use only a small subset of the scene's tools.
        let mut indices = std::collections::HashMap::new();
        let steps = steps.each_ref().map(|steps| {
            steps
                .iter()
                .map(|step| {
                    let tool = step.tool as usize;
                    let index = indices.entry(tool).or_insert_with(|| {
                        let Tool::Prism(prism) = request.scene.tools.get(tool)? else {
                            return None;
                        };
                        if !valid_bounds(tools[tool]) {
                            return None;
                        }
                        let index = prisms.len();
                        prisms.push((PrismView::new(prism, step.tool, &family), tools[tool]));
                        Some(index)
                    });
                    (step.op, *index)
                })
                .collect()
        });
        Self { prisms, steps }
    }

    fn cast(
        &self,
        request: &LatticeRequest,
        grid: Grid,
        origin: [f64; 3],
        scratch: &mut Scratch,
    ) -> Stretch {
        let [x, y] = grid.plane;
        let ray = Ray { origin };
        let clip = [request.min[grid.axis], request.max[grid.axis]];
        for (steps, current) in self.steps.iter().zip(&mut scratch.bodies) {
            current.clear();
            for &(op, index) in steps {
                let prism = index.and_then(|i| {
                    let (prism, (min, max)) = &self.prisms[i];
                    (min[x] <= origin[x]
                        && origin[x] <= max[x]
                        && min[y] <= origin[y]
                        && origin[y] <= max[y])
                        .then_some(prism)
                });
                if let Some(prism) = prism {
                    prism.intervals(&ray, &mut scratch.crossings, &mut scratch.tool);
                    if scratch.tool.is_empty() && op != Op::Intersection {
                        continue;
                    }
                    combine(current, &scratch.tool, op, &mut scratch.next);
                    std::mem::swap(current, &mut scratch.next);
                } else if op == Op::Intersection {
                    current.clear();
                }
            }
            // The sampled volume is restricted to the lattice request even
            // when a caller requests only part of a single body.
            for boundary in current {
                boundary.s = boundary.s.clamp(clip[0], clip[1]);
            }
        }
        let [a, b] = &scratch.bodies;
        let stretch = if request.bodies.1.is_some() {
            overlap(a, b, request.tolerance)
        } else {
            let mut length = 0.0;
            let mut start = 0.0;
            let mut end = 0.0;
            for &[near, far] in a.as_chunks::<2>().0 {
                let span = far.s - near.s;
                if span > request.tolerance {
                    if length == 0.0 {
                        start = near.s;
                    }
                    length += span;
                    end = far.s;
                }
            }
            (length > 0.0).then_some((start, end, length))
        };
        stretch.map_or(Stretch::default(), |(start, end, length)| Stretch {
            start,
            end,
            length,
        })
    }
}

#[derive(Clone, Copy, Default)]
struct Stretch {
    start: f64,
    end: f64,
    length: f64,
}

impl Stretch {
    fn hit(self) -> bool {
        self.length > 0.0
    }
}

struct Accumulator {
    bounds: Bounds,
    volume: f64,
}

impl Accumulator {
    fn new() -> Self {
        Self {
            bounds: empty_bounds(),
            volume: 0.0,
        }
    }

    fn add(&mut self, grid: Grid, corner: [f64; 3], side: [f64; 2], sample: Stretch) {
        if sample.hit() {
            let mut min = corner;
            let mut max = corner;
            min[grid.axis] = sample.start;
            max[grid.axis] = sample.end;
            for (axis, length) in grid.plane.into_iter().zip(side) {
                max[axis] += length;
            }
            extend(&mut self.bounds, (min, max));
            self.volume += sample.length * side[0] * side[1];
        }
    }
}

struct AxisSampler<'a, 's> {
    request: &'a LatticeRequest<'s>,
    grid: Grid,
    fold: AxisFold,
    scratch: Scratch,
}

impl AxisSampler<'_, '_> {
    fn cast(&mut self, cell: [usize; 2], sub: [usize; 2], divisions: u8) -> ([f64; 3], Stretch) {
        let mut origin = [0.0; 3];
        let mut corner = origin;
        for (i, axis) in self.grid.plane.into_iter().enumerate() {
            let sub = sub[i] as f64 / f64::from(divisions);
            let half_step = 0.5 / f64::from(divisions);
            let min = self.request.min[axis];
            let side = self.grid.side[i];
            corner[axis] = min + (cell[i] as f64 + sub) * side;
            origin[axis] = min + (cell[i] as f64 + sub + half_step) * side;
        }
        (
            corner,
            self.fold
                .cast(self.request, self.grid, origin, &mut self.scratch),
        )
    }

    fn sample(mut self, small: &[u8], small_rays: u64, boundary_left: &mut u64) -> AxisSample {
        let grid = self.grid;
        let [width, height] = grid.size;
        let base = (0..height)
            .flat_map(|y| (0..width).map(move |x| [x, y]))
            .map(|cell| self.cast(cell, [0, 0], 1).1)
            .collect::<Vec<_>>();
        let mut result = Accumulator::new();
        let mut small_left = small_rays;
        let mut axis_left = AXIS_REFINEMENT_LIMIT - small_rays;
        let mut capped = false;
        for (index, &coarse) in base.iter().enumerate() {
            let [x, y] = [index % width, index / width];
            let boundary = (x > 0 && base[index - 1].hit() != coarse.hit())
                || (x + 1 < width && base[index + 1].hit() != coarse.hit())
                || (y > 0 && base[index - width].hit() != coarse.hit())
                || (y + 1 < height && base[index + width].hit() != coarse.hit());
            let marked = small.get(index).copied().unwrap_or(0);
            let divisions = marked.max(if boundary { BOUNDARY_DIVISIONS } else { 0 });
            let cost = u64::from(divisions) * u64::from(divisions);
            if cost == 0 {
                result.add(grid, self.corner([x, y]), grid.side, coarse);
                continue;
            }
            let refine = if marked != 0 {
                spend_prefix(&mut small_left, cost)
            } else if cost <= axis_left && cost <= *boundary_left {
                axis_left -= cost;
                *boundary_left -= cost;
                true
            } else {
                false
            };
            if !refine {
                capped = true;
                result.add(grid, self.corner([x, y]), grid.side, coarse);
                continue;
            }
            let side = grid.side.map(|side| side / f64::from(divisions));
            let mut refined_hit = false;
            for sy in 0..usize::from(divisions) {
                for sx in 0..usize::from(divisions) {
                    let (corner, stretch) = self.cast([x, y], [sx, sy], divisions);
                    refined_hit |= stretch.hit();
                    result.add(grid, corner, side, stretch);
                }
            }
            // An even subgrid does not revisit the centre. Keep the only
            // witness when all replacement rays miss a real coarse hit.
            if !refined_hit {
                result.add(grid, self.corner([x, y]), grid.side, coarse);
            }
        }
        debug_assert_eq!(small_left, 0);
        let hit = result.volume > 0.0;
        let (min, max) = if hit {
            result.bounds
        } else {
            (self.request.min, self.request.min)
        };
        AxisSample {
            hit,
            volume: result.volume,
            min,
            max,
            cell: grid.side[0].max(grid.side[1]),
            rays: base.len() as u64 + AXIS_REFINEMENT_LIMIT - axis_left,
            capped,
        }
    }

    fn corner(&self, cell: [usize; 2]) -> [f64; 3] {
        let mut corner = self.request.min;
        for (i, axis) in self.grid.plane.into_iter().enumerate() {
            corner[axis] += cell[i] as f64 * self.grid.side[i];
        }
        corner
    }
}

fn spend_prefix(left: &mut u64, cost: u64) -> bool {
    if let Some(remaining) = left.checked_sub(cost) {
        *left = remaining;
        true
    } else {
        *left = 0;
        false
    }
}

fn sample_axes<const N: usize>(
    request: &LatticeRequest,
    axes: [usize; N],
    loops: &[Vec<Bounds>],
    tools: &[Bounds],
    mut refinement_left: u64,
) -> [AxisSample; N] {
    let steps = [Some(request.bodies.0), request.bodies.1].map(|body| {
        body.and_then(|body| request.scene.bodies.get(body as usize))
            .into_iter()
            .flat_map(|body| &body.steps)
            .copied()
            .filter(|step| active_step(step, tools, (request.min, request.max)))
            .collect::<Vec<_>>()
    });
    let grids = axes.map(|axis| Grid::new(request, axis));
    let mut tool_ids = steps
        .iter()
        .flatten()
        .map(|step| step.tool)
        .collect::<Vec<_>>();
    tool_ids.sort_unstable();
    tool_ids.dedup();
    let small = grids.map(|grid| {
        let bounds = tool_ids
            .iter()
            .filter_map(|&index| loops.get(index as usize))
            .flatten()
            .copied();
        grid.small_loops(request, bounds)
    });
    // Reserve rays for small loops on all axes before any boundary
    // refinement can spend the pair's remaining allowance.
    let small_rays = small.each_ref().map(|cells| {
        let available = refinement_left.min(AXIS_REFINEMENT_LIMIT);
        let mut left = available;
        let mut spent = 0;
        for &divisions in cells.iter().filter(|&&n| n != 0) {
            let cost = u64::from(divisions) * u64::from(divisions);
            if !spend_prefix(&mut left, cost) {
                break;
            }
            spent += cost;
        }
        refinement_left -= spent;
        spent
    });
    std::array::from_fn(|i| {
        let grid = grids[i];
        AxisSampler {
            request,
            grid,
            fold: AxisFold::new(request, grid, &steps, tools),
            scratch: Scratch::default(),
        }
        .sample(&small[i], small_rays[i], &mut refinement_left)
    })
}

/// Sample one world axis with the per-axis refinement cap.
pub fn sample_axis(request: &LatticeRequest, axis: usize) -> AxisSample {
    let loops = tool_loops(request.scene);
    let tools = tool_bounds(&loops);
    let [result] = sample_axes(request, [axis], &loops, &tools, AXIS_REFINEMENT_LIMIT);
    result
}

pub(crate) fn sample_pair(
    request: &LatticeRequest,
    loops: &[Vec<Bounds>],
    tools: &[Bounds],
    refinement: u64,
) -> [AxisSample; 3] {
    sample_axes(request, [0, 1, 2], loops, tools, refinement)
}
