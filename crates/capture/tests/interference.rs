#[allow(dead_code)]
mod support;

use nodetto_capture::interference::{analyse_pair, candidates, plan, Candidate};
use nodetto_capture::lattice::{level0_rays, sample_axis, LatticeRequest};
use nodetto_capture::prism::PrismView;
use nodetto_capture::render_rgb;
use nodetto_capture::report::{Analysis, PairReport};
use nodetto_capture::scene::{parse_scene, Body, Loop, Op, Scene, Tool};
use nodetto_capture::view::{Ray, RayFamily};
use support::{body, box_prism, camera};

const PLATE: &[u8] = include_bytes!("fixtures/plate-iso.ncs1");

fn analysed(steps: &[(Op, u32)]) -> Body {
    let mut result = body(steps);
    result.analysed = true;
    result
}

fn scene(tools: Vec<Tool>, bodies: Vec<Body>) -> Scene {
    let mut result = parse_scene(PLATE).unwrap();
    result.width = 64;
    result.height = 64;
    result.supersample = 1;
    result.camera = camera([0.0, 0.0, -1.0], [0.0; 3], 2.0);
    result.draw_interference = false;
    result.tools = tools;
    result.bodies = bodies;
    result
}

fn two(tool_a: Tool, tool_b: Tool) -> Scene {
    scene(
        vec![tool_a, tool_b],
        vec![analysed(&[(Op::Union, 0)]), analysed(&[(Op::Union, 1)])],
    )
}

fn run(scene: &Scene, threads: usize) -> (Analysis, Vec<PairReport>) {
    let (_, report) = render_rgb(scene, threads).unwrap();
    (report.analysis.unwrap(), report.pairs)
}

fn expect_volume(pair: &PairReport, expected: f64, relative_error: f64) {
    assert!(
        (pair.volume - expected).abs() <= expected * relative_error,
        "reported {} mm³, expected {expected} mm³ (relative tolerance {relative_error})",
        pair.volume
    );
}

fn circle(centre: [f64; 2], radius: f64, count: u32) -> Loop {
    let points = (0..count)
        .flat_map(|i| {
            let angle = f64::from(i) * std::f64::consts::TAU / f64::from(count);
            [
                centre[0] + radius * angle.cos(),
                centre[1] + radius * angle.sin(),
            ]
        })
        .collect();
    Loop {
        points,
        faces: vec![2; count as usize],
    }
}

fn round_prism(origin: [f64; 3], radius: f64, height: f64) -> Tool {
    let Tool::Prism(mut prism) = box_prism(origin, 1.0, 1.0, height) else {
        unreachable!()
    };
    prism.loops = vec![circle([0.0; 2], radius, 64)];
    Tool::Prism(prism)
}

fn cylinder_volume(radius: f64, height: f64) -> f64 {
    32.0 * radius * radius * (std::f64::consts::TAU / 64.0).sin() * height
}

#[test]
fn fixture_reports_only_plate_and_block_and_crop_does_not_change_analysis() {
    let mut scene = parse_scene(PLATE).unwrap();
    scene.width = 64;
    scene.height = 64;
    scene.supersample = 1;
    let (analysis, pairs) = run(&scene, 1);
    assert_eq!(analysis.checked, 1);
    assert_eq!(analysis.cell, 0.25);
    assert_eq!(pairs.len(), 1);
    let pair = &pairs[0];
    assert_eq!((pair.a, pair.b), (0, 1));
    // The overlap includes one full hole, two half holes and a quarter
    // hole. Each 32-gon is symmetric about the edges that clip it.
    let hole_area = 16.0 * 2.0 * 2.0 * (std::f64::consts::TAU / 32.0).sin();
    expect_volume(pair, 3.0 * (15.0 * 15.0 - 2.25 * hole_area), 0.01);
    for (reported, exact) in pair
        .min
        .into_iter()
        .chain(pair.max)
        .zip([85.0, 45.0, 2.0, 100.0, 60.0, 5.0])
    {
        assert!((reported - exact).abs() <= 0.25);
    }

    scene.camera = camera([0.0, 1.0, -0.2], [500.0; 3], 0.1);
    assert_eq!(run(&scene, 5), (analysis, pairs));
}

