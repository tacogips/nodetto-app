#[allow(dead_code)]
mod support;

use nodetto_capture::render_rgb;
use nodetto_capture::report::BodyState;
use nodetto_capture::scene::Op;
use support::{body, box_prism, scene};

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
