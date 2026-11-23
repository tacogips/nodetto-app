#[allow(dead_code)]
mod support;

use nodetto_capture::render_rgb;
use nodetto_capture::report::BodyState;
use nodetto_capture::scene::{Op, Tool};
use support::{body, box_prism, cube_mesh, pixel, scene};

#[test]
fn mesh_cut_and_open_mesh_are_drawn_with_correct_solid_status() {
    let mut s = scene(
        vec![cube_mesh(), box_prism([-1.0, -1.0, -1.0], 2.0, 2.0, 6.0)],
        vec![body(&[(Op::Union, 0), (Op::Difference, 1)])],
    );
    let (image, report) = render_rgb(&s, 1).unwrap();
    assert_eq!(report.bodies[0].state, BodyState::Drawn);
    assert!(!report.bodies[0].open);
    assert_eq!(pixel(&image, s.width, (48, 48)), s.colours.background);
    assert_ne!(pixel(&image, s.width, (56, 48)), s.colours.background);
    if let Tool::Mesh(mesh) = &mut s.tools[0] {
        mesh.triangles.truncate(mesh.triangles.len() - 3);
    }
    s.bodies[0].steps.truncate(1);
    s.bodies[0].analysed = true;
    let (image, report) = render_rgb(&s, 2).unwrap();
    assert_eq!(report.bodies[0].state, BodyState::Drawn);
    assert!(report.bodies[0].open);
    assert!(report.pairs.is_empty());
    assert_ne!(pixel(&image, s.width, (56, 48)), s.colours.background);
}

#[test]
fn reference_in_front_does_not_hide_solid() {
    let mut reference = body(&[(Op::Union, 1)]);
    reference.reference = true;
    let mut s = scene(
        vec![
            box_prism([-4.0, -4.0, 0.0], 8.0, 8.0, 1.0),
            box_prism([-5.0, -5.0, 2.0], 10.0, 10.0, 1.0),
        ],
        vec![body(&[(Op::Union, 0)]), reference],
    );
    let (mixed, report) = render_rgb(&s, 1).unwrap();
    assert_eq!(report.bodies[0].state, BodyState::Drawn);
    assert_eq!(report.bodies[1].state, BodyState::Drawn);
    s.bodies[1].reference = false;
    let (opaque, report) = render_rgb(&s, 1).unwrap();
    assert_eq!(report.bodies[0].state, BodyState::Hidden);
    assert_ne!(
        pixel(&mixed, s.width, (30, 30)),
        pixel(&opaque, s.width, (30, 30))
    );
}

#[test]
#[cfg_attr(debug_assertions, ignore = "release only")]
fn two_hundred_thousand_triangles_fit_render_budget() {
    let mut positions = Vec::with_capacity(501 * 201 * 3);
    let mut triangles = Vec::with_capacity(500 * 200 * 6);
    for y in 0..=200 {
        for x in 0..=500 {
            positions.extend([x as f64 * 0.4 - 100.0, y as f64 * 0.4 - 40.0, 0.0]);
        }
    }
    for y in 0..200_u32 {
        for x in 0..500_u32 {
            let a = y * 501 + x;
            triangles.extend([a, a + 1, a + 502, a, a + 502, a + 501]);
        }
    }
    let mut s = scene(
        vec![Tool::Mesh(nodetto_capture::scene::Mesh {
            positions,
            triangles,
        })],
        vec![body(&[(Op::Union, 0)])],
    );
    s.width = 1024;
    s.height = 768;
    let start = std::time::Instant::now();
    let (_, report) = render_rgb(&s, 1).unwrap();
    println!("200,000 triangle mesh: {:?}", start.elapsed());
    assert!(report.bodies[0].open);
    assert!(start.elapsed() < std::time::Duration::from_millis(3000));
}