fn pin_scene(cut: bool) -> Scene {
    let centre = [100.0, 100.0];
    let (feature, op, plate_height) = if cut {
        let Tool::Prism(mut ring) = box_prism([0.0, 0.0, 5.0], 200.0, 200.0, 10.0) else {
            unreachable!()
        };
        ring.loops.push(circle(centre, 0.75, 64));
        (Tool::Prism(ring), Op::Difference, 15.0)
    } else {
        (
            round_prism([centre[0], centre[1], 5.0], 0.75, 10.0),
            Op::Union,
            5.0,
        )
    };
    scene(
        vec![
            box_prism([0.0; 3], 200.0, 200.0, plate_height),
            feature,
            box_prism([0.0, 0.0, 5.0], 200.0, 200.0, 5.0),
        ],
        vec![
            analysed(&[(Op::Union, 0), (op, 1)]),
            analysed(&[(Op::Union, 2)]),
        ],
    )
}

fn peg_scene(holes: usize) -> Scene {
    let origin = if holes == 0 {
        [37.3, 211.7, 2.0]
    } else {
        [37.05, 211.05, 2.0]
    };
    let mut tools = vec![
        box_prism([0.0; 3], 300.0, 300.0, 5.0),
        box_prism([0.0, 0.0, 5.0], 300.0, 300.0, 5.0),
        round_prism(origin, 0.4, 3.0),
    ];
    let mut plate = vec![(Op::Union, 0)];
    for i in 0..holes {
        let x = 55.0 + (i % 30) as f64 * 8.0;
        let y = 225.0 + (i / 30) as f64 * 3.5;
        plate.push((Op::Difference, tools.len() as u32));
        tools.push(box_prism([x, y, 1.0], 1.1, 1.1, 4.0));
    }
    scene(
        tools,
        vec![
            analysed(&plate),
            analysed(&[(Op::Union, 1), (Op::Union, 2)]),
        ],
    )
}

#[test]
fn small_loops_find_added_pin_cut_pin_and_off_centre_peg() {
    for (mut scene, exact, default_cell) in [
        (pin_scene(false), cylinder_volume(0.75, 5.0), 0.25),
        (pin_scene(true), cylinder_volume(0.75, 5.0), 0.25),
        (peg_scene(0), cylinder_volume(0.4, 3.0), 300.0 / 1024.0),
    ] {
        for (target, actual) in [(0.25, default_cell), (4.0, 4.0)] {
            scene.target_cell = target;
            let (analysis, pairs) = run(&scene, 1);
            assert_eq!(analysis.cell, actual);
            assert_eq!(pairs.len(), 1);
            expect_volume(&pairs[0], exact, 0.03);
        }
    }
}

#[test]
fn an_intersection_outside_the_overlap_still_empties_the_body_there() {
    let scene = scene(
        vec![
            box_prism([0.0; 3], 20.0, 20.0, 20.0),
            box_prism([10.0; 3], 8.0, 8.0, 8.0),
            box_prism([0.0; 3], 8.0, 8.0, 8.0),
        ],
        vec![
            analysed(&[(Op::Union, 0), (Op::Intersection, 1)]),
            analysed(&[(Op::Union, 2)]),
        ],
    );
    let (analysis, pairs) = run(&scene, 1);
    assert_eq!(analysis.checked, 1);
    assert!(pairs.is_empty());
}

