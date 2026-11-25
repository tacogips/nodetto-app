//! Camera-independent sampling of one or two folded prism bodies.

use crate::interval::{combine, overlap, Boundary, Intervals};
use crate::scene::{Op, Scene, Step};
use crate::tool_view::{ToolView, ViewCache};
use crate::view::Ray;

pub type Bounds = ([f64; 3], [f64; 3]);

const BOUNDARY_READS_PER_WEIGHTED_RAY: u64 = 64;
const SCAN_ENTRIES_PER_WEIGHTED_RAY: u64 = 1_024;
pub(crate) const REQUEST_TRIANGLE_ENTRIES_PER_BUDGET_RAY: u64 = 32;
pub(crate) fn request_triangles(budget_rays: u64) -> u64 {
    budget_rays.saturating_mul(REQUEST_TRIANGLE_ENTRIES_PER_BUDGET_RAY)
}

struct BoundaryBudget {
    reads: u64,
    scans: u64,
    triangles: u64,
    triangle_limit: u64,
    rays: u64,
    weight: u64,
    exhausted: bool,
}

impl BoundaryBudget {
    fn new(steps: usize) -> Self {
        Self {
            reads: 0,
            scans: 0,
            triangles: 0,
            triangle_limit: u64::MAX,
            rays: 0,
            weight: (steps as u64).div_ceil(8).max(1),
            exhausted: false,
        }
    }

    fn charge_scan(&mut self, count: usize, triangles: usize) -> bool {
        let next = self.scans.saturating_add(count as u64);
        let next_triangles = self.triangles.saturating_add(triangles as u64);
        let allowance = SCAN_ENTRIES_PER_WEIGHTED_RAY
            .saturating_mul(self.weight)
            .saturating_mul(self.rays.saturating_add(16));
        if next > allowance || next_triangles > self.triangle_limit {
            self.exhausted = true;
            false
        } else {
            self.scans = next;
            self.triangles = next_triangles;
            true
        }
    }

    fn charge(&mut self, count: usize) -> bool {
        let next = self.reads.saturating_add(count as u64);
        let allowance = BOUNDARY_READS_PER_WEIGHTED_RAY
            .saturating_mul(self.weight)
            .saturating_mul(self.rays.saturating_add(16));
        if next > allowance {
            self.exhausted = true;
            false
        } else {
            self.reads = next;
            true
        }
    }
}

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
    #[doc(hidden)]
    pub coarse_complete: bool,
    #[cfg(test)]
    pub coarse_casts: Vec<(u64, bool)>,
    #[doc(hidden)]
    pub boundary_exhausted: bool,
    #[doc(hidden)]
    pub boundary_reads: u64,
    #[doc(hidden)]
    pub triangles: u64,
}

