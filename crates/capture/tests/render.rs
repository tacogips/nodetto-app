mod support;

use nodetto_capture::report::BodyState;
use nodetto_capture::scene::{parse_scene, Colours, Mesh, Op, Scene, Tool};
use nodetto_capture::{render_rgb, render_scene, ImageFormat};
use support::{body, box_prism, camera, digest, dot, pixel, project, unit};

const PLATE: &[u8] = include_bytes!("fixtures/plate-iso.ncs1");
const LOOPS: &[u8] = include_bytes!("fixtures/selected-loops-top.ncs1");

fn plate_top() -> Scene {
    let mut scene = parse_scene(PLATE).unwrap();
    scene.width = 720;
    scene.height = 320;
    scene.supersample = 1;
    scene.camera = camera([0.0, 0.0, -1.0], [85.0, 34.5, 0.0], 0.25);
    scene
}

fn at(scene: &Scene, rgb: &[u8], point: [f64; 3]) -> [u8; 3] {
    pixel(
        rgb,
        scene.width,
        project(&scene.camera, scene.width, scene.height, point),
    )
}

fn shade(scene: &Scene, normal: [f64; 3]) -> [u8; 3] {
    let camera = scene.camera;
    let light = unit(std::array::from_fn(|i| {
        0.8 * camera.forward[i] + 0.3 * camera.right[i] - 0.5 * camera.up[i]
    }));
    let factor = 0.42 + 0.58 * (-dot(normal, light)).max(0.0);
    scene
        .colours
        .body
        .map(|part| (f64::from(part) * factor).round() as u8)
}

fn small(tools: Vec<Tool>, bodies: Vec<nodetto_capture::scene::Body>) -> Scene {
    let mut scene = parse_scene(LOOPS).unwrap();
    scene.width = 96;
    scene.height = 96;
    scene.supersample = 1;
    scene.camera = camera([0.0, 0.0, -1.0], [0.0; 3], 0.25);
    scene.tools = tools;
    scene.bodies = bodies;
    scene
}

#[test]
fn plate_top_shows_holes_boss_pocket_and_clipped_puck() {
    let scene = plate_top();
    let (rgb, report) = render_rgb(&scene, 1).unwrap();
    let flat = shade(&scene, [0.0, 0.0, 1.0]);
    assert_eq!(at(&scene, &rgb, [10.0, 5.0, 5.0]), flat);
    assert_eq!(at(&scene, &rgb, [5.0, 5.0, 0.0]), scene.colours.background);
    assert_eq!(at(&scene, &rgb, [20.0, 20.0, 3.0]), flat);
    assert_eq!(at(&scene, &rgb, [62.0, 35.0, 13.0]), flat);
    assert_eq!(at(&scene, &rgb, [9.8, 20.0, 5.0]), scene.colours.edge);
    assert_eq!(
        at(&scene, &rgb, [141.0, 6.0, 8.0]),
        scene.colours.background
    );
    assert_eq!(
        at(&scene, &rgb, [155.0, 36.0, 8.0]),
        scene.colours.background
    );
    for y in [12.0, 20.0, 28.0] {
        assert_eq!(at(&scene, &rgb, [169.75, y, 8.0]), scene.colours.edge);
    }
    assert_eq!(at(&scene, &rgb, [167.0, 32.0, 8.0]), flat);
    assert_eq!(
        at(&scene, &rgb, [168.0, 33.0, 8.0]),
        scene.colours.background
    );
    assert!(report
        .bodies
        .iter()
        .all(|body| body.state == BodyState::Drawn));
}

#[test]
fn selected_loop_profiles_keep_discs_and_nested_filled_centres() {
    let scene = parse_scene(LOOPS).unwrap();
    let (rgb, _) = render_rgb(&scene, 2).unwrap();
    let flat = shade(&scene, [0.0, 0.0, 1.0]);
    assert_eq!(
        at(&scene, &rgb, [37.0, 20.0, 4.0]),
        scene.colours.background
    );
    assert_eq!(at(&scene, &rgb, [30.0, 20.0, 4.0]), flat);
    assert_eq!(at(&scene, &rgb, [110.0, 20.0, 4.0]), flat);
}