#[test]
fn touching_shallow_overlap_reference_and_analysis_flags() {
    for (overlap, hits) in [(0.0, false), (0.0005, false), (0.01, true)] {
        let mut scene = two(
            box_prism([0.0; 3], 10.0, 10.0, 10.0),
            box_prism([0.0, 0.0, 10.0 - overlap], 10.0, 10.0, 10.0),
        );
        scene.bodies[1].reference = true;
        let (analysis, pairs) = run(&scene, 1);
        assert_eq!(analysis.checked, u32::from(hits));
        assert_eq!(pairs.len(), usize::from(hits));
        if let Some(pair) = pairs.first() {
            expect_volume(pair, overlap * 100.0, 0.05);
        }
        scene.bodies[1].analysed = false;
        assert_eq!(run(&scene, 2).0.candidates, 0);

        scene.bodies[1].analysed = true;
        scene.analyse = false;
        scene.draw_interference = true;
        let (image, report) = render_rgb(&scene, 1).unwrap();
        assert!(report.analysis.is_none() && report.pairs.is_empty());
        scene.analyse = true;
        assert_eq!(image, render_rgb(&scene, 1).unwrap().0);
    }
}

#[test]
fn a_part_that_clears_a_pocket_by_point_one_does_not_interfere() {
    let scene = scene(
        vec![
            box_prism([0.0; 3], 10.0, 10.0, 5.0),
            box_prism([2.0, 2.0, 2.0], 6.0, 6.0, 3.0),
            box_prism([2.1, 2.1, 2.1], 5.8, 5.8, 4.0),
        ],
        vec![
            analysed(&[(Op::Union, 0), (Op::Difference, 1)]),
            analysed(&[(Op::Union, 2)]),
        ],
    );
    let (analysis, pairs) = run(&scene, 1);
    assert_eq!(analysis.checked, 1);
    assert!(pairs.is_empty());
}

#[test]
fn ray_in_a_shared_cap_plane_does_not_belong_to_both_prisms() {
    let Tool::Prism(lower) = box_prism([0.0; 3], 12.0, 16.0, 1.0) else {
        unreachable!()
    };
    let Tool::Prism(mut upper) = box_prism([0.0, 0.0, 2.0], 12.0, 16.0, 1.0) else {
        unreachable!()
    };
    upper.n = [0.0, 0.0, -1.0];
    let family = RayFamily {
        forward: [1.0, 0.0, 0.0],
    };
    let mut crossing = Vec::new();
    let mut intervals = Vec::new();
    for (prism, expected) in [(&lower, 0), (&upper, 2)] {
        PrismView::new(prism, 0, &family).intervals(
            &Ray {
                origin: [0.0, 2.5, 1.0],
            },
            &mut crossing,
            &mut intervals,
        );
        assert_eq!(intervals.len(), expected);
    }

    // After tilting around X, the conservative boxes overlap on all axes.
    // A row of X rays is exactly on the shared cap: (-0.6)y + (0.8)z = 0.
    let Tool::Prism(mut lower) = box_prism([0.0; 3], 12.0, 16.0, -4.0) else {
        unreachable!()
    };
    let Tool::Prism(mut upper) = box_prism([0.0; 3], 12.0, 16.0, 4.0) else {
        unreachable!()
    };
    for prism in [&mut lower, &mut upper] {
        prism.v = [0.0, 0.8, 0.6];
        prism.n = [0.0, -0.6, 0.8];
    }
    let scene = two(Tool::Prism(lower), Tool::Prism(upper));
    let (analysis, pairs) = run(&scene, 1);
    assert_eq!(analysis.checked, 1);
    assert!(pairs.is_empty());
    let request = LatticeRequest {
        scene: &scene,
        bodies: (0, Some(1)),
        min: [0.0, -5.0, -5.625],
        max: [12.0, 11.0, 10.375],
        cell: 1.0,
        tolerance: 0.001,
    };
    let sample = sample_axis(&request, 0);
    assert!(!sample.hit);
    let single = sample_axis(
        &LatticeRequest {
            bodies: (0, None),
            ..request
        },
        0,
    );
    assert!(single.hit && single.volume > 0.0);
}

