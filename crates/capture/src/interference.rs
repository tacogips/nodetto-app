//! Candidate planning and bounded, camera-independent interference analysis.

use std::thread;

use crate::lattice::{self, Bounds, LatticeRequest};
use crate::report::{Analysis, PairReport};
use crate::scene::{Op, Scene};
use crate::tool_view::ViewCache;
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
    collect_candidates(
        scene,
        boxes,
        &lattice::scene_tool_bounds(scene),
        keep,
        &crate::tool_view::classify(scene),
    )
}

#[doc(hidden)]
pub fn candidate_comparisons(
    scene: &Scene,
    boxes: &[Bounds],
    keep: usize,
) -> (Vec<Candidate>, u64, u64) {
    collect_candidates_impl::<true>(
        scene,
        boxes,
        &lattice::scene_tool_bounds(scene),
        keep,
        &crate::tool_view::classify(scene),
    )
}

fn collect_candidates(
    scene: &Scene,
    boxes: &[Bounds],
    tools: &[Bounds],
    keep: usize,
    solid: &[bool],
) -> (Vec<Candidate>, u64) {
    let (candidates, total, _) = collect_candidates_impl::<false>(scene, boxes, tools, keep, solid);
    (candidates, total)
}

fn collect_candidates_impl<const COUNT: bool>(
    scene: &Scene,
    boxes: &[Bounds],
    tools: &[Bounds],
    keep: usize,
    solid: &[bool],
) -> (Vec<Candidate>, u64, u64) {
    let analysed = scene
        .bodies
        .iter()
        .zip(boxes)
        .enumerate()
        .filter(|&(_, (body, &bounds))| {
            body.analysed
                && lattice::valid_bounds(bounds)
                && body
                    .steps
                    .first()
                    .and_then(|step| solid.get(step.tool as usize))
                    .copied()
                    .unwrap_or(false)
        })
        .map(|(i, (_, &bounds))| (i, bounds))
        .collect::<Vec<_>>();
    let mut best_axis = 0;
    let mut best_count = u64::MAX;
    for axis in 0..3 {
        let mut starts = analysed
            .iter()
            .map(|(_, (min, _))| min[axis])
            .collect::<Vec<_>>();
        let mut ends = analysed
            .iter()
            .map(|(_, (_, max))| max[axis])
            .collect::<Vec<_>>();
        starts.sort_unstable_by(f64::total_cmp);
        ends.sort_unstable_by(f64::total_cmp);
        let count = starts
            .iter()
            .enumerate()
            .map(|(i, start)| (i - ends.partition_point(|end| end < start)) as u64)
            .sum();
        if count < best_count {
            best_count = count;
            best_axis = axis;
        }
    }
    let mut order = (0..analysed.len()).collect::<Vec<_>>();
    order.sort_unstable_by(|&a, &b| {
        analysed[a].1 .0[best_axis]
            .total_cmp(&analysed[b].1 .0[best_axis])
            .then_with(|| analysed[a].0.cmp(&analysed[b].0))
    });
    let mut active = Vec::new();
    let mut pairs = std::collections::BinaryHeap::new();
    let mut total = 0;
    let mut compared = 0;
    for index in order {
        let (body, (min, max)) = analysed[index];
        active.retain(|&other: &usize| analysed[other].1 .1[best_axis] >= min[best_axis]);
        for &other in &active {
            if COUNT {
                compared += 1;
            }
            let (other_body, (other_min, other_max)) = analysed[other];
            if (0..3).any(|axis| {
                max[axis].min(other_max[axis]) - min[axis].max(other_min[axis]) <= scene.tolerance
            }) {
                continue;
            }
            total += 1;
            let pair = (body.min(other_body), body.max(other_body));
            if pairs.len() < keep {
                pairs.push(pair);
            } else if pairs.peek().is_some_and(|largest| pair < *largest) {
                pairs.pop();
                pairs.push(pair);
            }
        }
        active.push(index);
    }
    let stored = pairs
        .into_sorted_vec()
        .into_iter()
        .map(|(a, b)| {
            let (a_min, a_max) = boxes[a];
            let (b_min, b_max) = boxes[b];
            let min = std::array::from_fn(|i| a_min[i].max(b_min[i]));
            let max = std::array::from_fn(|i| a_max[i].min(b_max[i]));
            let steps = scene.bodies[a]
                .steps
                .iter()
                .chain(&scene.bodies[b].steps)
                .filter(|step| lattice::active_step(step, tools, (min, max)))
                .count() as u64;
            Candidate {
                a: a as u32,
                b: b as u32,
                min,
                max,
                weight: steps.div_ceil(8).max(1),
            }
        })
        .collect();
    (stored, total, compared)
}