#[test]
fn grazing_plate_has_flat_interiors_rims_and_visible_through_holes() {
    for direction in [[0.0, 1.0, -0.15], [0.3, 1.0, -0.09], [0.0, 1.0, -0.05]] {
        let mut scene = plate_top();
        scene.width = 1240;
        scene.height = 260;
        scene.camera = camera(direction, [85.0, 35.0, 6.0], 0.15);
        let (rgb, _) = render_rgb(&scene, 2).unwrap();
        let flat = shade(&scene, [0.0, 0.0, 1.0]);
        assert_eq!(at(&scene, &rgb, [40.0, 32.0, 5.0]), flat, "{direction:?}");
        let edge_count = rgb
            .as_chunks::<3>()
            .0
            .iter()
            .filter(|p| **p == scene.colours.edge)
            .count();
        let solid_count = rgb
            .as_chunks::<3>()
            .0
            .iter()
            .filter(|p| **p != scene.colours.background)
            .count();
        assert!(
            edge_count > 0 && edge_count * 10 <= solid_count,
            "{direction:?}: {edge_count}/{solid_count}"
        );
    }

    // The full-height holes are occluded by their own walls in the standard
    // 5 mm plate at such low angles. A thin copy exposes background through them.
    let mut scene = plate_top();
    scene.bodies.truncate(1);
    scene.bodies[0].steps.truncate(2);
    if let [Tool::Prism(plate), Tool::Prism(drill), ..] = &mut scene.tools[..] {
        plate.t1 = 0.10;
        drill.o[2] = 0.10;
        drill.t1 = -0.10;
    } else {
        panic!("expected the plate and drill tools");
    }
    scene.camera = camera([0.0, 1.0, -0.05], [20.0, 30.0, 0.0], 0.04);
    scene.width = 1200;
    let (rgb, _) = render_rgb(&scene, 2).unwrap();
    assert_eq!(at(&scene, &rgb, [5.0, 4.1, 0.10]), scene.colours.background);
    assert_eq!(
        at(&scene, &rgb, [8.0, 5.0, 0.10]),
        shade(&scene, [0.0, 0.0, 1.0])
    );
}

#[test]
fn nearest_face_wins_and_hidden_is_distinct_from_absent() {
    let mut scene = plate_top();
    scene
        .tools
        .push(box_prism([86.0, 47.0, 2.1], 20.0, 20.0, 2.0));
    scene.bodies.push(body(&[(Op::Union, 7)]));
    scene
        .tools
        .push(box_prism([600.0, 0.0, 0.0], 1.0, 1.0, 1.0));
    scene.bodies.push(body(&[(Op::Union, 8)]));
    // An intersection that misses the ray must clear the body.
    scene
        .bodies
        .push(body(&[(Op::Union, 7), (Op::Intersection, 8)]));
    let (_, report) = render_rgb(&scene, 3).unwrap();
    assert_eq!(
        report
            .bodies
            .iter()
            .map(|body| body.state)
            .collect::<Vec<_>>(),
        [
            BodyState::Drawn,
            BodyState::Drawn,
            BodyState::Drawn,
            BodyState::Hidden,
            BodyState::Absent,
            BodyState::Absent
        ]
    );

    scene.camera = camera([0.0, 1.0, -0.35], [87.5, 45.0, 8.0], 0.25);
    let (rgb, _) = render_rgb(&scene, 1).unwrap();
    let block_shade = shade(&scene, [0.0, -1.0, 0.0]);
    assert_ne!(block_shade, shade(&scene, [0.0, 0.0, 1.0]));
    assert_eq!(at(&scene, &rgb, [90.0, 45.0, 6.5]), block_shade);
}