#[test]
fn turned_prisms_that_share_only_a_side_face_do_not_interfere() {
    let Tool::Prism(mut right) = box_prism([0.0; 3], 4.0, 16.0, 4.0) else {
        unreachable!()
    };
    let diagonal = std::f64::consts::FRAC_1_SQRT_2;
    right.u = [diagonal, diagonal, 0.0];
    right.v = [-diagonal, diagonal, 0.0];
    let Tool::Prism(mut left) = box_prism([0.0; 3], 4.0, 16.0, 4.0) else {
        unreachable!()
    };
    left.u = [-diagonal, -diagonal, 0.0];
    left.v = right.v;
    let scene = two(Tool::Prism(right), Tool::Prism(left));
    let (analysis, pairs) = run(&scene, 1);
    assert_eq!(analysis.checked, 1);
    assert!(pairs.is_empty());

    // The Z-directed centre ray at [-4, 4] lies on the shared side.
    let request = LatticeRequest {
        scene: &scene,
        bodies: (0, Some(1)),
        min: [-4.5, 3.5, 0.0],
        max: [11.5, 19.5, 4.0],
        cell: 1.0,
        tolerance: 0.001,
    };
    assert!(!sample_axis(&request, 2).hit);

    let Tool::Prism(mut right) = box_prism([0.0; 3], 4.0, 16.0, 4.0) else {
        unreachable!()
    };
    right.u = [0.0, diagonal, diagonal];
    right.v = [1.0, 0.0, 0.0];
    right.n = [0.0, -diagonal, diagonal];
    let Tool::Prism(mut left) = box_prism([0.0; 3], 4.0, 16.0, 4.0) else {
        unreachable!()
    };
    left.u = right.u.map(|value| -value);
    left.v = right.v;
    left.n = right.n;
    let scene = two(Tool::Prism(right), Tool::Prism(left));
    let (analysis, pairs) = run(&scene, 1);
    assert_eq!(analysis.checked, 1);
    assert!(pairs.is_empty());

    // The X-directed ray through [-1, 1] in YZ is in the side plane.
    let request = LatticeRequest {
        scene: &scene,
        min: [0.0, -1.5, 0.5],
        max: [16.0, 14.5, 16.5],
        ..request
    };
    assert!(!sample_axis(&request, 0).hit);
}

struct Random(u64);

impl Random {
    fn next(&mut self, max: u32) -> u32 {
        self.0 = self.0.wrapping_mul(6364136223846793005).wrapping_add(1);
        (self.0 >> 32) as u32 % max
    }
}

#[test]
fn seeded_corner_overlaps_are_found_at_the_stated_level_zero_cell() {
    let mut random = Random(709);
    for _ in 0..200 {
        let y = 15.0 + f64::from(random.next(700)) / 10.0;
        let penetration = 0.61 + f64::from(random.next(500)) / 1000.0;
        let corner = 100.0 - penetration;
        let Tool::Prism(mut triangle) = box_prism([corner, y, 0.0], 100.0, 100.0, 5.0) else {
            unreachable!()
        };
        triangle.loops[0].points = vec![0.0, 0.0, 100.0, 0.0, 100.0, -100.0];
        triangle.loops[0].faces.truncate(3);
        let scene = two(
            box_prism([0.0; 3], 100.0, 100.0, 5.0),
            Tool::Prism(triangle),
        );
        let candidate = Candidate {
            a: 0,
            b: 1,
            min: [corner, 0.0, 0.0],
            max: [100.0, y, 5.0],
            weight: 1,
        };
        let (pair, cell) = analyse_pair(&scene, &candidate, 0.25, 0);
        assert!(cell <= 0.25 && penetration > 2.0 * (1.2 * cell));
        assert!(
            pair.is_some(),
            "missed corner at y = {y}, penetration = {penetration}"
        );
    }
}

