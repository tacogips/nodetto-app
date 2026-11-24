#[allow(dead_code)]
mod support;

use nodetto_capture::census::{resolve, Liveness};
use nodetto_capture::interference::{add_view_pairs, analyse_pair, Candidate, ViewPair};
use nodetto_capture::lattice::{sample_axis, sample_body_axis, LatticeRequest};
use nodetto_capture::report::{BodyReport, BodyState};
use nodetto_capture::scene::{Body, Loop, Op, Scene, Tool};
use nodetto_capture::{render_rgb, scene::parse_scene};
use support::{body, box_prism, digest, scene};

fn slab_scene() -> nodetto_capture::scene::Scene {
    partial_slab_scene(false)
}

fn partial_slab_scene(partial: bool) -> nodetto_capture::scene::Scene {
    let mut tools = vec![box_prism([0.0; 3], 20.0, 20.0, 20.0)];
    let mut steps = vec![(Op::Union, 0)];
    for i in 0..1000 {
        tools.push(box_prism(
            [
                0.01 + f64::from(i) * 0.019,
                0.0,
                if partial { 10.0 } else { 0.0 },
            ],
            0.009,
            if partial { 10.0 } else { 20.0 },
            20.0,
        ));
        steps.push((Op::Difference, i + 1));
    }
    tools.push(box_prism([0.0; 3], 20.0, 20.0, 20.0));
    scene(tools, vec![body(&steps), body(&[(Op::Union, 1001)])])
}

#[test]
fn boundary_exhaustion_preserves_an_earlier_pair_hit() {
    let model = partial_slab_scene(true);
    let pair = Candidate {
        a: 0,
        b: 1,
        min: [0.0; 3],
        max: [20.0; 3],
        weight: 126,
    };
    let request = LatticeRequest {
        scene: &model,
        bodies: (0, Some(1)),
        min: pair.min,
        max: pair.max,
        cell: 1.25,
        tolerance: 0.001,
    };
    let axis = sample_axis(&request, 0);
    assert!(axis.hit && axis.boundary_exhausted);
    let report = analyse_pair(&model, &pair, 1.25, 0).0.expect("earlier hit");
    assert!(report.capped);
    assert!(report.volume > 0.0);
}

#[test]
fn boundary_budget_stops_pair_and_census_folds() {
    let model = slab_scene();
    let mut request = LatticeRequest {
        scene: &model,
        bodies: (0, Some(1)),
        min: [0.0; 3],
        max: [20.0; 3],
        cell: 20.0,
        tolerance: 0.001,
    };
    let sample = sample_axis(&request, 0);
    assert!(sample.boundary_exhausted && sample.capped);
    assert!(sample.boundary_reads <= 64 * 126 * (sample.rays + 16));
    request.bodies.1 = None;
    let mut live = Liveness::new(1001);
    let mut left = 1_000_000;
    let sample = sample_body_axis(&request, 0, &mut live, &mut left);
    assert!(sample.boundary_exhausted && sample.capped);
    assert!(sample.boundary_reads <= 64 * 126 * (sample.rays + 16));
    assert_eq!(left, 0);
    assert!(live.alive_after.iter().all(|alive| !alive));
}

#[test]
fn exhaustion_marks_view_fallback_and_census_unknown() {
    let mut model = slab_scene();
    let mut pairs = Vec::new();
    add_view_pairs(
        &model,
        &mut pairs,
        &[ViewPair {
            a: 0,
            b: 1,
            min: [0.0; 3],
            max: [20.0; 3],
        }],
        1.0,
    );
    assert_eq!(pairs.len(), 1);
    assert!(pairs[0].from_view && pairs[0].capped);

    let steps: Vec<_> = model.bodies[0]
        .steps
        .iter()
        .map(|step| (step.op, step.tool))
        .collect();
    model.bodies[1] = body(&steps);
    let picture = vec![Liveness::new(1001), Liveness::new(1001)];
    let mut reports = vec![
        BodyReport {
            state: BodyState::Absent,
            emptied_by_step: -1,
            open: false
        };
        2
    ];
    resolve(&model, &mut reports, &picture, 20.0, 24_000_000);
    assert!(reports
        .iter()
        .all(|report| report.state == BodyState::Unknown));
}

