//! Liveness records for the sampled body census.

use crate::lattice::{self, LatticeRequest};
use crate::report::{BodyReport, BodyState};
use crate::scene::{Body, Op, Scene};

pub const CENSUS_LIMIT: usize = 4096;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Liveness {
    pub alive_after: Vec<bool>,
}

impl Liveness {
    pub fn new(steps: usize) -> Self {
        Self {
            alive_after: vec![false; steps],
        }
    }

    pub fn mark(&mut self, from: usize, to: usize) {
        let end = to.min(self.alive_after.len());
        if from < end {
            self.alive_after[from..end].fill(true);
        }
    }

    pub fn merge(&mut self, other: &Self) {
        for (a, b) in self.alive_after.iter_mut().zip(&other.alive_after) {
            *a |= *b;
        }
    }
}

pub fn is_suspect(body: &Body, picture: &Liveness, state: BodyState) -> bool {
    state == BodyState::Absent
        || body.steps.iter().enumerate().any(|(i, step)| {
            matches!(step.op, Op::Difference | Op::Intersection)
                && !picture.alive_after.get(i).copied().unwrap_or(false)
        })
}

#[derive(Debug, Default)]
pub struct CensusStats {
    pub rays: u64,
    pub sampled: u32,
}

pub fn resolve(
    scene: &Scene,
    bodies: &mut [BodyReport],
    picture: &[Liveness],
    cell: f64,
    budget_rays: u64,
) -> CensusStats {
    resolve_with(
        scene,
        bodies,
        picture,
        cell,
        budget_rays,
        &crate::tool_view::classify(scene),
    )
}

pub(crate) fn resolve_with(
    scene: &Scene,
    bodies: &mut [BodyReport],
    picture: &[Liveness],
    cell: f64,
    budget_rays: u64,
    solid: &[bool],
) -> CensusStats {
    let mut stats = CensusStats::default();
    let mut budget = budget_rays;
    let mut triangles_left = lattice::request_triangles(budget_rays) / 4;
    let mut suspects = 0usize;
    for (index, (body, report)) in scene.bodies.iter().zip(bodies.iter_mut()).enumerate() {
        report.emptied_by_step = -1;
        let mut alive = Liveness::new(body.steps.len());
        if let Some(p) = picture.get(index) {
            alive.merge(p);
        }
        if !is_suspect(body, &alive, report.state) {
            continue;
        }
        suspects += 1;
        if suspects > CENSUS_LIMIT || budget == 0 || !cell.is_finite() || cell <= 0.0 {
            report.state = BodyState::Unknown;
            continue;
        }
        if !sample_body(
            scene,
            body,
            index,
            cell,
            &mut budget,
            &mut triangles_left,
            solid,
            &mut alive,
            &mut stats,
        )
        .0
        {
            report.state = BodyState::Unknown;
            continue;
        }
        if let Some(first) = alive.alive_after.iter().position(|&value| !value) {
            report.emptied_by_step = i32::try_from(first).unwrap_or(i32::MAX);
        }
        if !alive.alive_after.last().copied().unwrap_or(false) {
            report.state = BodyState::Empty;
        } else if report.state == BodyState::Absent {
            report.state = BodyState::Outside;
        }
    }
    stats
}

