#[allow(dead_code)]
mod support;

use nodetto_capture::render_rgb;
use nodetto_capture::report::BodyState;
use nodetto_capture::scene::{Op, Tool};
use support::{body, box_prism, cube_mesh, pixel, scene};

#[test]
fn welded_edge_contact_is_closed() {
    let corners = [
        [0., 0., 0.],
        [10., 0., 0.],
        [10., 10., 0.],
        [0., 10., 0.],
        [0., 0., 5.],
        [10., 0., 5.],
        [10., 10., 5.],
        [0., 10., 5.],
    ];
    let faces = [
        0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6,
        3, 0, 4, 3, 4, 7,
    ];
    let mut points: Vec<[f64; 3]> = Vec::new();
    let mut triangles = Vec::new();
    for offset in [0., 10.] {
        let mut indices = [0_u32; 8];
        for (i, p) in corners.iter().enumerate() {
            let p = [p[0] + offset, p[1] + offset, p[2]];
            let index = points.iter().position(|v| *v == p).unwrap_or_else(|| {
                points.push(p);
                points.len() - 1
            });
            indices[i] = index as u32;
        }
        triangles.extend(faces.iter().map(|&i| indices[i]));
    }
    let mesh = nodetto_capture::scene::Mesh {
        positions: points.iter().flatten().copied().collect(),
        triangles,
    };
    assert!(nodetto_capture::mesh::closed_by(
        points.len(),
        &mesh.triangles,
        |i| points[i]
    ));
    assert!(nodetto_capture::mesh::is_closed(&mesh));
}

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

#[test]
fn open_operands_and_sources_follow_first_tool_rule() {
    let mut mesh = cube_mesh();
    if let Tool::Mesh(mesh) = &mut mesh {
        mesh.triangles.truncate(mesh.triangles.len() - 3);
    }
    let prism = box_prism([-4.0, -4.0, 0.0], 8.0, 8.0, 4.0);
    let mut s = scene(vec![prism, mesh], vec![body(&[(Op::Union, 0)])]);
    let (original, _) = render_rgb(&s, 1).unwrap();
    s.bodies[0] = body(&[(Op::Union, 0), (Op::Difference, 1)]);
    let (difference, report) = render_rgb(&s, 1).unwrap();
    assert_eq!(difference, original);
    assert!(!report.bodies[0].open);
    assert_eq!(report.bodies[0].state, BodyState::Drawn);
    s.bodies[0] = body(&[(Op::Union, 0), (Op::Intersection, 1)]);
    let (_, report) = render_rgb(&s, 1).unwrap();
    assert_eq!(report.bodies[0].state, BodyState::Empty);
    assert_eq!(report.bodies[0].emptied_by_step, 1);
    s.bodies[0] = body(&[(Op::Union, 1)]);
    let (open, _) = render_rgb(&s, 1).unwrap();
    s.bodies[0] = body(&[(Op::Union, 1), (Op::Difference, 0)]);
    s.bodies[0].analysed = true;
    let (cut, report) = render_rgb(&s, 1).unwrap();
    assert_eq!(cut, open);
    assert!(report.bodies[0].open);
    assert_eq!(report.bodies[0].emptied_by_step, -1);
    assert!(report.pairs.is_empty());
}

#[test]
fn reference_composites_at_45_percent_and_can_be_hidden() {
    let mut reference = body(&[(Op::Union, 1)]);
    reference.reference = true;
    let mut s = scene(
        vec![
            box_prism([-4.0, -4.0, 0.0], 8.0, 8.0, 1.0),
            box_prism([-4.0, -4.0, 2.0], 8.0, 8.0, 1.0),
        ],
        vec![body(&[(Op::Union, 0)]), reference],
    );
    if let Tool::Prism(front) = &mut s.tools[1] {
        front.o[2] = 6.0;
        front.u = [0.866_025_403_784_438_6, 0.0, -0.5];
        front.n = [0.5, 0.0, 0.866_025_403_784_438_6];
    }
    s.reference_opacity = 115;
    let (mixed, report) = render_rgb(&s, 1).unwrap();
    assert_eq!(report.bodies[0].state, BodyState::Drawn);
    assert_eq!(report.bodies[1].state, BodyState::Drawn);
    let sample = (48, 48);
    let mixed_pixel = pixel(&mixed, s.width, sample);
    s.bodies.pop();
    let behind = pixel(&render_rgb(&s, 1).unwrap().0, s.width, sample);
    s.bodies = vec![body(&[(Op::Union, 1)])];
    let front = pixel(&render_rgb(&s, 1).unwrap().0, s.width, sample);
    assert_ne!(front, behind);
    let expected = std::array::from_fn(|i| {
        ((u32::from(behind[i]) * 140 + u32::from(front[i]) * 115 + 127) / 255) as u8
    });
    assert_eq!(mixed_pixel, expected);

    s.tools[1] = box_prism([-5.0, -5.0, 2.0], 10.0, 10.0, 1.0);
    let mut behind_reference = body(&[(Op::Union, 0)]);
    behind_reference.reference = true;
    s.bodies = vec![behind_reference, body(&[(Op::Union, 1)])];
    let (_, report) = render_rgb(&s, 1).unwrap();
    assert_eq!(report.bodies[0].state, BodyState::Hidden);
    assert_eq!(report.bodies[1].state, BodyState::Drawn);
}

