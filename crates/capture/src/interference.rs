//! Candidate planning and bounded, camera-independent interference analysis.

use std::thread;

use crate::lattice::{self, Bounds, LatticeRequest};
use crate::report::{Analysis, PairReport};
use crate::scene::{Op, Scene};
use crate::CaptureError;

const MIN_RAYS: u64 = 3 * 16 * 16;
const UNCHECKED_LIST_LIMIT: usize = 256;

#[derive(Clone, Copy, Debug)]
pub struct Candidate {
    pub a: u32,
    pub b: u32,
    pub min: [f64; 3],
    pub max: [f64; 3],
    pub weight: u64,
}

impl Candidate {
    fn work(&self, cell: f64) -> u64 {
        lattice::level0_rays(self.min, self.max, cell).saturating_mul(self.weight)
    }
}

/// The first `keep` candidates in body order and the number of all candidates.
pub fn candidates(scene: &Scene, boxes: &[Bounds], keep: usize) -> (Vec<Candidate>, u64) {
    let loops = lattice::tool_loops(scene);
    collect_candidates(scene, boxes, &lattice::tool_bounds(&loops), keep)
}

fn collect_candidates(
    scene: &Scene,
    boxes: &[Bounds],
    tools: &[Bounds],
    keep: usize,
) -> (Vec<Candidate>, u64) {
    let analysed = scene
        .bodies
        .iter()
        .zip(boxes)
        .enumerate()
        .filter(|&(_, (body, &bounds))| body.analysed && lattice::valid_bounds(bounds))
        .map(|(i, (_, &bounds))| (i, bounds))
        .collect::<Vec<_>>();
    let mut stored = Vec::new();
    let mut total = 0;
    for (index, &(a, (a_min, a_max))) in analysed.iter().enumerate() {
        for &(b, (b_min, b_max)) in &analysed[index + 1..] {
            let min = std::array::from_fn(|i| a_min[i].max(b_min[i]));
            let max = std::array::from_fn(|i| a_max[i].min(b_max[i]));
            if (0..3).any(|axis| max[axis] - min[axis] <= scene.tolerance) {
                continue;
            }
            total += 1;
            if stored.len() < keep {
                let steps = scene.bodies[a]
                    .steps
                    .iter()
                    .chain(&scene.bodies[b].steps)
                    .filter(|step| lattice::active_step(step, tools, (min, max)))
                    .count() as u64;
                stored.push(Candidate {
                    a: a as u32,
                    b: b as u32,
                    min,
                    max,
                    weight: steps.div_ceil(8).max(1),
                });
            }
        }
    }
    (stored, total)
}

/// Select one cell size for all checked pairs. An infinite nominal cell means
/// every side uses the minimum count of 16.
pub fn plan(candidates: &[Candidate], total: u64, target_cell: f64, budget: u64) -> (f64, usize) {
    let mut used = 0;
    let minimum_fits = candidates
        .iter()
        .take_while(|candidate| {
            let work = candidate.weight.saturating_mul(MIN_RAYS);
            if work > budget - used {
                return false;
            }
            used += work;
            true
        })
        .count();
    if (minimum_fits as u64) < total {
        return (f64::INFINITY, minimum_fits);
    }
    let mut cell = target_cell;
    loop {
        let work = candidates
            .iter()
            .fold(0u64, |sum, pair| sum.saturating_add(pair.work(cell)));
        if work <= budget {
            return (cell, candidates.len());
        }
        cell *= 2.0;
    }
}

struct PairSample {
    report: Option<PairReport>,
    cell: f64,
    capped: bool,
    #[cfg(test)]
    rays: u64,
}

/// Sample a pair with the given allowance of weighted refinement rays.
/// The detail report separately retains caps on candidates with no hits.
pub fn analyse_pair(
    scene: &Scene,
    candidate: &Candidate,
    cell: f64,
    refinement: u64,
) -> (Option<PairReport>, f64) {
    let loops = lattice::tool_loops(scene);
    let tools = lattice::tool_bounds(&loops);
    let result = sample(scene, candidate, cell, refinement, &loops, &tools);
    (result.report, result.cell)
}

fn sample(
    scene: &Scene,
    pair: &Candidate,
    cell: f64,
    refinement: u64,
    loops: &[Vec<Bounds>],
    tools: &[Bounds],
) -> PairSample {
    let request = LatticeRequest {
        scene,
        bodies: (pair.a, Some(pair.b)),
        min: pair.min,
        max: pair.max,
        cell,
        tolerance: scene.tolerance,
    };
    let axes = lattice::sample_pair(&request, loops, tools, refinement / pair.weight);
    let cell = axes.iter().map(|sample| sample.cell).fold(0.0, f64::max);
    let capped = axes.iter().any(|sample| sample.capped);
    let mut extent = lattice::empty_bounds();
    let mut volume = 0.0;
    let mut hits = 0;
    for axis in axes.iter().filter(|axis| axis.hit) {
        lattice::extend(&mut extent, (axis.min, axis.max));
        volume += axis.volume;
        hits += 1;
    }
    let rounded = |x: f64| (x * 1000.0).round() / 1000.0;
    let report = (hits != 0).then(|| PairReport {
        a: pair.a,
        b: pair.b,
        volume: volume / f64::from(hits),
        min: extent.0.map(rounded),
        max: extent.1.map(rounded),
        from_view: false,
        capped,
    });
    PairSample {
        report,
        cell,
        capped,
        #[cfg(test)]
        rays: axes.iter().map(|axis| axis.rays).sum(),
    }
}