#[test]
fn admitted_plate_report_and_pixels_match_at_one_and_eight_threads() {
    let model = parse_scene(include_bytes!("fixtures/plate-iso.ncs1")).unwrap();
    let one = render_rgb(&model, 1).unwrap();
    assert_eq!(one, render_rgb(&model, 8).unwrap());
    assert_eq!(digest(&one.0), 0x093f_f8ec_cdac_365b);
}

#[test]
fn admitted_view_pair_matches_at_one_and_eight_threads() {
    let mut a = body(&[(Op::Union, 0)]);
    let mut b = body(&[(Op::Union, 1)]);
    a.analysed = true;
    b.analysed = true;
    let mut model = scene(
        vec![
            box_prism([-3.0, -3.0, 0.0], 6.0, 6.0, 2.0),
            box_prism([0.10, 0.10, 0.0], 0.05, 0.05, 2.0),
        ],
        vec![a, b],
    );
    model.camera.mm_per_pixel = 0.05;
    model.budget_million_rays = 0;
    let one = render_rgb(&model, 1).unwrap();
    assert!(one.1.pairs.iter().any(|pair| pair.from_view));
    assert_eq!(digest(&one.0), 0x6ced_1466_89f2_97a5);
    assert_eq!(
        digest(format!("{:?}", one.1).as_bytes()),
        0xacb8_2db9_7356_df84
    );
    assert_eq!(one, render_rgb(&model, 8).unwrap());
}

fn analysed(steps: &[(Op, u32)]) -> Body {
    let mut result = body(steps);
    result.analysed = true;
    result
}

fn interference_scene(tools: Vec<Tool>, bodies: Vec<Body>) -> Scene {
    let mut result = parse_scene(include_bytes!("fixtures/plate-iso.ncs1")).unwrap();
    result.width = 64;
    result.height = 64;
    result.supersample = 1;
    result.camera = support::camera([0.0, 0.0, -1.0], [0.0; 3], 2.0);
    result.draw_interference = false;
    result.tools = tools;
    result.bodies = bodies;
    result
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

#[test]
fn admitted_six_hundred_holes_match_at_one_and_eight_threads() {
    let Tool::Prism(mut peg) = box_prism([37.05, 211.05, 2.0], 1.0, 1.0, 3.0) else {
        unreachable!()
    };
    peg.loops = vec![circle([0.0; 2], 0.4, 64)];
    let mut tools = vec![
        box_prism([0.0; 3], 300.0, 300.0, 5.0),
        box_prism([0.0, 0.0, 5.0], 300.0, 300.0, 5.0),
        Tool::Prism(peg),
    ];
    let mut plate = vec![(Op::Union, 0)];
    for i in 0..600 {
        plate.push((Op::Difference, tools.len() as u32));
        tools.push(box_prism(
            [
                55.0 + (i % 30) as f64 * 8.0,
                225.0 + (i / 30) as f64 * 3.5,
                1.0,
            ],
            1.1,
            1.1,
            4.0,
        ));
    }
    let model = interference_scene(
        tools,
        vec![
            analysed(&plate),
            analysed(&[(Op::Union, 1), (Op::Union, 2)]),
        ],
    );
    let one = render_rgb(&model, 1).unwrap();
    assert_eq!(digest(&one.0), 0xd500_cacb_6cb8_57a5);
    assert_eq!(
        digest(format!("{:?}", one.1).as_bytes()),
        0x159f_716f_c1e4_a47d
    );
    assert_eq!(one, render_rgb(&model, 8).unwrap());
}

#[test]
#[cfg_attr(debug_assertions, ignore = "release only")]
fn admitted_two_hundred_shared_loop_bodies_match_at_one_and_eight_threads() {
    let Tool::Prism(mut prism) = box_prism([0.0; 3], 2.0, 2.0, 2.0) else {
        unreachable!()
    };
    prism.loops = vec![circle([1.0, 1.0], 1.0, 20_000)];
    let mut model = interference_scene(
        vec![Tool::Prism(prism)],
        (0..200).map(|_| analysed(&[(Op::Union, 0)])).collect(),
    );
    model.budget_million_rays = 1;
    let one = render_rgb(&model, 1).unwrap();
    assert_eq!(digest(&one.0), 0x7678_2c7e_b3a3_30e7);
    assert_eq!(
        digest(format!("{:?}", one.1).as_bytes()),
        0x9857_8897_a12b_95c1
    );
    assert_eq!(one, render_rgb(&model, 8).unwrap());
}