#[test]
fn open_mesh_outside_the_camera_is_outside() {
    let mut mesh = cube_mesh();
    if let Tool::Mesh(mesh) = &mut mesh {
        mesh.triangles.truncate(mesh.triangles.len() - 3);
        for x in mesh.positions.iter_mut().step_by(3) {
            *x += 100.0;
        }
    }
    let s = scene(vec![mesh], vec![body(&[(Op::Union, 0)])]);
    let (_, report) = render_rgb(&s, 1).unwrap();
    assert!(report.bodies[0].open);
    assert_eq!(report.bodies[0].state, BodyState::Outside);
}

#[test]
fn sphere_mesh_edges_are_confined_to_its_outline() {
    const RINGS: u32 = 32;
    const SEGMENTS: u32 = 64;
    let mut positions = vec![0.0, 0.0, 4.0];
    for ring in 1..RINGS {
        let theta = std::f64::consts::PI * f64::from(ring) / f64::from(RINGS);
        for segment in 0..SEGMENTS {
            let phi = std::f64::consts::TAU * f64::from(segment) / f64::from(SEGMENTS);
            positions.extend([
                4.0 * theta.sin() * phi.cos(),
                4.0 * theta.sin() * phi.sin(),
                4.0 * theta.cos(),
            ]);
        }
    }
    let south = 1 + (RINGS - 1) * SEGMENTS;
    positions.extend([0.0, 0.0, -4.0]);
    let mut triangles = Vec::new();
    for segment in 0..SEGMENTS {
        let next = (segment + 1) % SEGMENTS;
        triangles.extend([0, 1 + segment, 1 + next]);
        for ring in 0..RINGS - 2 {
            let a = 1 + ring * SEGMENTS + segment;
            let b = 1 + ring * SEGMENTS + next;
            triangles.extend([a, a + SEGMENTS, b, b, a + SEGMENTS, b + SEGMENTS]);
        }
        let last = 1 + (RINGS - 2) * SEGMENTS;
        triangles.extend([south, last + next, last + segment]);
    }
    let s = scene(
        vec![Tool::Mesh(nodetto_capture::scene::Mesh {
            positions,
            triangles,
        })],
        vec![body(&[(Op::Union, 0)])],
    );
    let (image, report) = render_rgb(&s, 1).unwrap();
    assert_eq!(report.bodies[0].state, BodyState::Drawn);
    let mut edge_count = 0;
    for y in 0..s.height as usize {
        for x in 0..s.width as usize {
            if pixel(&image, s.width, (x, y)) == s.colours.edge {
                edge_count += 1;
                let distance =
                    ((x as f64 + 0.5 - 48.0).powi(2) + (y as f64 + 0.5 - 48.0).powi(2)).sqrt();
                assert!(
                    (14.0..=18.0).contains(&distance),
                    "interior edge at ({x}, {y}), radius {distance}"
                );
            }
        }
    }
    assert!(edge_count > 0);
}

#[derive(Default)]
struct ContactFixture {
    points: Vec<[f64; 3]>,
    triangles: Vec<u32>,
}

impl ContactFixture {
    fn vertex(&mut self, point: [f64; 3]) -> u32 {
        match self.points.iter().position(|p| *p == point) {
            Some(index) => index as u32,
            None => {
                self.points.push(point);
                (self.points.len() - 1) as u32
            }
        }
    }