#[test]
fn same_plane_caps_and_trimmed_boss_do_not_leave_streaks() {
    let mut plate = box_prism([-3.91, -3.37, -1.73], 9.6, 8.8, 0.3);
    let mut trim = box_prism([0.0; 3], 3.5, 4.2, -0.1);
    let n = unit([0.353, 0.229, 0.897]);
    let u = unit([n[1], -n[0], 0.0]);
    let v = [
        n[1] * u[2] - n[2] * u[1],
        n[2] * u[0] - n[0] * u[2],
        n[0] * u[1] - n[1] * u[0],
    ];
    let Tool::Prism(base) = &mut plate else {
        unreachable!()
    };
    let Tool::Prism(cut) = &mut trim else {
        unreachable!()
    };
    let surface = |x: f64, y: f64, z: f64| {
        std::array::from_fn(|i| base.o[i] + x * u[i] + y * v[i] + z * n[i])
    };
    let cut_from = surface(2.7, 2.3, 0.3 + 0.1);
    let centre = surface(4.25, 4.5, 0.3);
    base.u = u;
    base.v = v;
    base.n = n;
    cut.o = cut_from;
    cut.u = u;
    cut.v = v;
    cut.n = n;
    // An add followed by a cut down to the original surface changes face ids
    // inside the boss footprint but leaves a single geometric plane.
    let mut boss = box_prism(cut_from, 3.5, 4.2, -0.1);
    let Tool::Prism(prism) = &mut boss else {
        unreachable!()
    };
    prism.u = u;
    prism.v = v;
    prism.n = n;
    let mut scene = small(vec![plate, boss, trim], vec![body(&[(Op::Union, 0)])]);
    scene.camera = camera([-0.36, -0.48, -0.8], centre, 0.085);
    let (plain, _) = render_rgb(&scene, 1).unwrap();
    scene.bodies[0].steps = body(&[(Op::Union, 0), (Op::Union, 1), (Op::Difference, 2)]).steps;
    let (trimmed, _) = render_rgb(&scene, 4).unwrap();
    assert!(
        trimmed == plain,
        "trimming to the top should preserve every pixel"
    );

    // Intersect the plate with a prism whose top is coincident but comes
    // from a different origin. All interior top samples remain the same.
    if let Tool::Prism(tool) = &mut scene.tools[2] {
        tool.o = std::array::from_fn(|i| cut_from[i] - 0.1 * n[i]);
        tool.t1 = -1.0;
    }
    scene.bodies[0].steps = body(&[(Op::Union, 0), (Op::Intersection, 2)]).steps;
    let (clipped, _) = render_rgb(&scene, 2).unwrap();
    let flat = shade(&scene, n);
    for y in 35..60 {
        for x in 35..60 {
            assert_eq!(pixel(&clipped, scene.width, (x, y)), flat, "({x}, {y})");
        }
    }
}

#[test]
fn contacting_and_overlapping_bodies_keep_the_earlier_face_at_a_tie() {
    let base = box_prism([-8.0, -5.0, 0.0], 11.0, 10.0, 5.0);
    // The second prism uses the opposite extrusion from an independently
    // rotated frame at height five. Its top and the base top coincide.
    let mut other = box_prism([7.0, 5.0, 5.0 + 0.5e-7], 10.0, 10.0, -3.0);
    let Tool::Prism(prism) = &mut other else {
        unreachable!()
    };
    prism.u = [-1.0, 0.0, 0.0];
    prism.v = [0.0, -1.0, 0.0];
    let mut scene = small(
        vec![base, other],
        vec![body(&[(Op::Union, 0)]), body(&[(Op::Union, 1)])],
    );
    scene.camera.mm_per_pixel = 0.25;
    let (rgb, _) = render_rgb(&scene, 3).unwrap();
    let flat = shade(&scene, [0.0, 0.0, 1.0]);
    for y in 34..62 {
        for x in 24..72 {
            let expected = if x == 59 { scene.colours.edge } else { flat };
            assert_eq!(pixel(&rgb, scene.width, (x, y)), expected, "({x}, {y})");
        }
    }
    // Put the second prism inside the first one in screen space. It is
    // entirely hidden despite being slightly nearer on every shared ray.
    if let Tool::Prism(prism) = &mut scene.tools[1] {
        prism.o = [2.0, 5.0, 5.0 + 0.5e-7];
    }
    let (_, report) = render_rgb(&scene, 1).unwrap();
    assert_eq!(report.bodies[1].state, BodyState::Hidden);
    if let Tool::Prism(prism) = &mut scene.tools[1] {
        prism.o[2] = 5.0 + 2.0e-7;
    }
    let (_, report) = render_rgb(&scene, 1).unwrap();
    assert_eq!(report.bodies[1].state, BodyState::Drawn);
}

