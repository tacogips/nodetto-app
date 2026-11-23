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