/// Bounds of each swept loop, in world coordinates. Meshes enter analysis in M11.
pub(crate) fn tool_loops(scene: &Scene) -> Vec<Vec<Bounds>> {
    scene
        .tools
        .iter()
        .map(crate::tool_view::tool_loops)
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

pub(crate) fn body_boxes(scene: &Scene, tools: &[Bounds]) -> Vec<Bounds> {
    scene
        .bodies
        .iter()
        .map(|body| {
            let mut bounds = empty_bounds();
            for step in body.steps.iter().filter(|step| step.op == Op::Union) {
                if let Some(&tool) = tools
                    .get(step.tool as usize)
                    .filter(|&&tool| valid_bounds(tool))
                {
                    extend(&mut bounds, tool);
                }
            }
            bounds
        })
        .collect()
}

pub(crate) fn shares_extent(a: Bounds, b: Bounds) -> bool {
    (0..3).all(|axis| a.1[axis].min(b.1[axis]) - a.0[axis].max(b.0[axis]) > 0.0)
}

#[cfg(test)]
#[test]
fn shared_extent_requires_positive_overlap_on_every_axis() {
    let a = ([0.0; 3], [1.0; 3]);
    for axis in 0..3 {
        let mut min = [0.0; 3];
        min[axis] = 1.0;
        assert!(!shares_extent(a, (min, [2.0; 3])));
    }
    assert!(shares_extent(a, ([0.99; 3], [2.0; 3])));
    assert!(!shares_extent(a, empty_bounds()));
}

pub(crate) fn scene_tool_bounds(scene: &Scene) -> Vec<Bounds> {
    scene
        .tools
        .iter()
        .map(|tool| crate::tool_view::tool_bounds(tool).unwrap_or_else(empty_bounds))
        .collect()
}

pub(crate) fn active_step(step: &Step, tools: &[Bounds], (min, max): Bounds) -> bool {
    step.op == Op::Intersection
        || tools.get(step.tool as usize).is_some_and(|&(lo, hi)| {
            (0..3).all(|axis| lo[axis] <= max[axis] && hi[axis] >= min[axis])
        })
}

fn side_count(extent: f64, cell: f64) -> usize {
    ((extent / cell).ceil() as usize).clamp(16, 1024)
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

struct AxisFold<'a> {
    prisms: Vec<(&'a ToolView, Bounds)>,
    steps: [Vec<(Op, Option<usize>)>; 2],
}

impl<'a> AxisFold<'a> {
    fn new(
        request: &LatticeRequest,
        grid: Grid,
        steps: &[Vec<Step>; 2],
        tools: &[Bounds],
        cache: &'a ViewCache,
    ) -> Self {
        let mut prisms = Vec::new();
        // Most pairs use only a small subset of the scene's tools.
        let mut indices = std::collections::HashMap::new();
        let steps = steps.each_ref().map(|steps| {
            steps
                .iter()
                .map(|step| {
                    let tool = step.tool as usize;
                    let index = indices.entry(tool).or_insert_with(|| {
                        let source = request.scene.tools.get(tool)?;
                        if !valid_bounds(tools[tool]) {
                            return None;
                        }
                        let index = prisms.len();
                        prisms.push((cache.get(source, tool, grid.axis), tools[tool]));
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
        budget: &mut BoundaryBudget,
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
                    if !budget.charge_scan(prism.scan_cost(&ray), prism.triangle_cost(&ray)) {
                        return Stretch::default();
                    }
                    prism.intervals(&ray, &mut scratch.crossings, &mut scratch.tool);
                    if scratch.tool.is_empty() && op != Op::Intersection {
                        continue;
                    }
                    if !budget.charge(current.len()) {
                        return Stretch::default();
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
    fold: AxisFold<'a>,
    scratch: Scratch,
}

impl AxisSampler<'_, '_> {
    fn cast(
        &mut self,
        cell: [usize; 2],
        sub: [usize; 2],
        divisions: u8,
        budget: &mut BoundaryBudget,
    ) -> ([f64; 3], Stretch) {
        budget.rays += 1;
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
                .cast(self.request, self.grid, origin, &mut self.scratch, budget),
        )
    }

    fn sample(
        mut self,
        small: &[u8],
        small_rays: u64,
        boundary_left: &mut u64,
        budget: &mut BoundaryBudget,
    ) -> AxisSample {
        let grid = self.grid;
        let [width, height] = grid.size;
        let start_reads = budget.reads;
        let start_triangles = budget.triangles;
        let start_rays = budget.rays;
        let mut rows = [Vec::new(), Vec::new(), Vec::new()];
        let mut coarse_ok = 0usize;
        #[cfg(test)]
        let mut coarse_casts = Vec::new();
        let mut last_loaded = 0usize;
        let mut pending = (0usize, 0usize);
        for (y, row) in rows.iter_mut().enumerate().take(height.min(2)) {
            for x in 0..width {
                if budget.exhausted {
                    break;
                }
                let coarse = self.cast([x, y], [0, 0], 1, budget).1;
                if !budget.exhausted {
                    coarse_ok += 1;
                    #[cfg(test)]
                    coarse_casts.push((budget.triangles, coarse.hit()));
                    row.push(coarse);
                }
                last_loaded = y;
            }
        }
        let mut result = Accumulator::new();
        let mut small_left = small_rays;
        let mut axis_left = AXIS_REFINEMENT_LIMIT - small_rays;
        let mut capped = false;
        'sampling: for y in 0..height {
            if budget.exhausted {
                break;
            }
            if y + 1 < height && y > 0 {
                let mut row = Vec::with_capacity(width);
                for x in 0..width {
                    if budget.exhausted {
                        break;
                    }
                    let coarse = self.cast([x, y + 1], [0, 0], 1, budget).1;
                    if !budget.exhausted {
                        coarse_ok += 1;
                        #[cfg(test)]
                        coarse_casts.push((budget.triangles, coarse.hit()));
                        row.push(coarse);
                    }
                    last_loaded = y + 1;
                }
                rows[(y + 1) % 3] = row;
                if budget.exhausted {
                    break;
                }
            }
            for x in 0..width {
                let index = y * width + x;
                let coarse = rows[y % 3][x];
                let boundary = (x > 0 && rows[y % 3][x - 1].hit() != coarse.hit())
                    || (x + 1 < width && rows[y % 3][x + 1].hit() != coarse.hit())
                    || (y > 0 && rows[(y - 1) % 3][x].hit() != coarse.hit())
                    || (y + 1 < height && rows[(y + 1) % 3][x].hit() != coarse.hit());
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
                        let (corner, stretch) = self.cast([x, y], [sx, sy], divisions, budget);
                        if budget.exhausted {
                            if !refined_hit {
                                result.add(grid, self.corner([x, y]), grid.side, coarse);
                            }
                            pending = (y, x + 1);
                            break 'sampling;
                        }
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
            pending = (y + 1, 0);
        }
        if budget.exhausted {
            for y in pending.0..=last_loaded {
                let start = if y == pending.0 { pending.1 } else { 0 };
                for (x, &coarse) in rows[y % 3].iter().enumerate().skip(start) {
                    result.add(grid, self.corner([x, y]), grid.side, coarse);
                }
            }
        }
        debug_assert!(budget.exhausted || small_left == 0);
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
            rays: budget.rays - start_rays,
            capped: capped || budget.exhausted,
            coarse_complete: coarse_ok == width * height,
            #[cfg(test)]
            coarse_casts,
            boundary_exhausted: budget.exhausted,
            boundary_reads: budget.reads - start_reads,
            triangles: budget.triangles - start_triangles,
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
    triangle_limit: u64,
    cache: &ViewCache,
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
    let mut budget = BoundaryBudget::new(steps.iter().map(Vec::len).sum());
    budget.triangle_limit = triangle_limit;
    std::array::from_fn(|i| {
        if budget.exhausted {
            let mut result = empty_sample(request);
            result.capped = true;
            result.boundary_exhausted = true;
            return result;
        }
        let grid = grids[i];
        AxisSampler {
            request,
            grid,
            fold: AxisFold::new(request, grid, &steps, tools, cache),
            scratch: Scratch::default(),
        }
        .sample(&small[i], small_rays[i], &mut refinement_left, &mut budget)
    })
}

fn valid_request(request: &LatticeRequest) -> bool {
    !request.cell.is_nan()
        && request.cell > 0.0
        && (0..3).all(|i| {
            request.min[i].is_finite()
                && request.max[i].is_finite()
                && request.min[i] < request.max[i]
        })
}

fn empty_sample(request: &LatticeRequest) -> AxisSample {
    AxisSample {
        hit: false,
        volume: 0.0,
        min: request.min,
        max: request.min,
        cell: 0.0,
        rays: 0,
        capped: false,
        coarse_complete: false,
        #[cfg(test)]
        coarse_casts: Vec::new(),
        boundary_exhausted: false,
        boundary_reads: 0,
        triangles: 0,
    }
}

/// Sample one world axis with the per-axis refinement cap.
pub fn sample_axis(request: &LatticeRequest, axis: usize) -> AxisSample {
    if axis > 2 || !valid_request(request) {
        return empty_sample(request);
    }
    let loops = tool_loops(request.scene);
    let tools = scene_tool_bounds(request.scene);
    let cache = ViewCache::new(crate::tool_view::classify(request.scene));
    let [result] = sample_axes(
        request,
        [axis],
        &loops,
        &tools,
        AXIS_REFINEMENT_LIMIT,
        u64::MAX,
        &cache,
    );
    result
}

pub(crate) fn sample_pair(
    request: &LatticeRequest,
    loops: &[Vec<Bounds>],
    tools: &[Bounds],
    refinement: u64,
    triangle_limit: u64,
    cache: &ViewCache,
) -> [AxisSample; 3] {
    if !valid_request(request) {
        return std::array::from_fn(|_| empty_sample(request));
    }
    sample_axes(
        request,
        [0, 1, 2],
        loops,
        tools,
        refinement,
        triangle_limit,
        cache,
    )
}

/// Sample one body and retain a material witness for every original step.
/// `budget_left` counts actual rays; the caller converts weighted allowance.
pub fn sample_body_axis(
    request: &LatticeRequest,
    axis: usize,
    liveness: &mut crate::census::Liveness,
    budget_left: &mut u64,
) -> AxisSample {
    let mut triangles_left = u64::MAX;
    sample_body_axis_with(
        request,
        axis,
        liveness,
        budget_left,
        &mut triangles_left,
        &crate::tool_view::classify(request.scene),
    )
}

pub(crate) fn sample_body_axis_with(
    request: &LatticeRequest,
    axis: usize,
    liveness: &mut crate::census::Liveness,
    budget_left: &mut u64,
    triangles_left: &mut u64,
    solid: &[bool],
) -> AxisSample {
    if axis > 2
        || request.bodies.1.is_some()
        || !request.cell.is_finite()
        || !valid_request(request)
        || !(0..3).all(|i| (request.max[i] - request.min[i]).is_finite())
    {
        return empty_sample(request);
    }
    let index = request.bodies.0 as usize;
    let Some(body) = request.scene.bodies.get(index).or_else(|| {
        index
            .checked_sub(request.scene.bodies.len())
            .and_then(|i| request.scene.hidden.get(i))
    }) else {
        return empty_sample(request);
    };
    let grid = Grid::new(request, axis);
    let mut ids: Vec<_> = body.steps.iter().map(|step| step.tool).collect();
    ids.sort_unstable();
    ids.dedup();
    let slots: Vec<_> = ids
        .iter()
        .map(|&id| {
            let tool = request.scene.tools.get(id as usize);
            let bounds = tool
                .filter(|_| solid.get(id as usize).copied().unwrap_or(false))
                .and_then(crate::tool_view::tool_bounds);
            (tool, bounds, std::sync::OnceLock::<ToolView>::new())
        })
        .collect();
    let step_slots: Vec<_> = body
        .steps
        .iter()
        .map(|step| ids.binary_search(&step.tool).ok())
        .collect();
    let loops: Vec<_> = slots
        .iter()
        .flat_map(|(tool, _, _)| {
            tool.iter()
                .flat_map(|tool| crate::tool_view::tool_loops(tool))
        })
        .collect();
    let small = grid.small_loops(request, loops.into_iter());
    let mut forward = [0.0; 3];
    forward[axis] = 1.0;
    let family = crate::view::RayFamily { forward };
    let mut scratch = Scratch::default();
    let mut rays = 0u64;
    let mut any_hit = false;
    let mut boundary_budget = BoundaryBudget::new(body.steps.len());
    boundary_budget.triangle_limit = *triangles_left;
    let mut marks = Vec::new();
    let mut cast = |x: usize, y: usize, sx: usize, sy: usize, divisions: usize| {
        boundary_budget.rays += 1;
        marks.clear();
        let mut origin = [0.0; 3];
        for (i, axis) in grid.plane.into_iter().enumerate() {
            let (cell, sub) = if i == 0 { (x, sx) } else { (y, sy) };
            origin[axis] = request.min[axis]
                + (cell as f64 + (sub as f64 + 0.5) / divisions as f64) * grid.side[i];
        }
        let ray = Ray { origin };
        scratch.bodies[0].clear();
        for (i, step) in body.steps.iter().enumerate() {
            let index = step.tool as usize;
            let view = step_slots[i]
                .and_then(|slot| slots.get(slot))
                .and_then(|(tool, bounds, cache)| {
                    tool.zip(*bounds)
                        .map(|(tool, bounds)| (tool, bounds, cache))
                })
                .and_then(|(tool, (lo, hi), cache)| {
                    let [a, b] = grid.plane;
                    (lo[a] <= origin[a]
                        && origin[a] <= hi[a]
                        && lo[b] <= origin[b]
                        && origin[b] <= hi[b])
                        .then(|| {
                            cache.get_or_init(|| {
                                ToolView::classified(tool, index as u32, &family, solid[index])
                            })
                        })
                });
            if let Some(view) = view {
                if !boundary_budget.charge_scan(view.scan_cost(&ray), view.triangle_cost(&ray)) {
                    return (false, false, true);
                }
                view.intervals(&ray, &mut scratch.crossings, &mut scratch.tool);
                if !boundary_budget.charge(scratch.bodies[0].len()) {
                    return (false, false, true);
                }
                combine(
                    &scratch.bodies[0],
                    &scratch.tool,
                    step.op,
                    &mut scratch.next,
                );
                std::mem::swap(&mut scratch.bodies[0], &mut scratch.next);
            } else if step.op == Op::Intersection {
                scratch.bodies[0].clear();
            }
            let material = scratch.bodies[0]
                .as_chunks::<2>()
                .0
                .iter()
                .any(|[near, far]| {
                    far.s.min(request.max[axis]) - near.s.max(request.min[axis]) > 0.0
                });
            if material {
                marks.push(i);
            }
        }
        for &i in &marks {
            liveness.mark(i, i + 1);
        }
        let hit = scratch.bodies[0]
            .as_chunks::<2>()
            .0
            .iter()
            .any(|[near, far]| far.s.min(request.max[axis]) - near.s.max(request.min[axis]) > 0.0);
        any_hit |= hit;
        (
            hit,
            liveness
                .alive_after
                .iter()
                .take(body.steps.len())
                .all(|&alive| alive)
                && liveness.alive_after.len() >= body.steps.len(),
            false,
        )
    };
    let [width, height] = grid.size;
    let mut coarse = vec![false; width * height];
    let mut exhausted = false;
    let mut complete = false;
    'coarse: for y in 0..height {
        for x in 0..width {
            if *budget_left == 0 {
                exhausted = true;
                break 'coarse;
            }
            *budget_left -= 1;
            rays += 1;
            let (hit, done, boundary_exhausted) = cast(x, y, 0, 0, 1);
            if boundary_exhausted {
                *budget_left = 0;
                exhausted = true;
                break 'coarse;
            }
            coarse[y * width + x] = hit;
            if done {
                complete = true;
                break 'coarse;
            }
        }
    }
    let coarse_complete = !exhausted;
    if !exhausted && !complete {
        let mut refined = 0u64;
        'refine: for small_pass in [true, false] {
            for y in 0..height {
                for x in 0..width {
                    let hit = coarse[y * width + x];
                    let boundary = (x > 0 && coarse[y * width + x - 1] != hit)
                        || (x + 1 < width && coarse[y * width + x + 1] != hit)
                        || (y > 0 && coarse[(y - 1) * width + x] != hit)
                        || (y + 1 < height && coarse[(y + 1) * width + x] != hit);
                    let marked = small.get(y * width + x).copied().unwrap_or(0);
                    let n = usize::from(if small_pass {
                        marked
                    } else if marked == 0 && boundary {
                        BOUNDARY_DIVISIONS
                    } else {
                        0
                    });
                    if n == 0 {
                        continue;
                    }
                    for sy in 0..n {
                        for sx in 0..n {
                            if *budget_left == 0 || refined == AXIS_REFINEMENT_LIMIT {
                                exhausted = true;
                                break 'refine;
                            }
                            *budget_left -= 1;
                            rays += 1;
                            refined += 1;
                            let (_, done, boundary_exhausted) = cast(x, y, sx, sy, n);
                            if boundary_exhausted {
                                *budget_left = 0;
                                exhausted = true;
                                break 'refine;
                            }
                            if done {
                                break 'refine;
                            }
                        }
                    }
                }
            }
        }
    }
    *triangles_left = triangles_left.saturating_sub(boundary_budget.triangles);
    AxisSample {
        hit: any_hit,
        volume: 0.0,
        min: request.min,
        max: request.max,
        cell: grid.side[0].max(grid.side[1]),
        rays,
        capped: exhausted,
        coarse_complete,
        #[cfg(test)]
        coarse_casts: Vec::new(),
        boundary_exhausted: boundary_budget.exhausted,
        boundary_reads: boundary_budget.reads,
        triangles: boundary_budget.triangles,
    }
}

#[cfg(test)]
mod scan_tests {
    use super::*;
    use crate::scene::{Body, Mesh, Op, Step, Tool};
    use crate::tool_view::{
        reset_scan_visits, reset_triangle_visits, scan_visits, triangle_visits,
    };

    fn stacked() -> Scene {
        let mut positions = Vec::new();
        let mut triangles = Vec::new();
        let vertices = [
            0., 0., 0., 10., 0., 0., 10., 10., 0., 0., 10., 0., 0., 0., 0.01, 10., 0., 0.01, 10.,
            10., 0.01, 0., 10., 0.01,
        ];
        let faces = [
            0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7,
            6, 3, 0, 4, 3, 4, 7,
        ];
        for i in 0..2048 {
            positions.extend(vertices);
            triangles.extend(faces.map(|x| x + i * 8));
        }
        let mut scene =
            crate::scene::parse_scene(include_bytes!("../tests/fixtures/plate-iso.ncs1")).unwrap();
        scene.tools = vec![
            Tool::Mesh(Mesh {
                positions: positions.clone(),
                triangles: triangles.clone(),
            }),
            Tool::Mesh(Mesh {
                positions,
                triangles,
            }),
        ];
        let body = |tool| Body {
            reference: false,
            analysed: true,
            steps: vec![
                Step {
                    op: Op::Union,
                    tool,
                },
                Step {
                    op: Op::Difference,
                    tool,
                },
            ],
        };
        scene.bodies = vec![body(0), body(1)];
        scene
    }

    #[test]
    fn exhausted_preload_preserves_one_coarse_cell() {
        let mut scene = stacked();
        for tool in &mut scene.tools {
            let Tool::Mesh(mesh) = tool else {
                unreachable!()
            };
            mesh.positions.truncate(24);
            mesh.triangles.truncate(36);
            for p in mesh.positions.as_chunks_mut::<3>().0 {
                p[0] *= 0.4;
                p[1] *= 0.4;
                p[2] *= 400.0;
            }
        }
        for body in &mut scene.bodies {
            body.steps.truncate(1);
        }
        let request = LatticeRequest {
            scene: &scene,
            bodies: (0, Some(1)),
            min: [0.0; 3],
            max: [4.0; 3],
            cell: 1.0,
            tolerance: 0.0001,
        };
        let loops = tool_loops(&scene);
        let tools = scene_tool_bounds(&scene);
        let cache = ViewCache::new(crate::tool_view::classify(&scene));
        let run = |limit| sample_pair(&request, &loops, &tools, 0, limit, &cache);
        let full = run(u64::MAX);
        assert_eq!(full[0].cell, 0.25);
        assert!(full[0].coarse_casts.iter().all(|&(_, hit)| hit));
        let cut = run(full[0].coarse_casts[0].0);
        assert_eq!(cut[0].coarse_casts.len(), 1);
        assert!(cut[0].hit && cut[0].capped && !cut[0].coarse_complete);
        assert!((cut[0].volume - 0.25).abs() <= 1e-9, "{}", cut[0].volume);
    }

    fn disjoint_slabs() -> Scene {
        let mut scene = stacked();
        for (index, tool) in scene.tools.iter_mut().enumerate() {
            let Tool::Mesh(mesh) = tool else {
                unreachable!()
            };
            mesh.positions.truncate(24);
            mesh.triangles.truncate(36);
            for p in mesh.positions.as_chunks_mut::<3>().0 {
                let old = *p;
                *p = [
                    index as f64 * 2.0 + old[2] * 50.0,
                    old[0] * 0.4,
                    old[1] * 0.4,
                ];
            }
        }
        for body in &mut scene.bodies {
            body.steps.truncate(1);
        }
        scene
    }

    #[test]
    fn exhausted_coarse_miss_has_no_complete_axis() {
        let scene = disjoint_slabs();
        let request = LatticeRequest {
            scene: &scene,
            bodies: (0, Some(1)),
            min: [0.0; 3],
            max: [4.0; 3],
            cell: 1.0,
            tolerance: 0.0001,
        };
        let loops = tool_loops(&scene);
        let tools = scene_tool_bounds(&scene);
        let cache = ViewCache::new(crate::tool_view::classify(&scene));
        let run = |limit| sample_pair(&request, &loops, &tools, 0, limit, &cache);
        let full = run(u64::MAX);
        let casts = &full[0].coarse_casts;
        assert!(casts.last().unwrap().0 > casts[casts.len() - 2].0);
        let cut = run(casts[casts.len() - 2].0);
        assert!(!cut[0].hit && cut[0].capped && !cut[0].coarse_complete);
        assert!(cut.iter().all(|axis| !axis.hit && !axis.coarse_complete));
    }

    #[test]
    fn refinement_exhaustion_keeps_completed_coarse_coverage() {
        let scene = disjoint_slabs();
        let request = LatticeRequest {
            scene: &scene,
            bodies: (0, Some(1)),
            min: [0.0; 3],
            max: [4.0; 3],
            cell: 1.0,
            tolerance: 0.0001,
        };
        let tools = scene_tool_bounds(&scene);
        let cache = ViewCache::new(crate::tool_view::classify(&scene));
        let grid = Grid::new(&request, 0);
        let steps = [scene.bodies[0].steps.clone(), scene.bodies[1].steps.clone()];
        let mut small = vec![0; grid.size[0] * grid.size[1]];
        *small.last_mut().unwrap() = 2;
        let run = |limit| {
            let mut budget = BoundaryBudget::new(2);
            budget.triangle_limit = limit;
            let mut left = 0;
            AxisSampler {
                request: &request,
                grid,
                fold: AxisFold::new(&request, grid, &steps, &tools, &cache),
                scratch: Scratch::default(),
            }
            .sample(&small, 4, &mut left, &mut budget)
        };
        let full = run(u64::MAX);
        assert!(full.coarse_casts.last().unwrap().0 < full.triangles);
        let cut = run(full.triangles - 1);
        assert!(!cut.hit && cut.capped && cut.coarse_complete);
    }

    #[test]
    fn prism_scan_control_pin() {
        use crate::scene::{Loop, Prism};
        let mut scene = stacked();
        let loops = (0..32)
            .map(|i| {
                let x = i as f64 * 4.0;
                Loop {
                    points: vec![x, 0.0, x + 2.0, 0.0, x + 2.0, 128.0, x, 128.0],
                    faces: vec![0; 4],
                }
            })
            .collect();
        scene.tools = vec![Tool::Prism(Prism {
            o: [0.0; 3],
            u: [1.0, 0.0, 0.0],
            v: [0.0, 1.0, 0.0],
            n: [0.0, 0.0, 1.0],
            t0: 0.0,
            t1: 128.0,
            loops,
        })];
        scene.bodies = (0..2)
            .map(|_| Body {
                reference: false,
                analysed: true,
                steps: vec![Step {
                    op: Op::Union,
                    tool: 0,
                }],
            })
            .collect();
        scene.budget_million_rays = 1;
        scene.target_cell = 0.25;
        let solid = crate::tool_view::classify(&scene);
        reset_scan_visits();
        reset_triangle_visits();
        let (analysis, pairs) = crate::interference::analyse_scene_with(&scene, 1, &solid).unwrap();
        println!(
            "prism visits={} analysis={analysis:?} pairs={pairs:?}",
            scan_visits()
        );
        assert_eq!(pairs.len(), 1);
        assert_eq!(pairs[0].min, [0.0, 0.0, 0.0]);
        assert_eq!(pairs[0].max, [126.0, 128.0, 128.0]);
        assert!(pairs[0].capped);
        assert_eq!(scan_visits(), 74_235_264);
        assert_eq!(triangle_visits(), 0);
    }

    fn moderate_scene(size: f64) -> Scene {
        let mut scene = stacked();
        let Tool::Mesh(mesh) = &mut scene.tools[0] else {
            unreachable!()
        };
        mesh.positions.clear();
        mesh.triangles.clear();
        let vertices = [
            0., 0., 0., 128., 0., 0., 128., 128., 0., 0., 128., 0., 0., 0., 0.125, 128., 0., 0.125,
            128., 128., 0.125, 0., 128., 0.125,
        ];
        let faces = [
            0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7,
            6, 3, 0, 4, 3, 4, 7,
        ];
        for i in 0..40 {
            for p in vertices.as_chunks::<3>().0 {
                mesh.positions.extend([
                    p[0] * size / 128.0,
                    p[1] * size / 128.0,
                    p[2] + i as f64 * 0.25,
                ]);
            }
            mesh.triangles.extend(faces.map(|v| v + i * 8));
        }
        scene.tools.truncate(1);
        scene.bodies = (0..4)
            .map(|_| Body {
                reference: false,
                analysed: true,
                steps: vec![Step {
                    op: Op::Union,
                    tool: 0,
                }],
            })
            .collect();
        scene.budget_million_rays = 1;
        scene.target_cell = 0.25;
        scene
    }

    #[test]
    fn moderate_mesh_analysis_obeys_request_triangle_ceiling() {
        let scene = moderate_scene(128.0);
        let solid = crate::tool_view::classify(&scene);
        reset_triangle_visits();
        let (analysis, _) = crate::interference::analyse_scene_with(&scene, 1, &solid).unwrap();
        let visits = triangle_visits();
        println!(
            "moderate analysis visits={visits} capped={}",
            analysis.capped_count
        );
        assert!(visits <= 32 * 1_000_000 / 2);
        assert!(analysis.capped_count > 0);
    }

    #[test]
    fn phase_allowances_carry_over_between_bodies_and_view_pairs() {
        use crate::census::{resolve_hidden, resolve_with, Liveness};
        use crate::interference::{add_view_pairs_with, ViewPair};
        use crate::report::{BodyReport, BodyState};
        let mut scene = moderate_scene(22.0);
        let Tool::Mesh(large) = moderate_scene(128.0).tools.remove(0) else {
            unreachable!()
        };
        scene.tools.push(Tool::Mesh(large));
        for tool in &mut scene.tools {
            if let Tool::Mesh(mesh) = tool {
                mesh.positions.truncate(16 * 24);
                mesh.triangles.truncate(16 * 36);
            }
        }
        let body = |tool| Body {
            reference: false,
            analysed: true,
            steps: vec![
                Step {
                    op: Op::Union,
                    tool,
                },
                Step {
                    op: Op::Difference,
                    tool,
                },
            ],
        };
        scene.bodies = vec![body(0), body(1)];
        let solid = crate::tool_view::classify(&scene);
        let make_reports = || {
            vec![
                BodyReport {
                    state: BodyState::Absent,
                    emptied_by_step: -1,
                    open: false
                };
                2
            ]
        };
        let mut reports = make_reports();
        reset_triangle_visits();
        let finisher_stats = resolve_with(&scene, &mut reports[..1], &[], 0.25, 1_000_000, &solid);
        assert!(finisher_stats.rays < 500_000);
        let visible_e = triangle_visits();
        println!("visible finisher={visible_e}");
        let mut reports = make_reports();
        reset_triangle_visits();
        let stats = resolve_with(
            &scene,
            &mut reports,
            &[Liveness::new(2), Liveness::new(2)],
            0.25,
            1_000_000,
            &solid,
        );
        println!("stats={stats:?}");
        let visible = triangle_visits();
        println!("visible visits={visible} reports={reports:?}");
        assert!((2_000_000..=4_000_000).contains(&visible_e));
        assert!(visible <= 8_000_000 && visible > visible_e);
        assert_eq!(reports[0].state, BodyState::Empty);
        assert_eq!(reports[0].emptied_by_step, 1);
        assert_eq!(reports[1].state, BodyState::Unknown);
        assert_eq!(reports[1].emptied_by_step, -1);

        let Tool::Mesh(mut small) = moderate_scene(16.0).tools.remove(0) else {
            unreachable!()
        };
        small.positions.truncate(16 * 24);
        small.triangles.truncate(16 * 36);
        scene.tools[0] = Tool::Mesh(small);
        scene.hidden = vec![body(0), body(1)];
        scene.hidden.pop();
        reset_triangle_visits();
        let _ = resolve_hidden(&scene, &make_reports(), 0.25, 1_000_000, &solid);
        let hidden_e = triangle_visits();
        println!("hidden finisher={hidden_e}");
        scene.hidden.push(body(1));
        reset_triangle_visits();
        let hidden = resolve_hidden(&scene, &make_reports(), 0.25, 1_000_000, &solid);
        let hidden_visits = triangle_visits();
        println!("hidden visits={hidden_visits} attributed={hidden:?}");
        assert!((1_000_000..=2_000_000).contains(&hidden_e));
        assert!(hidden_visits <= 4_000_000 && hidden_visits > hidden_e);
        assert_eq!(hidden, vec![Some(1), None]);

        let scene = moderate_scene(128.0);
        let solid = crate::tool_view::classify(&scene);
        reset_triangle_visits();
        let (analysis, analysed_pairs) =
            crate::interference::analyse_scene_with(&scene, 1, &solid).unwrap();
        let analysis_visits = triangle_visits();
        assert!(analysis_visits <= 16_000_000 && analysis.capped_count > 0);
        assert_eq!(
            analysis.capped_count as usize,
            analysis.capped_without_hit.len() + analysed_pairs.iter().filter(|p| p.capped).count()
        );
        let seen = [
            ViewPair {
                a: 0,
                b: 1,
                min: [0.0, 0.0, 0.0],
                max: [128.0, 128.0, 9.875],
            },
            ViewPair {
                a: 2,
                b: 3,
                min: [0.0, 0.0, 0.0],
                max: [128.0, 128.0, 9.875],
            },
        ];
        reset_triangle_visits();
        let mut pairs = Vec::new();
        add_view_pairs_with(&scene, &mut pairs, &seen, 0.25, &solid);
        let view_visits = triangle_visits();
        println!("view visits={view_visits} pairs={pairs:?}");
        assert!(view_visits <= 4_000_000);
        assert_eq!(pairs.len(), 2);
        assert!(pairs.iter().all(|p| p.from_view && p.capped));
        assert!(visible + analysis_visits + hidden_visits + view_visits <= 32_000_000);
    }

    #[test]
    fn stacked_scans_are_bounded_for_pair_and_census() {
        let scene = stacked();
        let request = LatticeRequest {
            scene: &scene,
            bodies: (0, Some(1)),
            min: [0.; 3],
            max: [10., 10., 0.01],
            cell: 1.,
            tolerance: 0.0001,
        };
        let solid = crate::tool_view::classify(&scene);
        let cache = ViewCache::new(solid.clone());
        reset_scan_visits();
        let samples = sample_pair(
            &request,
            &tool_loops(&scene),
            &scene_tool_bounds(&scene),
            AXIS_REFINEMENT_LIMIT,
            u64::MAX,
            &cache,
        );
        let visits = scan_visits();
        let rays: u64 = samples.iter().map(|s| s.rays).sum();
        println!("pair visits={visits} rays={rays}");
        assert!(samples.iter().any(|s| s.capped));
        assert!(visits <= 1024 * (rays + 16) && visits < 1_000_000);
        reset_scan_visits();
        let mut live = crate::census::Liveness::new(2);
        let mut budget = 2_000_000;
        let mut triangles_left = u64::MAX;
        let sample = sample_body_axis_with(
            &LatticeRequest {
                bodies: (0, None),
                ..request
            },
            2,
            &mut live,
            &mut budget,
            &mut triangles_left,
            &solid,
        );
        let visits = scan_visits();
        println!("census visits={visits} rays={}", sample.rays);
        assert!(sample.capped);
        assert!(visits <= 1024 * (sample.rays + 16) && visits < 1_000_000);
    }
}