fn allocate(budget: u64, work: u64, total_work: u64) -> u64 {
    ((u128::from(budget) * u128::from(work)) / u128::from(total_work)) as u64
}

pub(crate) fn analyse_scene(
    scene: &Scene,
    threads: usize,
) -> Result<(Analysis, Vec<PairReport>), CaptureError> {
    let budget = u64::from(scene.budget_million_rays) * 1_000_000;
    let loops = lattice::tool_loops(scene);
    let tools = lattice::tool_bounds(&loops);
    let boxes = scene
        .bodies
        .iter()
        .map(|body| {
            let mut bounds = lattice::empty_bounds();
            for step in body.steps.iter().filter(|step| step.op == Op::Union) {
                if let Some(&tool) = tools
                    .get(step.tool as usize)
                    .filter(|&&tool| lattice::valid_bounds(tool))
                {
                    lattice::extend(&mut bounds, tool);
                }
            }
            bounds
        })
        .collect::<Vec<_>>();
    let keep = (budget / MIN_RAYS) as usize + UNCHECKED_LIST_LIMIT;
    let (candidates, total) = collect_candidates(scene, &boxes, &tools, keep);
    let (cell, checked) = plan(&candidates, total, scene.target_cell, budget);
    let work = candidates[..checked]
        .iter()
        .map(|pair| pair.work(cell))
        .sum();
    let cast_pairs = |pairs: &[Candidate]| {
        pairs
            .iter()
            .map(|pair| {
                let allowance = allocate(budget, pair.work(cell), work);
                sample(scene, pair, cell, allowance, &loops, &tools)
            })
            .collect::<Vec<_>>()
    };
    let results = if checked < 2 || threads == 1 {
        cast_pairs(&candidates[..checked])
    } else {
        thread::scope(|scope| {
            let mut workers = Vec::new();
            for chunk in candidates[..checked].chunks(checked.div_ceil(threads)) {
                let worker = thread::Builder::new()
                    .spawn_scoped(scope, || cast_pairs(chunk))
                    .map_err(|err| {
                        CaptureError(format!("Cannot start interference worker: {err}."))
                    })?;
                workers.push(worker);
            }
            let mut samples = Vec::with_capacity(checked);
            for worker in workers {
                samples.extend(
                    worker
                        .join()
                        .map_err(|_| CaptureError("An interference worker failed.".into()))?,
                );
            }
            Ok(samples)
        })?
    };

    let mut pairs = Vec::new();
    let mut capped_count = 0;
    let mut capped_without_hit = Vec::new();
    let mut largest_cell: f64 = 0.0;
    for (candidate, result) in candidates.iter().zip(results) {
        largest_cell = largest_cell.max(result.cell);
        if result.capped {
            capped_count += 1;
            if result.report.is_none() {
                capped_without_hit.push((candidate.a, candidate.b));
            }
        }
        pairs.extend(result.report);
    }
    Ok((
        Analysis {
            cell: if checked == 0 {
                scene.target_cell
            } else {
                largest_cell
            },
            candidates: total as u32,
            checked: checked as u32,
            unchecked: candidates[checked..]
                .iter()
                .take(UNCHECKED_LIST_LIMIT)
                .map(|pair| (pair.a, pair.b))
                .collect(),
            unchecked_count: total as u32 - checked as u32,
            capped_count,
            capped_without_hit,
            budget,
        },
        pairs,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::scene::parse_scene;

    #[test]
    fn weighted_refinement_spends_no_more_than_its_proportional_allowances() {
        let scene = parse_scene(include_bytes!("../tests/fixtures/plate-iso.ncs1")).unwrap();
        let loops = lattice::tool_loops(&scene);
        let tools = lattice::tool_bounds(&loops);
        let candidates = [
            Candidate {
                a: 0,
                b: 1,
                min: [85.0, 45.0, 2.0],
                max: [100.0, 60.0, 5.0],
                weight: 3,
            },
            Candidate {
                a: 0,
                b: 2,
                min: [58.0, 28.0, 0.0],
                max: [71.0, 41.0, 4.0],
                weight: 1,
            },
        ];
        let (budget, cell) = (4_001, 1.0);
        let work: u64 = candidates.iter().map(|pair| pair.work(cell)).sum();
        let mut used = 0;
        let mut capped = false;
        for pair in &candidates {
            let level0 = pair.work(cell);
            let allowance = allocate(budget, level0, work);
            let sample = sample(&scene, pair, cell, allowance, &loops, &tools);
            let refined = sample.rays * pair.weight - level0;
            assert!(refined <= allowance);
            used += refined;
            capped |= sample.capped;
        }
        assert!(capped && used > 0 && used <= budget);
    }
}