/// Select one cell size for all checked pairs. An infinite nominal cell means
/// every side uses the minimum count of 16.
pub fn plan(candidates: &[Candidate], total: u64, target_cell: f64, budget: u64) -> (f64, usize) {
    if !target_cell.is_finite() || target_cell <= 0.0 {
        return (target_cell, 0);
    }
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
    boundary_exhausted: bool,
    #[cfg(test)]
    rays: u64,
    #[cfg(test)]
    boundary_reads: u64,
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
    let tools = lattice::scene_tool_bounds(scene);
    let cache = ViewCache::new(crate::tool_view::classify(scene));
    let result = sample(scene, candidate, cell, refinement, &loops, &tools, &cache);
    (result.report, result.cell)
}

fn sample(
    scene: &Scene,
    pair: &Candidate,
    cell: f64,
    refinement: u64,
    loops: &[Vec<Bounds>],
    tools: &[Bounds],
    cache: &ViewCache,
) -> PairSample {
    let request = LatticeRequest {
        scene,
        bodies: (pair.a, Some(pair.b)),
        min: pair.min,
        max: pair.max,
        cell,
        tolerance: scene.tolerance,
    };
    let axes = lattice::sample_pair(
        &request,
        loops,
        tools,
        refinement / pair.weight.max(1),
        cache,
    );
    let cell = axes.iter().map(|sample| sample.cell).fold(0.0, f64::max);
    let capped = axes.iter().any(|sample| sample.capped);
    let boundary_exhausted = axes.iter().any(|sample| sample.boundary_exhausted);
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
        boundary_exhausted,
        #[cfg(test)]
        rays: axes.iter().map(|axis| axis.rays).sum(),
        #[cfg(test)]
        boundary_reads: axes.iter().map(|axis| axis.boundary_reads).sum(),
    }
}

fn allocate(budget: u64, work: u64, total_work: u64) -> u64 {
    ((u128::from(budget) * u128::from(work)) / u128::from(total_work)) as u64
}

#[allow(dead_code)]
pub(crate) fn analyse_scene(
    scene: &Scene,
    threads: usize,
) -> Result<(Analysis, Vec<PairReport>), CaptureError> {
    analyse_scene_with(scene, threads, &crate::tool_view::classify(scene))
}