#[test]
fn cube_in_iso_has_three_shades_and_curved_face_has_no_facet_lines() {
    let mut scene = small(
        vec![box_prism([-4.0, -4.0, -4.0], 8.0, 8.0, 8.0)],
        vec![body(&[(Op::Union, 0)])],
    );
    scene.camera = camera([-1.0, -1.0, -1.0], [0.0; 3], 0.16);
    let (rgb, _) = render_rgb(&scene, 2).unwrap();
    let mut colours =
        [[4.0, 0.0, 0.0], [0.0, 4.0, 0.0], [0.0, 0.0, 4.0]].map(|p| at(&scene, &rgb, p));
    colours.sort_unstable();
    assert!(colours.windows(2).all(|p| p[0] != p[1]), "{colours:?}");
    assert!(colours
        .iter()
        .all(|p| *p != scene.colours.edge && *p != scene.colours.background));
    assert!(rgb.as_chunks::<3>().0.contains(&scene.colours.edge));

    if let Tool::Prism(prism) = &mut scene.tools[0] {
        prism.o = [0.0, 0.0, -6.0];
        prism.t1 = 12.0;
        // A 64-sided profile with one opaque source face id names a cylinder.
        prism.loops[0].points = (0..64)
            .flat_map(|i| {
                let angle = f64::from(i) * std::f64::consts::TAU / 64.0;
                [4.0 * angle.cos(), 4.0 * angle.sin()]
            })
            .collect();
        prism.loops[0].faces = vec![u32::MAX; 64];
    }
    scene.camera = camera([0.0, 1.0, 0.0], [0.0; 3], 0.12);
    let (rgb, _) = render_rgb(&scene, 3).unwrap();
    let row = (26..70)
        .map(|x| pixel(&rgb, scene.width, (x, 48)))
        .collect::<Vec<_>>();
    assert!(row
        .iter()
        .all(|p| *p != scene.colours.edge && *p != scene.colours.background));
    assert_ne!(
        row[0], row[22],
        "one face id still uses distinct facet normals"
    );
}

#[test]
fn reports_and_encoded_images_are_deterministic_across_workers() {
    let scene = parse_scene(PLATE).unwrap();
    let one = render_rgb(&scene, 1).unwrap();
    for workers in [0, 1, 2, 5] {
        assert_eq!(render_rgb(&scene, workers).unwrap(), one);
    }
    assert_eq!(
        digest(&one.0),
        0x29c6_4b3e_156d_0941,
        "new RGB digest: {:016x}",
        digest(&one.0)
    );
    for format in [ImageFormat::Png, ImageFormat::Jpeg { quality: 90 }] {
        let first = render_scene(PLATE, format, 1).unwrap();
        let second = render_scene(PLATE, format, 2).unwrap();
        assert_eq!(first.image, second.image);
        assert_eq!(first.report, one.1.to_json());
        let expected = format!(
            "{{\"width\":{},\"height\":{},\"bodies\":[{body},{body},{body}],\"analysis\":{analysis},\"pairs\":[{pair}]}}",
            one.1.width, one.1.height,
            body = r#"{"state":"drawn","emptiedByStep":-1,"open":false}"#,
            analysis = r#"{"cell":0.250,"candidates":1,"checked":1,"unchecked":[],"uncheckedCount":0,"cappedCount":0,"budget":24000000,"cappedWithoutHit":[]}"#,
            pair = r#"{"a":0,"b":1,"volume":590.404,"min":[85.000,45.000,2.000],"max":[100.000,60.000,5.000],"source":"analysis","capped":false}"#,
        );
        assert_eq!(first.report, expected);
    }
}

#[test]
fn sampling_and_left_handed_cameras_keep_the_picture_well_defined() {
    let box_tool = box_prism([-7.0, -5.0, 0.0], 6.0, 10.0, 5.0);
    let mut scene = small(vec![box_tool], vec![body(&[(Op::Union, 0)])]);
    scene.width = 64;
    scene.height = 64;
    scene.camera.mm_per_pixel = 0.257;
    for factor in [1, 2, 3] {
        scene.supersample = factor;
        let (rgb, report) = render_rgb(&scene, 2).unwrap();
        assert_eq!(rgb.len(), 64 * 64 * 3);
        assert_eq!(report.bodies[0].state, BodyState::Drawn);
        assert_ne!(pixel(&rgb, 64, (16, 32)), scene.colours.background);
        if factor == 3 {
            assert!(rgb
                .as_chunks::<3>()
                .0
                .iter()
                .any(|p| *p != scene.colours.background
                    && *p != scene.colours.edge
                    && *p != shade(&scene, [0.0, 0.0, 1.0])));
        }
        scene.camera.right = scene.camera.right.map(|v| -v);
        let (mirrored, _) = render_rgb(&scene, 1).unwrap();
        assert_eq!(pixel(&mirrored, 64, (47, 32)), pixel(&rgb, 64, (16, 32)));
        assert_eq!(pixel(&mirrored, 64, (16, 32)), scene.colours.background);
        scene.camera.right = scene.camera.right.map(|v| -v);
    }
}