#[allow(clippy::too_many_arguments)]
fn sample_body(
    scene: &Scene,
    body: &Body,
    index: usize,
    cell: f64,
    budget: &mut u64,
    triangles_left: &mut u64,
    solid: &[bool],
    alive: &mut Liveness,
    stats: &mut CensusStats,
) -> (bool, bool) {
    let mut bounds = lattice::empty_bounds();
    for step in body.steps.iter().filter(|step| step.op == Op::Union) {
        if let Some(b) = scene
            .tools
            .get(step.tool as usize)
            .and_then(crate::tool_view::tool_bounds)
        {
            lattice::extend(&mut bounds, b);
        }
    }
    let (min, max) = bounds;
    if !(0..3).all(|i| min[i].is_finite() && max[i].is_finite() && min[i] < max[i]) {
        return (false, false);
    }
    let side = (0..3).map(|i| max[i] - min[i]).fold(0.0_f64, f64::max);
    let request = LatticeRequest {
        scene,
        bodies: (index as u32, None),
        min,
        max,
        cell: cell.max(side / 256.0),
        tolerance: scene.tolerance,
    };
    let weight = (body.steps.len() as u64).div_ceil(8).max(1);
    let mut raw_budget = *budget / weight;
    let initial = raw_budget;
    let mut incomplete = false;
    for axis in 0..3 {
        if alive.alive_after.iter().all(|&value| value) {
            break;
        }
        if raw_budget == 0 {
            incomplete = true;
            break;
        }
        let result = lattice::sample_body_axis_with(
            &request,
            axis,
            alive,
            &mut raw_budget,
            triangles_left,
            solid,
        );
        incomplete |= result.capped;
    }
    let spent = (initial - raw_budget).saturating_mul(weight);
    *budget -= spent;
    stats.rays += spent;
    stats.sampled += 1;
    (
        !(incomplete && !alive.alive_after.iter().all(|&value| value) && raw_budget == 0),
        !incomplete,
    )
}

