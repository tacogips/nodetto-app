#[allow(dead_code)]
mod support;

use nodetto_capture::render_rgb;
use nodetto_capture::scene::Op;
use support::{body, box_prism, scene};

#[test]
#[cfg_attr(debug_assertions, ignore = "release only")]
fn work_limit_rejects_extreme_intersection_history() {
    let steps = vec![(Op::Intersection, 0); 20_000];
    let mut s = scene(
        vec![box_prism([-10.0, -10.0, 0.0], 20.0, 20.0, 2.0)],
        vec![body(&steps)],
    );
    s.width = 2048;
    s.height = 2048;
    s.supersample = 3;
    let start = std::time::Instant::now();
    let error = render_rgb(&s, 1).unwrap_err();
    println!("Work limit rejection: {:?}: {error}", start.elapsed());
    assert!(error.to_string().contains("work"));
    assert!(start.elapsed() < std::time::Duration::from_millis(1000));
}

#[test]
#[cfg_attr(debug_assertions, ignore = "release only")]
fn dense_history_render_budget() {
    let mut tools = vec![box_prism([-10.0, -10.0, 0.0], 20.0, 20.0, 2.0)];
    let mut steps = vec![(Op::Union, 0)];
    for i in 0..600 {
        let x = (i % 30) as f64 * 0.6 - 9.0;
        let y = (i / 30) as f64 * 0.8 - 8.0;
        tools.push(box_prism([x, y, -1.0], 0.2, 0.2, 4.0));
        steps.push((Op::Difference, (i + 1) as u32));
    }
    let s = scene(tools, vec![body(&steps)]);
    let start = std::time::Instant::now();
    let _ = render_rgb(&s, 1).unwrap();
    println!("600-hole plate: {:?}", start.elapsed());
    assert!(start.elapsed() < std::time::Duration::from_millis(1500));
}

#[test]
#[cfg_attr(debug_assertions, ignore = "release only")]
fn entry_limit_rejects_edge_column_history() {
    let mut s = scene(
        vec![box_prism([8.0, -300.0, 0.0], 0.1, 600.0, 2.0)],
        vec![body(&vec![(Op::Union, 0); 70_000])],
    );
    s.width = 65;
    s.height = 2048;
    s.supersample = 1;
    let start = std::time::Instant::now();
    let error = render_rgb(&s, 1).unwrap_err().to_string();
    println!("Entry limit rejection: {:?}: {error}", start.elapsed());
    assert!(error.contains("tile list entries"));
    assert!(error.contains("4194304"));
    assert!(error.contains("--size"));
    assert!(start.elapsed() < std::time::Duration::from_millis(1000));
}

#[test]
#[cfg_attr(debug_assertions, ignore = "release only")]
fn off_tile_liveness_suffix_stays_within_budget() {
    let mut steps = vec![(Op::Union, 0)];
    steps.extend(std::iter::repeat_n((Op::Difference, 1), 200_000));
    let mut s = scene(
        vec![
            box_prism([-130.0, -100.0, 0.0], 260.0, 200.0, 2.0),
            box_prism([1000.0, 1000.0, 0.0], 1.0, 1.0, 2.0),
        ],
        vec![body(&steps)],
    );
    s.width = 1024;
    s.height = 768;
    s.supersample = 2;
    s.analyse = false;
    s.draw_interference = false;
    let start = std::time::Instant::now();
    let (_, report) = render_rgb(&s, 1).unwrap();
    let elapsed = start.elapsed();
    println!("Off-tile liveness suffix: {elapsed:?}");
    assert_eq!(
        report.bodies[0].state,
        nodetto_capture::report::BodyState::Drawn
    );
    assert_eq!(report.bodies[0].emptied_by_step, -1);
    assert!(elapsed < std::time::Duration::from_millis(5000));
}