    fn cube(&mut self, min: [f64; 3], max: [f64; 3], crossed: bool, reverse: bool) {
        let [x, y, z] = min;
        let [a, b, c] = max;
        let ids = [
            [x, y, z],
            [a, y, z],
            [a, b, z],
            [x, b, z],
            [x, y, c],
            [a, y, c],
            [a, b, c],
            [x, b, c],
        ]
        .map(|point| self.vertex(point));
        let faces = [
            [0, 3, 2, 1],
            [4, 5, 6, 7],
            [0, 1, 5, 4],
            [1, 2, 6, 5],
            [2, 3, 7, 6],
            [3, 0, 4, 7],
        ];
        for (index, f) in faces.iter().enumerate() {
            let triangles = if !crossed && index == 5 {
                [[f[0], f[1], f[3]], [f[1], f[2], f[3]]]
            } else {
                [[f[0], f[1], f[2]], [f[0], f[2], f[3]]]
            };
            for mut triangle in triangles {
                if reverse {
                    triangle.swap(1, 2);
                }
                self.triangles.extend(triangle.map(|i| ids[i]));
            }
        }
    }

    fn pair(min: [f64; 3], max: [f64; 3], crossed: bool) -> Self {
        let mut fixture = Self::default();
        fixture.cube([0., 0., 0.], [10., 10., 5.], false, false);
        fixture.cube(min, max, crossed, false);
        fixture
    }

    fn assert_closed(&self, expected: bool, name: &str) {
        let mesh = nodetto_capture::scene::Mesh {
            positions: self.points.iter().flatten().copied().collect(),
            triangles: self.triangles.clone(),
        };
        assert_eq!(
            nodetto_capture::mesh::closed_by(self.points.len(), &self.triangles, |i| self.points
                [i]),
            expected,
            "closed_by: {name}"
        );
        assert_eq!(
            nodetto_capture::mesh::is_closed(&mesh),
            expected,
            "is_closed: {name}"
        );
    }
}

#[test]
fn contact_closure_fixture_classifications() {
    let edge = || ContactFixture::pair([10., 10., 0.], [20., 20., 5.], false);
    edge().assert_closed(true, "edge");
    ContactFixture::pair([10., 0., 0.], [20., 10., 5.], false).assert_closed(true, "face");
    ContactFixture::pair([10., 0., 0.], [20., 10., 5.], true).assert_closed(true, "crossed face");
    ContactFixture::pair([12., 0., 0.], [22., 10., 5.], false).assert_closed(true, "separated");
    let mut open = ContactFixture::default();
    open.cube([0., 0., 0.], [10., 10., 5.], false, false);
    let extra = open.vertex([5., -1., 0.]);
    open.triangles.extend([0, 1, extra]);
    open.assert_closed(false, "open triangle");
    let mut unbalanced = edge();
    let a = unbalanced.vertex([10., 10., 0.]);
    let b = unbalanced.vertex([10., 10., 5.]);
    let triangle = unbalanced.triangles[36..]
        .as_chunks_mut::<3>()
        .0
        .iter_mut()
        .find(|t| t.contains(&a) && t.contains(&b))
        .unwrap();
    triangle.swap(1, 2);
    unbalanced.assert_closed(false, "unbalanced");
    ContactFixture::pair([0., 0., 0.], [6., 6., 5.], false).assert_closed(false, "overlap");
    let mut fin = edge();
    let p = [[10., 10., 0.], [10., 10., 5.], [13., 7., 5.], [13., 7., 0.]].map(|v| fin.vertex(v));
    fin.triangles.extend([
        p[0], p[1], p[2], p[0], p[2], p[3], p[0], p[3], p[1], p[1], p[3], p[2],
    ]);
    fin.assert_closed(false, "fin");
    let mut coincident = ContactFixture::default();
    coincident.cube([0., 0., 0.], [1., 1., 1.], false, false);
    coincident.cube([0., 0., 0.], [1., 1., 1.], false, true);
    coincident.cube([2., 0., 0.], [3., 1., 1.], false, false);
    coincident.assert_closed(false, "coincident");
    let mut off_grid = ContactFixture::default();
    off_grid.cube([0., 0., 0.], [0.0004, 0.0004, 5.], false, false);
    off_grid.cube([0.0004, 0.0004, 0.], [0.0008, 0.0008, 5.], false, false);
    off_grid.assert_closed(false, "off grid");
}