#[test]
fn references_meshes_and_interference_stay_out_of_the_m8_picture() {
    let solid = box_prism([-4.0, -4.0, 0.0], 8.0, 8.0, 1.0);
    let reference = box_prism([-7.0, -7.0, 2.0], 14.0, 14.0, 5.0);
    let mut scene = small(vec![solid, reference], vec![body(&[(Op::Union, 0)])]);
    let (baseline, _) = render_rgb(&scene, 1).unwrap();
    scene.tools.push(Tool::Mesh(Mesh {
        positions: vec![0.0, 0.0, 2.0, 8.0, 0.0, 2.0, 0.0, 8.0, 2.0],
        triangles: vec![0, 1, 2],
    }));
    let mut reference = body(&[(Op::Union, 1)]);
    reference.reference = true;
    scene.bodies.push(reference);
    scene.bodies.push(body(&[(Op::Union, 2)]));
    scene.analyse = true;
    scene.budget_million_rays = 1;
    scene.draw_interference = true;
    let (actual, report) = render_rgb(&scene, 2).unwrap();
    assert_eq!(baseline, actual);
    assert_eq!(
        report.analysis.unwrap(),
        nodetto_capture::report::Analysis {
            cell: scene.target_cell,
            candidates: 0,
            checked: 0,
            unchecked: vec![],
            unchecked_count: 0,
            capped_count: 0,
            capped_without_hit: vec![],
            budget: 1_000_000
        }
    );
    assert!(report.pairs.is_empty());
    assert_eq!(report.bodies[1].state, BodyState::Absent);
    assert_eq!(report.bodies[2].state, BodyState::Absent);
}

#[test]
fn reference_fixture_remains_legible_in_both_canvas_palettes() {
    let mut scene = plate_top();
    for colours in [
        Colours {
            background: [246, 244, 238],
            body: [255, 253, 248],
            edge: [89, 99, 102],
            interference: [51, 92, 103],
        },
        Colours {
            background: [21, 25, 27],
            body: [31, 36, 39],
            edge: [163, 173, 177],
            interference: [95, 180, 199],
        },
    ] {
        scene.colours = colours;
        // Tilt and roll the camera until the light points straight down.
        let lateral = 0.34_f64.sqrt();
        let length = 0.98_f64.sqrt();
        let (sin_tilt, cos_tilt) = (lateral / length, 0.8 / length);
        let (sin_roll, cos_roll) = (0.3 / lateral, 0.5 / lateral);
        scene.camera = camera([sin_tilt, 0.0, -cos_tilt], [85.0, 34.5, 0.0], 0.35);
        scene.camera.right = [-sin_roll * cos_tilt, -cos_roll, -sin_roll * sin_tilt];
        scene.camera.up = [cos_roll * cos_tilt, -sin_roll, cos_roll * sin_tilt];
        let (rgb, _) = render_rgb(&scene, 2).unwrap();
        let flat = at(&scene, &rgb, [10.0, 6.0, 5.0]);
        assert_eq!(flat, colours.body);
        assert_ne!(flat, colours.background);
        assert!(rgb.as_chunks::<3>().0.contains(&colours.edge));
    }
}

#[test]
fn invalid_scene_and_encoding_errors_reach_the_caller() {
    assert!(render_scene(&PLATE[..40], ImageFormat::Png, 1).is_err());
    assert!(render_scene(LOOPS, ImageFormat::Jpeg { quality: 0 }, 1).is_err());
    let mut scene = parse_scene(LOOPS).unwrap();
    scene.supersample = 0;
    assert!(render_rgb(&scene, 1).is_err());
}

