#[allow(dead_code)]
mod support;

use nodetto_capture::report::BodyState;
use nodetto_capture::scene::{parse_scene, Op, Tool};
use nodetto_capture::{render_parsed, render_rgb, render_scene, ImageFormat};
use support::{body, box_prism, cube_mesh, scene};

#[test]
fn census_tracks_empty_refilled_hidden_outside_and_intersection_miss() {
    let tools = vec![
        box_prism([-4.0, -4.0, 0.0], 8.0, 8.0, 4.0),
        box_prism([-5.0, -5.0, -1.0], 10.0, 10.0, 6.0),
        box_prism([40.0, 0.0, 0.0], 4.0, 4.0, 4.0),
    ];
    let bodies = vec![
        body(&[(Op::Union, 0), (Op::Difference, 1)]),
        body(&[(Op::Union, 0), (Op::Difference, 1), (Op::Union, 0)]),
        body(&[(Op::Union, 0)]),
        body(&[(Op::Union, 2)]),
        body(&[(Op::Union, 0), (Op::Intersection, 2)]),
    ];
    let s = scene(tools, bodies);
    let result = render_rgb(&s, 1).unwrap();
    assert_eq!(render_rgb(&s, 5).unwrap(), result);
    let reports = &result.1.bodies;
    assert_eq!(
        (reports[0].state, reports[0].emptied_by_step),
        (BodyState::Empty, 1)
    );
    assert_eq!(
        (reports[1].state, reports[1].emptied_by_step),
        (BodyState::Drawn, 1)
    );
    assert_eq!(reports[2].state, BodyState::Hidden);
    assert_eq!(reports[3].state, BodyState::Outside);
    assert_eq!(
        (reports[4].state, reports[4].emptied_by_step),
        (BodyState::Empty, 1)
    );
}

#[test]
fn off_view_history_is_deterministic_and_intersection_empties() {
    let mut steps = vec![(Op::Union, 0)];
    steps.extend(std::iter::repeat_n((Op::Difference, 1), 20_000));
    for intersection in [false, true] {
        let mut history = steps.clone();
        if intersection {
            history.push((Op::Intersection, 1));
        }
        let mut s = scene(
            vec![
                box_prism([-10.0, -10.0, 0.0], 20.0, 20.0, 4.0),
                box_prism([100.0, 100.0, 0.0], 2.0, 2.0, 4.0),
            ],
            vec![body(&history)],
        );
        s.width = 64;
        s.height = 64;
        s.analyse = false;
        s.draw_interference = false;
        let expected = render_rgb(&s, 1).unwrap();
        for threads in [2, 5] {
            assert_eq!(render_rgb(&s, threads).unwrap(), expected);
        }
        assert_eq!(
            expected.1.bodies[0].emptied_by_step,
            if intersection { 20_001 } else { -1 }
        );
    }
}

#[test]
fn sound_plate_end_to_end_has_drawn_bodies_and_no_emptying() {
    let bytes = include_bytes!("fixtures/plate-iso.ncs1");
    let s = parse_scene(bytes).unwrap();
    let (rgb, report) = render_rgb(&s, 1).unwrap();
    assert_eq!(render_rgb(&s, 5).unwrap(), (rgb, report.clone()));
    assert!(report
        .bodies
        .iter()
        .all(|b| b.state == BodyState::Drawn && b.emptied_by_step == -1));
    let encoded = render_scene(bytes, ImageFormat::Png, 1).unwrap();
    assert_eq!(encoded.report, report.to_json());
    assert!(!encoded.image.is_empty());
}

#[test]
fn options_zero_still_censuses_emptied_solid() {
    let mut s = scene(
        vec![
            box_prism([-4.0, -4.0, 0.0], 8.0, 8.0, 4.0),
            box_prism([-5.0, -5.0, -1.0], 10.0, 10.0, 6.0),
        ],
        vec![body(&[(Op::Union, 0), (Op::Difference, 1)])],
    );
    s.analyse = false;
    s.draw_interference = false;
    s.budget_million_rays = 0;
    let (_, report) = render_rgb(&s, 1).unwrap();
    assert_eq!(
        (report.bodies[0].state, report.bodies[0].emptied_by_step),
        (BodyState::Empty, 1)
    );
}

#[test]
fn hidden_shared_cut_is_reported_without_interference() {
    let mut s = scene(
        vec![
            box_prism([-10.0, -5.0, 0.0], 20.0, 10.0, 4.0),
            box_prism([-2.0, -1.0, 0.0], 2.0, 2.0, 4.0),
            box_prism([-3.0, -6.0, -1.0], 5.0, 12.0, 6.0),
        ],
        vec![body(&[(Op::Union, 0), (Op::Difference, 2)])],
    );
    s.hidden = vec![body(&[(Op::Union, 1), (Op::Difference, 2)])];
    s.analyse = false;
    s.draw_interference = false;
    let first = render_parsed(&s, ImageFormat::Png, 1).unwrap();
    assert!(first.report.contains("\"hiddenEmptiedByStep\":1"));
    assert_eq!(
        first.report,
        render_parsed(&s, ImageFormat::Png, 5).unwrap().report
    );
    let (_, report) = render_rgb(&s, 1).unwrap();
    assert_eq!(
        nodetto_capture::census::resolve_hidden(
            &s,
            &report.bodies,
            s.target_cell,
            1,
            &[true, true, true]
        ),
        vec![None]
    );
    s.hidden.clear();
    let control = render_parsed(&s, ImageFormat::Png, 1).unwrap();
    assert_eq!(control.report, render_rgb(&s, 1).unwrap().1.to_json());
    assert!(!control.report.contains("hiddenEmptiedByStep"));
    assert_eq!(first.image, control.image);
}

#[test]
fn open_source_with_later_cut_is_not_censused() {
    let mut mesh = cube_mesh();
    if let Tool::Mesh(mesh) = &mut mesh {
        mesh.triangles.truncate(mesh.triangles.len() - 3);
    }
    let s = scene(
        vec![mesh, box_prism([-5.0, -5.0, -1.0], 10.0, 10.0, 6.0)],
        vec![body(&[(Op::Union, 0), (Op::Difference, 1)])],
    );
    let (_, report) = render_rgb(&s, 1).unwrap();
    assert!(report.bodies[0].open);
    assert_eq!(report.bodies[0].state, BodyState::Drawn);
    assert_eq!(report.bodies[0].emptied_by_step, -1);
}