pub fn resolve_hidden(
    scene: &Scene,
    reports: &[BodyReport],
    cell: f64,
    budget_rays: u64,
    solid: &[bool],
) -> Vec<Option<i32>> {
    let mut result = vec![None; scene.bodies.len()];
    let mut budget = budget_rays;
    let mut triangles_left = lattice::request_triangles(budget_rays) / 8;
    let mut stats = CensusStats::default();
    for (index, body) in scene.hidden.iter().take(CENSUS_LIMIT).enumerate() {
        if budget == 0
            || !cell.is_finite()
            || cell <= 0.0
            || !body
                .steps
                .first()
                .and_then(|step| solid.get(step.tool as usize))
                .copied()
                .unwrap_or(false)
        {
            continue;
        }
        let mut alive = Liveness::new(body.steps.len());
        if !sample_body(
            scene,
            body,
            scene.bodies.len() + index,
            cell,
            &mut budget,
            &mut triangles_left,
            solid,
            &mut alive,
            &mut stats,
        )
        .1
        {
            continue;
        }
        let Some(step) = alive
            .alive_after
            .iter()
            .position(|&value| !value)
            .and_then(|i| body.steps.get(i))
        else {
            continue;
        };
        if !matches!(step.op, Op::Difference | Op::Intersection) {
            continue;
        }
        for (i, (visible, report)) in scene.bodies.iter().zip(reports).enumerate() {
            if report.open {
                continue;
            }
            if let Some(k) = visible
                .steps
                .iter()
                .position(|candidate| candidate.op == step.op && candidate.tool == step.tool)
            {
                let k = i32::try_from(k).unwrap_or(i32::MAX);
                if report.emptied_by_step == -1 || report.emptied_by_step > k {
                    result[i] = Some(result[i].map_or(k, |old: i32| old.min(k)));
                }
            }
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::scene::{Camera, Colours, Loop, Prism, Step, Tool};

    fn cube(x: f64, size: f64) -> Tool {
        Tool::Prism(Prism {
            o: [x, 0.0, 0.0],
            u: [1.0, 0.0, 0.0],
            v: [0.0, 1.0, 0.0],
            n: [0.0, 0.0, 1.0],
            t0: 0.0,
            t1: size,
            loops: vec![Loop {
                points: vec![0.0, 0.0, size, 0.0, size, size, 0.0, size],
                faces: vec![0; 4],
            }],
        })
    }

    fn scene(steps: &[(Op, u32)]) -> Scene {
        Scene {
            width: 64,
            height: 64,
            supersample: 1,
            camera: Camera {
                right: [1.0, 0.0, 0.0],
                up: [0.0, 1.0, 0.0],
                forward: [0.0, 0.0, 1.0],
                centre: [0.0; 3],
                mm_per_pixel: 1.0,
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
            target_cell: 1.0,
            tools: vec![cube(0.0, 10.0), cube(0.0, 10.0), cube(20.0, 2.0)],
            bodies: vec![Body {
                reference: false,
                analysed: true,
                steps: steps.iter().map(|&(op, tool)| Step { op, tool }).collect(),
            }],
            hidden: Vec::new(),
        }
    }

    fn report(state: BodyState) -> BodyReport {
        BodyReport {
            state,
            emptied_by_step: -1,
            open: false,
        }
    }

    #[test]
    fn empty_refilled_and_intersection() {
        for (steps, state, expected) in [
            (
                vec![(Op::Union, 0), (Op::Difference, 1)],
                BodyState::Absent,
                BodyState::Empty,
            ),
            (
                vec![
                    (Op::Union, 0),
                    (Op::Difference, 1),
                    (Op::Union, 2),
                    (Op::Difference, 2),
                    (Op::Union, 2),
                ],
                BodyState::Drawn,
                BodyState::Drawn,
            ),
            (
                vec![(Op::Union, 0), (Op::Intersection, 2)],
                BodyState::Absent,
                BodyState::Empty,
            ),
        ] {
            let s = scene(&steps);
            let mut reports = [report(state)];
            resolve(&s, &mut reports, &[], 1.0, 24_000_000);
            assert_eq!(reports[0].state, expected);
            assert_eq!(reports[0].emptied_by_step, 1);
        }
    }

    #[test]
    fn sound_outside_and_budget() {
        let s = scene(&[(Op::Union, 0), (Op::Difference, 2)]);
        let mut picture = Liveness::new(2);
        picture.mark(0, 2);
        let mut reports = [report(BodyState::Drawn)];
        assert_eq!(resolve(&s, &mut reports, &[picture], 1.0, 1000).rays, 0);
        let mut reports = [report(BodyState::Absent)];
        let stats = resolve(&s, &mut reports, &[], 1.0, 24_000_000);
        assert_eq!(reports[0].state, BodyState::Outside);
        assert!(stats.rays < 5000);
        let mut reports = [report(BodyState::Absent)];
        let empty = scene(&[(Op::Union, 0), (Op::Difference, 1)]);
        let stats = resolve(&empty, &mut reports, &[], 1.0, 1);
        assert!(stats.rays <= 1);
        assert_eq!(reports[0].state, BodyState::Unknown);
    }

    #[test]
    fn picture_boss_and_suspect_limit() {
        let mut s = scene(&[(Op::Union, 0), (Op::Difference, 2), (Op::Union, 2)]);
        let mut picture = Liveness::new(3);
        picture.mark(2, 3);
        let mut reports = [report(BodyState::Drawn)];
        let stats = resolve(&s, &mut reports, &[picture], 1.0, 100);
        assert!(stats.rays > 0);
        assert_eq!(reports[0].emptied_by_step, -1);
        s.bodies = (0..=CENSUS_LIMIT)
            .map(|_| Body {
                reference: false,
                analysed: true,
                steps: vec![Step {
                    op: Op::Union,
                    tool: 0,
                }],
            })
            .collect();
        let mut reports = vec![report(BodyState::Absent); CENSUS_LIMIT + 1];
        let stats = resolve(&s, &mut reports, &[], 1.0, 10_000);
        assert_eq!(stats.sampled, CENSUS_LIMIT as u32);
        assert_eq!(reports[CENSUS_LIMIT].state, BodyState::Unknown);
        assert_eq!(reports[CENSUS_LIMIT].emptied_by_step, -1);
    }

    #[test]
    fn mark_and_merge_are_bounded_and_order_independent() {
        let mut a = Liveness::new(4);
        a.mark(1, 3);
        a.mark(9, usize::MAX);
        let mut b = Liveness::new(4);
        b.mark(2, usize::MAX);
        let mut ab = a.clone();
        ab.merge(&b);
        b.merge(&a);
        assert_eq!(ab, b);
        assert_eq!(ab.alive_after, vec![false, true, true, true]);
    }

    #[test]
    fn unrelated_tools_do_not_change_census() {
        let mut s = scene(&[(Op::Union, 0)]);
        s.tools = (0..50).map(|i| cube(i as f64 * 20.0, 10.0)).collect();
        s.bodies = (0..50)
            .map(|i| Body {
                reference: false,
                analysed: true,
                steps: vec![Step {
                    op: Op::Union,
                    tool: i,
                }],
            })
            .collect();
        let mut baseline = vec![report(BodyState::Absent); 50];
        let first = resolve(&s, &mut baseline, &[], 1.0, 24_000_000);
        s.tools.extend((0..5000).map(|i| cube(i as f64, 1.0)));
        let mut actual = vec![report(BodyState::Absent); 50];
        let second = resolve(&s, &mut actual, &[], 1.0, 24_000_000);
        assert_eq!(actual, baseline);
        assert_eq!((second.rays, second.sampled), (first.rays, first.sampled));
        assert!(actual
            .iter()
            .all(|r| r.state == BodyState::Outside && r.emptied_by_step == -1));
    }

    #[test]
    fn thin_pin_and_parallel_determinism() {
        let mut s = scene(&[(Op::Union, 0), (Op::Difference, 1)]);
        s.tools = vec![cube(0.0, 200.0), cube(0.0, 200.0)];
        if let Tool::Prism(cut) = &mut s.tools[1] {
            // Coarse centres are odd integers; neither 101 nor 103 is inside.
            cut.loops.push(Loop {
                points: vec![101.2, 101.2, 102.7, 101.2, 102.7, 102.7, 101.2, 102.7],
                faces: vec![0; 4],
            });
        }
        let run = || {
            let mut reports = [report(BodyState::Absent)];
            let stats = resolve(&s, &mut reports, &[], 2.0, 24_000_000);
            (reports[0].clone(), stats.rays, stats.sampled)
        };
        let expected = run();
        assert_eq!(expected.0.state, BodyState::Outside);
        assert_eq!(expected.0.emptied_by_step, -1);
        assert!(expected.1 > 10_000);
        std::thread::scope(|scope| {
            let threads: Vec<_> = (0..4).map(|_| scope.spawn(run)).collect();
            for thread in threads {
                assert_eq!(thread.join().unwrap(), expected);
            }
        });
    }

    #[test]
    fn exhausted_budget_marks_remaining_bodies_unknown() {
        let mut s = scene(&[(Op::Union, 0), (Op::Difference, 1)]);
        s.bodies = (0..3000)
            .map(|_| Body {
                reference: false,
                analysed: true,
                steps: vec![
                    Step {
                        op: Op::Union,
                        tool: 0,
                    },
                    Step {
                        op: Op::Difference,
                        tool: 1,
                    },
                ],
            })
            .collect();
        let mut reports = vec![report(BodyState::Absent); 3000];
        let stats = resolve(&s, &mut reports, &[], 1.0, 1);
        assert!(stats.rays <= 1);
        assert!(reports
            .iter()
            .all(|r| r.state == BodyState::Unknown && r.emptied_by_step == -1));
    }

    #[test]
    fn thin_material_invalid_input_and_large_early_exit() {
        let mut s = scene(&[(Op::Union, 0)]);
        s.tools = vec![cube(0.0, 200.0)];
        let mut reports = [report(BodyState::Absent)];
        let stats = resolve(&s, &mut reports, &[], 1.0, 24_000_000);
        assert_eq!(reports[0].state, BodyState::Outside);
        assert!(stats.rays < 5000);
        if let Tool::Prism(p) = &mut s.tools[0] {
            p.t1 = 0.0005;
        }
        let mut reports = [report(BodyState::Absent)];
        resolve(&s, &mut reports, &[], 1.0, 24_000_000);
        assert_eq!(reports[0].state, BodyState::Outside);
        for cell in [f64::NAN, f64::INFINITY, 0.0, -1.0] {
            let mut reports = [report(BodyState::Absent)];
            assert_eq!(resolve(&s, &mut reports, &[], cell, 100).rays, 0);
            assert_eq!(reports[0].state, BodyState::Unknown);
        }
        s.tools.clear();
        let mut reports = [report(BodyState::Absent)];
        resolve(&s, &mut reports, &[], 1.0, 100);
        assert_eq!(reports[0].state, BodyState::Unknown);
    }
}