#[test]
#[cfg_attr(debug_assertions, ignore = "release only")]
fn reference_render_stays_within_the_one_thread_budget() {
    let scene = parse_scene(PLATE).unwrap();
    let start = std::time::Instant::now();
    let (rgb, _) = render_rgb(&scene, 1).unwrap();
    let elapsed = start.elapsed();
    println!("Plate render on one thread: {elapsed:?}");
    assert_eq!(rgb.len(), (scene.width * scene.height * 3) as usize);
    assert!(
        elapsed < std::time::Duration::from_millis(2000),
        "{elapsed:?}"
    );
}

#[test]
#[cfg_attr(debug_assertions, ignore = "release only")]
fn large_raster_spans_many_bands_at_maximum_sampling() {
    let mut scene = small(
        vec![box_prism([-10.0, -10.0, 0.0], 20.0, 20.0, 1.0)],
        vec![body(&[(Op::Union, 0)])],
    );
    scene.width = 2048;
    scene.height = 2048;
    scene.supersample = 3;
    scene.camera.mm_per_pixel = 0.0125;
    let (rgb, report) = render_rgb(&scene, 5).unwrap();
    assert_eq!(rgb.len(), 2048 * 2048 * 3);
    assert_eq!(report.bodies[0].state, BodyState::Drawn);
    let flat = shade(&scene, [0.0, 0.0, 1.0]);
    for y in [31, 32, 511, 512, 1023, 1024, 1535, 1536, 2000] {
        assert_eq!(
            pixel(&rgb, scene.width, (1024, y)),
            if (224..1824).contains(&y) {
                flat
            } else {
                scene.colours.background
            }
        );
    }
}

#[test]
fn a_shallow_corner_draws_an_edge_only_for_distinct_face_ids() {
    let mut wedge = box_prism([0.0, 0.0, -4.0], 10.0, 5.0, 8.0);
    let Tool::Prism(prism) = &mut wedge else {
        panic!("expected a prism");
    };
    // Both visible faces slope by arctan(1/5) from a plane perpendicular
    // to the view. The normal-to-normal angle is about 22.6 degrees.
    prism.loops[0].points = vec![-5.0, 1.0, 0.0, 0.0, 5.0, 1.0, 5.0, 5.0, -5.0, 5.0];
    prism.loops[0].faces = vec![2, 3, 4, 5, 6];

    let mut scene = small(vec![wedge], vec![body(&[(Op::Union, 0)])]);
    scene.camera = camera([0.0, 1.0, 0.0], [0.0; 3], 0.125);
    let (distinct, _) = render_rgb(&scene, 1).unwrap();

    let Tool::Prism(prism) = &mut scene.tools[0] else {
        panic!("expected a prism");
    };
    prism.loops[0].faces[1] = 2;
    let (shared, _) = render_rgb(&scene, 1).unwrap();
    assert_eq!(pixel(&distinct, scene.width, (47, 48)), scene.colours.edge);
    assert_ne!(pixel(&shared, scene.width, (47, 48)), scene.colours.edge);
    for x in [46, 48] {
        assert_eq!(
            pixel(&distinct, scene.width, (x, 48)),
            pixel(&shared, scene.width, (x, 48))
        );
    }
}

#[test]
fn report_serializes_interim_and_future_body_state_words() {
    use nodetto_capture::report::{BodyReport, Report};
    let report = Report {
        width: 64,
        height: 64,
        bodies: [
            BodyState::Hidden,
            BodyState::Absent,
            BodyState::Empty,
            BodyState::Unknown,
        ]
        .map(|state| BodyReport {
            state,
            emptied_by_step: -1,
            open: false,
        })
        .to_vec(),
        analysis: None,
        pairs: Vec::new(),
    };
    assert_eq!(
        report.to_json(),
        concat!(
            r#"{"width":64,"height":64,"bodies":["#,
            r#"{"state":"hidden","emptiedByStep":-1,"open":false},"#,
            r#"{"state":"absent","emptiedByStep":-1,"open":false},"#,
            r#"{"state":"empty","emptiedByStep":-1,"open":false},"#,
            r#"{"state":"unknown","emptiedByStep":-1,"open":false}],"#,
            r#""analysis":null,"pairs":[]}"#,
        ),
    );
}