#[test]
fn enclosure_checks_all_parts_but_only_reports_the_one_through_the_wall() {
    let mut tools = vec![
        box_prism([0.0; 3], 100.0, 100.0, 30.0),
        box_prism([2.0; 3], 96.0, 96.0, 26.0),
    ];
    let mut bodies = vec![analysed(&[(Op::Union, 0), (Op::Difference, 1)])];
    for i in 0..40 {
        let x = if i == 37 {
            1.0
        } else {
            9.0 + f64::from(i % 8) * 11.0
        };
        let y = 5.0 + f64::from(i / 8) * 17.0;
        bodies.push(analysed(&[(Op::Union, tools.len() as u32)]));
        tools.push(box_prism([x, y, 10.0], 6.0, 6.0, 6.0));
    }
    let scene = scene(tools, bodies);
    let (analysis, pairs) = run(&scene, 1);
    assert_eq!(analysis.checked, 40);
    assert_eq!(analysis.unchecked_count, 0);
    assert_eq!(pairs.len(), 1);
    assert_eq!((pairs[0].a, pairs[0].b), (0, 38));
    expect_volume(&pairs[0], 36.0, 0.03);
    assert_eq!(run(&scene, 5), (analysis.clone(), pairs.clone()));
    assert_eq!(run(&scene, 5), (analysis, pairs));
}

fn overlapping(count: u32, side: f64, budget: u32) -> Scene {
    let mut scene = scene(
        vec![box_prism([0.0; 3], side, side, side)],
        (0..count).map(|_| analysed(&[(Op::Union, 0)])).collect(),
    );
    scene.budget_million_rays = budget;
    scene
}

#[test]
fn candidate_table_bounds_and_unchecked_order() {
    let scene = overlapping(2000, 2.0, 1);
    let keep = 1_000_000 / 768 + 256;
    let boxes = vec![([0.0; 3], [2.0; 3]); 2000];
    let (stored, total) = candidates(&scene, &boxes, keep);
    assert_eq!(total, 2000 * 1999 / 2);
    assert_eq!(stored.len(), keep);

    let (analysis, pairs) = run(&scene, 5);
    let checked = 1_000_000 / 768;
    assert_eq!(analysis.candidates, total as u32);
    assert_eq!(analysis.checked, checked);
    assert_eq!(analysis.unchecked_count, total as u32 - checked);
    assert_eq!(
        analysis.unchecked,
        (checked + 1..=checked + 256)
            .map(|b| (0, b))
            .collect::<Vec<_>>()
    );
    assert_eq!(pairs.len(), checked as usize);
    assert_eq!(
        (pairs.last().unwrap().a, pairs.last().unwrap().b),
        (0, checked)
    );
}

#[test]
fn wide_pairs_coarsen_together_and_generated_plans_obey_the_budget() {
    let scene = overlapping(40, 200.0, 24);
    let (pairs, total) = candidates(&scene, &vec![([0.0; 3], [200.0; 3]); 40], 32_000);
    let (cell, checked) = plan(&pairs, total, 0.25, 24_000_000);
    assert_eq!((cell, checked), (2.0, 780));
    // Sample one of the identical pairs at the shared resolution.
    assert_eq!(analyse_pair(&scene, &pairs[checked - 1], cell, 0).1, 2.0);

    let mut random = Random(423);
    for _ in 0..1000 {
        let budget = u64::from(random.next(2_000_000));
        let candidates = (0..random.next(48))
            .map(|b| Candidate {
                a: 0,
                b: b + 1,
                min: [0.0; 3],
                max: std::array::from_fn(|_| 0.1 + f64::from(random.next(10_000)) / 10.0),
                weight: u64::from(1 + random.next(80)),
            })
            .collect::<Vec<_>>();
        let total = candidates.len() as u64;
        let (cell, checked) = plan(&candidates, total, 0.25, budget);
        let work: u64 = candidates[..checked]
            .iter()
            .map(|pair| level0_rays(pair.min, pair.max, cell) * pair.weight)
            .sum();
        assert!(work <= budget);
        if let Some(next) = candidates.get(checked) {
            assert!(cell.is_infinite() && work + 768 * next.weight > budget);
        } else if cell > 0.25 && cell.is_finite() {
            assert!(
                candidates
                    .iter()
                    .map(|p| level0_rays(p.min, p.max, cell / 2.0) * p.weight)
                    .sum::<u64>()
                    > budget
            );
        }
    }
}