pub(crate) fn analyse_scene_with(
    scene: &Scene,
    threads: usize,
    solid: &[bool],
) -> Result<(Analysis, Vec<PairReport>), CaptureError> {
    let budget = u64::from(scene.budget_million_rays) * 1_000_000;
    let loops = lattice::tool_loops(scene);
    let tools = lattice::scene_tool_bounds(scene);
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
    let (candidates, total) = collect_candidates(scene, &boxes, &tools, keep, solid);
    let (cell, checked) = plan(&candidates, total, scene.target_cell, budget);
    let work = candidates[..checked]
        .iter()
        .map(|pair| pair.work(cell))
        .sum();
    let cache = ViewCache::new(solid.to_vec());
    let cast_pairs = |pairs: &[Candidate]| {
        pairs
            .iter()
            .map(|pair| {
                let allowance = allocate(budget, pair.work(cell), work);
                sample(scene, pair, cell, allowance, &loops, &tools, &cache)
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
    fn exact_refinement_allowance_counts_only_cast_rays() {
        let scene = parse_scene(include_bytes!("../tests/fixtures/plate-iso.ncs1")).unwrap();
        let loops = lattice::tool_loops(&scene);
        let tools = lattice::scene_tool_bounds(&scene);
        let cache = ViewCache::new(crate::tool_view::classify(&scene));
        let pair = Candidate {
            a: 0,
            b: 1,
            min: [85.0, 45.0, 2.0],
            max: [100.0, 60.0, 5.0],
            weight: 1,
        };
        let sample = sample(&scene, &pair, 1.0, 128, &loops, &tools, &cache);
        assert_eq!(
            sample.rays,
            lattice::level0_rays(pair.min, pair.max, 1.0) + 128
        );
        assert!(sample.capped);
        let steps = scene.bodies[0].steps.len() + scene.bodies[1].steps.len();
        let weight = (steps as u64).div_ceil(8).max(1);
        assert!(sample.boundary_reads > 0);
        assert!(sample.boundary_reads <= 64 * weight * (sample.rays + 16));
    }

    #[test]
    fn weighted_refinement_spends_no_more_than_its_proportional_allowances() {
        let scene = parse_scene(include_bytes!("../tests/fixtures/plate-iso.ncs1")).unwrap();
        let loops = lattice::tool_loops(&scene);
        let tools = lattice::scene_tool_bounds(&scene);
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
        let cache = ViewCache::new(crate::tool_view::classify(&scene));
        let mut used = 0;
        let mut capped = false;
        for pair in &candidates {
            let level0 = pair.work(cell);
            let allowance = allocate(budget, level0, work);
            let sample = sample(&scene, pair, cell, allowance, &loops, &tools, &cache);
            let refined = sample.rays * pair.weight - level0;
            assert!(refined <= allowance);
            used += refined;
            capped |= sample.capped;
        }
        assert!(capped && used > 0 && used <= budget);
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct ViewPair {
    pub a: u32,
    pub b: u32,
    pub min: [f64; 3],
    pub max: [f64; 3],
}

/// Picture-only pairs whose volume is sampled. Each one costs a full
/// lattice outside the analysis ray budget, so the rest are reported from
/// the picture alone (volume 0, capped) instead of holding the caller for
/// minutes on a page with hundreds of mutually overlapping bodies.
pub const VIEW_PAIR_SAMPLES: usize = 64;

pub fn add_view_pairs(scene: &Scene, pairs: &mut Vec<PairReport>, seen: &[ViewPair], cell: f64) {
    add_view_pairs_with(scene, pairs, seen, cell, &crate::tool_view::classify(scene));
}

pub fn add_view_pairs_with(
    scene: &Scene,
    pairs: &mut Vec<PairReport>,
    seen: &[ViewPair],
    cell: f64,
    solid: &[bool],
) {
    if seen.is_empty() {
        return;
    }
    let loops = lattice::tool_loops(scene);
    let tools = lattice::scene_tool_bounds(scene);
    let cache = ViewCache::new(solid.to_vec());
    for (index, view) in seen.iter().enumerate() {
        let sampled = if index < VIEW_PAIR_SAMPLES {
            let min = view.min.map(|v| v - cell);
            let max = view.max.map(|v| v + cell);
            let side = (0..3).map(|i| max[i] - min[i]).fold(0.0, f64::max);
            let candidate = Candidate {
                a: view.a,
                b: view.b,
                min,
                max,
                weight: 1,
            };
            sample(
                scene,
                &candidate,
                cell.min(side / 16.0),
                0,
                &loops,
                &tools,
                &cache,
            )
            .into()
        } else {
            None
        };
        let boundary_exhausted = sampled
            .as_ref()
            .is_some_and(|sample| sample.boundary_exhausted);
        let mut report = sampled
            .and_then(|sample| sample.report)
            .unwrap_or(PairReport {
                a: view.a,
                b: view.b,
                volume: 0.0,
                min: view.min,
                max: view.max,
                from_view: true,
                capped: index >= VIEW_PAIR_SAMPLES || boundary_exhausted,
            });
        report.from_view = true;
        pairs.push(report);
    }
    pairs.sort_by_key(|p| (p.a, p.b));
}

#[cfg(test)]
mod view_tests {
    use super::*;
    #[test]
    fn view_pairs_preserve_reports_and_fallback() {
        let scene =
            crate::scene::parse_scene(include_bytes!("../tests/fixtures/plate-iso.ncs1")).unwrap();
        let original = PairReport {
            a: 1,
            b: 2,
            volume: 42.0,
            min: [0.0; 3],
            max: [1.0; 3],
            from_view: false,
            capped: false,
        };
        let mut hit = Vec::new();
        add_view_pairs(
            &scene,
            &mut hit,
            &[ViewPair {
                a: 0,
                b: 1,
                min: [85.0, 45.0, 2.0],
                max: [100.0, 60.0, 5.0],
            }],
            1.0,
        );
        assert!(hit[0].from_view && hit[0].volume > 0.0);
        let mut pairs = vec![original];
        let seen = [ViewPair {
            a: 0,
            b: 1,
            min: [1000.0; 3],
            max: [1001.0; 3],
        }];
        add_view_pairs(&scene, &mut pairs, &seen, 0.25);
        assert_eq!(
            (pairs[0].a, pairs[0].b, pairs[0].volume, pairs[0].from_view),
            (0, 1, 0.0, true)
        );
        assert_eq!(pairs[0].min, seen[0].min);
        assert_eq!(
            (pairs[1].a, pairs[1].b, pairs[1].volume, pairs[1].from_view),
            (1, 2, 42.0, false)
        );
    }

    #[test]
    fn view_pairs_beyond_the_sample_limit_are_reported_unmeasured() {
        let scene =
            crate::scene::parse_scene(include_bytes!("../tests/fixtures/plate-iso.ncs1")).unwrap();
        let overlap = ViewPair {
            a: 0,
            b: 1,
            min: [85.0, 45.0, 2.0],
            max: [100.0, 60.0, 5.0],
        };
        let seen = vec![overlap.clone(); VIEW_PAIR_SAMPLES + 2];
        let mut pairs = Vec::new();
        add_view_pairs(&scene, &mut pairs, &seen, 1.0);
        assert_eq!(pairs.len(), seen.len());
        assert!(pairs.iter().all(|pair| pair.from_view));
        let measured = pairs.iter().filter(|pair| pair.volume > 0.0).count();
        assert_eq!(measured, VIEW_PAIR_SAMPLES);
        assert!(pairs
            .iter()
            .filter(|pair| pair.volume == 0.0)
            .all(|pair| pair.capped && pair.min == overlap.min));
    }
}

#[cfg(test)]
mod pin_view_test {
    use super::*;
    use crate::scene::{Body, Loop, Op, Prism, Step, Tool};
    fn prism(origin: [f64; 3], width: f64, height: f64) -> Tool {
        Tool::Prism(Prism {
            o: origin,
            u: [1.0, 0.0, 0.0],
            v: [0.0, 1.0, 0.0],
            n: [0.0, 0.0, 1.0],
            t0: 0.0,
            t1: height,
            loops: vec![Loop {
                points: vec![0.0, 0.0, width, 0.0, width, width, 0.0, width],
                faces: vec![2; 4],
            }],
        })
    }
    #[test]
    fn view_box_finds_thin_pin_in_plate() {
        let mut scene =
            crate::scene::parse_scene(include_bytes!("../tests/fixtures/plate-iso.ncs1")).unwrap();
        scene.tools = vec![
            prism([0.0, 0.0, 0.0], 4.0, 1.0),
            prism([2.0, 2.0, 0.0], 0.05, 1.0),
        ];
        scene.bodies = (0..2)
            .map(|tool| Body {
                reference: false,
                analysed: true,
                steps: vec![Step {
                    op: Op::Union,
                    tool,
                }],
            })
            .collect();
        let mut pairs = vec![];
        add_view_pairs(
            &scene,
            &mut pairs,
            &[ViewPair {
                a: 0,
                b: 1,
                min: [2.0, 2.0, 0.0],
                max: [2.05, 2.05, 1.0],
            }],
            0.05,
        );
        assert_eq!(pairs.len(), 1);
        assert!(
            pairs[0].from_view && pairs[0].volume > 0.0,
            "{:?}",
            pairs[0]
        );
    }
}