#[test]
fn costly_plate_coarsens_but_finds_the_peg() {
    let scene = peg_scene(600);
    let boxes = [
        ([0.0; 3], [300.0, 300.0, 5.0]),
        ([0.0, 0.0, 2.0], [300.0, 300.0, 10.0]),
    ];
    let (candidates, total) = candidates(&scene, &boxes, 2);
    assert_eq!(candidates[0].weight, 76);
    let (cell, checked) = plan(&candidates, total, 0.25, 24_000_000);
    assert_eq!((cell, checked), (1.0, 1));
    assert!(analyse_pair(&scene, &candidates[0], cell, 0).0.is_none());
    let (analysis, pairs) = run(&scene, 1);
    assert_eq!(analysis.cell, 300.0 / (300.0 / cell).ceil());
    assert_eq!(pairs.len(), 1);
    expect_volume(&pairs[0], cylinder_volume(0.4, 3.0), 0.06);
}

#[test]
fn per_axis_limit_counts_actual_refinement_and_caps_remaining_cells() {
    let scene = scene(
        vec![
            box_prism([0.0; 3], 1024.0, 16.0, 2.0),
            box_prism([0.0, 4.1, 0.0], 1024.0, 0.01, 2.0),
        ],
        vec![analysed(&[(Op::Union, 0), (Op::Union, 1)])],
    );
    let request = LatticeRequest {
        scene: &scene,
        bodies: (0, None),
        min: [0.0; 3],
        max: [1024.0, 16.0, 2.0],
        cell: 1.0,
        tolerance: 0.001,
    };
    let sample = sample_axis(&request, 2);
    assert!(sample.hit && sample.capped);
    assert_eq!(sample.rays, 1024 * 16 + (2_000_000 / 4096) * 4096);
}

#[test]
fn cap_without_a_hit_is_retained_in_the_report_and_json() {
    let mut scene = scene(
        vec![
            box_prism([0.0; 3], 16.0, 16.0, 16.0),
            box_prism([0.0, 4.1, 0.0], 16.0, 0.01, 16.0),
            box_prism([80.0; 3], 1.0, 1.0, 1.0),
        ],
        (0..12)
            .map(|_| analysed(&[(Op::Union, 0), (Op::Union, 1), (Op::Intersection, 2)]))
            .collect(),
    );
    scene.budget_million_rays = 1;
    scene.target_cell = 1.0;
    let (_, report) = render_rgb(&scene, 5).unwrap();
    assert!(report.pairs.is_empty());
    let analysis = report.analysis.as_ref().unwrap();
    assert_eq!(
        (analysis.candidates, analysis.checked, analysis.capped_count),
        (66, 66, 66)
    );
    assert_eq!(analysis.capped_without_hit.len(), 66);
    assert_eq!(analysis.capped_without_hit.first(), Some(&(0, 1)));
    assert_eq!(analysis.capped_without_hit.last(), Some(&(10, 11)));
    assert!(report
        .to_json()
        .contains(r#""cappedCount":66,"budget":1000000,"cappedWithoutHit":[[0,1]"#));
}

#[cfg(not(debug_assertions))]
#[test]
fn release_timing_budgets() {
    use std::time::Instant;

    for (label, scene, budget) in [
        ("pin", pin_scene(false), 500),
        ("2000-boxes", overlapping(2000, 2.0, 1), 2000),
        ("600-holes", peg_scene(600), 2000),
    ] {
        let start = Instant::now();
        let (analysis, pairs) = run(&scene, 1);
        let elapsed = start.elapsed().as_millis();
        println!(
            "{label}: {elapsed} ms, {} of {} candidates checked, {} hits",
            analysis.checked,
            analysis.candidates,
            pairs.len()
        );
        assert!(!pairs.is_empty());
        assert!(elapsed < budget, "{label} exceeded {budget} ms");
    }
}
