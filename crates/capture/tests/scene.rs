use nodetto_capture::scene::{parse_scene, Op, Scene, Step, Tool};

const PLATE: &[u8] = include_bytes!("fixtures/plate-iso.ncs1");
const SELECTED_LOOPS: &[u8] = include_bytes!("fixtures/selected-loops-top.ncs1");

const FIRST_TOOL: usize = 176;
const FIRST_LOOP: usize = FIRST_TOOL + 120;
const PLATE_BODIES: usize = 46_672;

#[test]
fn reads_the_plate_scene_written_by_typescript() {
    let scene = parse_scene(PLATE).unwrap();
    assert_eq!(
        (scene.width, scene.height, scene.supersample),
        (1024, 768, 2)
    );
    assert_eq!(scene.tools.len(), 7);
    assert_eq!(scene.bodies.len(), 3);
    assert!(scene.hidden.is_empty());
    assert!(scene.analyse);
    assert!(scene.draw_interference);
    assert_eq!(
        (
            scene.budget_million_rays,
            scene.tolerance,
            scene.target_cell
        ),
        (24, 0.001, 0.25)
    );
    assert_eq!(scene.reference_opacity, 115);
    assert_eq!(scene.colours.background, [246, 244, 238]);
    assert_eq!(scene.colours.body, [255, 253, 248]);
    assert_eq!(scene.colours.edge, [89, 99, 102]);
    assert_eq!(scene.colours.interference, [51, 92, 103]);
    assert_eq!(
        scene.camera.right,
        [-0.7071067811865475, 0.7071067811865475, 0.0]
    );
    assert_eq!(
        scene.camera.up,
        [-0.408248290463863, -0.408248290463863, 0.816496580927726]
    );
    assert_eq!(scene.camera.forward, [-0.5773502691896258; 3]);
    assert_eq!(
        scene.camera.centre,
        [41.16666666666667, -11.333333333333332, -29.833333333333336]
    );
    assert_eq!(scene.camera.mm_per_pixel, 0.16779975373860453);
    let profiles: Vec<_> = scene
        .tools
        .iter()
        .map(|tool| {
            let Tool::Prism(prism) = tool else {
                panic!("expected a prism")
            };
            prism
        })
        .collect();
    assert_eq!(
        profiles.iter().map(|p| p.loops.len()).collect::<Vec<_>>(),
        [1, 60, 1, 2, 1, 1, 1]
    );
    let plate = profiles[0];
    assert_eq!(plate.o, [0.0; 3]);
    assert_eq!(plate.u, [1.0, 0.0, 0.0]);
    assert_eq!(plate.v, [0.0, 1.0, 0.0]);
    assert_eq!(plate.n, [0.0, 0.0, 1.0]);
    assert_eq!((plate.t0, plate.t1), (0.0, 5.0));
    assert_eq!(
        plate.loops[0].points,
        [0.0, 0.0, 100.0, 0.0, 100.0, 60.0, 0.0, 60.0]
    );
    assert_eq!(plate.loops[0].faces, [2, 3, 4, 5]);
    assert_eq!((profiles[1].t0, profiles[1].t1), (0.0, -5.0));
    assert!(profiles[1]
        .loops
        .iter()
        .all(|l| l.faces.len() == 32 && l.faces.iter().all(|&f| f == l.faces[0])));
    assert!(scene.bodies.iter().all(|b| b.analysed && !b.reference));
    let steps = |body: usize| {
        scene.bodies[body]
            .steps
            .iter()
            .map(|step| (step.op, step.tool))
            .collect::<Vec<_>>()
    };
    assert_eq!(
        steps(0),
        [
            (Op::Union, 0),
            (Op::Difference, 1),
            (Op::Difference, 2),
            (Op::Union, 3)
        ]
    );
    assert_eq!(steps(1), [(Op::Union, 4)]);
    assert_eq!(steps(2), [(Op::Union, 5), (Op::Intersection, 6)]);
}

#[test]
fn reads_the_normalised_disc_and_slab_scene() {
    let scene = parse_scene(SELECTED_LOOPS).unwrap();
    assert_eq!(
        (scene.width, scene.height, scene.supersample),
        (640, 480, 2)
    );
    assert_eq!(scene.tools.len(), 2);
    assert_eq!(scene.bodies.len(), 2);
    assert!(!scene.analyse);
    assert!(!scene.draw_interference);
    assert_eq!(
        (
            scene.budget_million_rays,
            scene.tolerance,
            scene.target_cell
        ),
        (0, 0.001, 0.25)
    );
    assert_eq!(scene.camera.right, [1.0, 0.0, 0.0]);
    assert_eq!(scene.camera.up, [0.0, 1.0, 0.0]);
    assert_eq!(scene.camera.forward, [0.0, 0.0, -1.0]);
    assert_eq!(scene.camera.centre, [83.0, 20.0, 0.0]);
    assert_eq!(scene.camera.mm_per_pixel, 0.19237500000000002);
    for (index, expected_points) in [64, 4].into_iter().enumerate() {
        let Tool::Prism(prism) = &scene.tools[index] else {
            panic!("expected a prism")
        };
        assert_eq!(prism.loops.len(), 1);
        assert_eq!(prism.loops[0].points.len(), expected_points * 2);
        assert_eq!(prism.loops[0].faces.len(), expected_points);
        let body = &scene.bodies[index];
        assert!(!body.analysed);
        assert!(!body.reference);
        assert_eq!(
            body.steps,
            [Step {
                op: Op::Union,
                tool: index as u32
            }]
        );
    }
}

fn put(bytes: &mut [u8], offset: usize, patch: &[u8]) {
    bytes[offset..offset + patch.len()].copy_from_slice(patch);
}

fn reject(result: Result<Scene, nodetto_capture::CaptureError>, reason: &str) {
    let error = result.unwrap_err().to_string();
    assert!(error.contains(reason), "wanted {reason:?}, got {error:?}");
}

fn plate_word_edit(offset: usize, value: u32, reason: &str) {
    let mut bytes = PLATE.to_vec();
    put(&mut bytes, offset, &value.to_le_bytes());
    reject(parse_scene(&bytes), reason);
}

#[test]
fn rejects_bad_headers_counts_and_options() {
    for (offset, value, reason) in [
        (0, 0, "wrong magic"),
        (4, 2, "unsupported version"),
        (4, 0x1_0001, "header flags"),
        (8, 63, "picture sides"),
        (8, 2049, "picture sides"),
        (12, 0, "picture sides"),
        (12, 2049, "picture sides"),
        (16, 0, "supersample"),
        (16, 4, "supersample"),
        (20, 20_001, "tools or bodies"),
        (24, 20_001, "tools or bodies"),
        (20, 20_000, "remaining data"),
        (24, 20_000, "remaining data"),
        (28, 0x04, "option bits"),
        (28, 0, "analysis budget"),
        (32, 0, "analysis budget"),
        (32, 257, "analysis budget"),
        (36, 20_001, "too many tools or bodies"),
        (172, 1 << 16, "padding"),
    ] {
        plate_word_edit(offset, value, reason);
    }
}

#[test]
fn reads_and_validates_hidden_body_records() {
    let mut bytes = PLATE.to_vec();
    put(&mut bytes, 36, &1_u32.to_le_bytes());
    reject(parse_scene(&bytes), "record count exceeds remaining data");
    for word in [0_u32, 2, 0, 0, 1, 0] {
        bytes.extend(word.to_le_bytes());
    }
    let scene = parse_scene(&bytes).unwrap();
    assert_eq!(scene.bodies.len(), 3);
    assert_eq!(scene.hidden.len(), 1);
    assert!(!scene.hidden[0].reference && !scene.hidden[0].analysed);
    assert_eq!(
        scene.hidden[0].steps,
        [
            Step {
                op: Op::Union,
                tool: 0
            },
            Step {
                op: Op::Difference,
                tool: 0
            }
        ]
    );
    let start = PLATE.len();
    put(&mut bytes, start, &1_u32.to_le_bytes());
    reject(parse_scene(&bytes), "hidden body flags must be zero");
    put(&mut bytes, start, &0_u32.to_le_bytes());
    put(&mut bytes, start + 8, &1_u32.to_le_bytes());
    reject(parse_scene(&bytes), "body must start with a union");
}

#[test]
fn rejects_invalid_scene_reals_and_camera_basis() {
    for (offset, value, reason) in [
        (40, 0.0, "orthonormal"),
        (112, f64::NAN, "out-of-range real"),
        (120, f64::INFINITY, "out-of-range real"),
        (128, -10_000_001.0, "out-of-range real"),
        (136, 0.0, "camera scale"),
        (136, -0.5, "camera scale"),
        (136, 10_000_001.0, "out-of-range real"),
        (144, 0.000_000_9, "tolerance"),
        (144, 1.001, "tolerance"),
        (152, 0.009, "target cell"),
        (152, 10.01, "target cell"),
        (FIRST_TOOL + 8, f64::NEG_INFINITY, "out-of-range real"),
        (FIRST_TOOL + 112, 0.0, "zero prism span"),
        (FIRST_LOOP + 8, 10_000_001.0, "out-of-range real"),
    ] {
        let mut bytes = PLATE.to_vec();
        put(&mut bytes, offset, &value.to_le_bytes());
        reject(parse_scene(&bytes), reason);
    }
    let mut bytes = PLATE.to_vec();
    // Both axes are unit length, so a unit-length test alone would pass.
    bytes.copy_within(40..64, 64);
    reject(parse_scene(&bytes), "orthonormal");
}

#[test]
fn rejects_bad_prism_and_body_records() {
    for (offset, value, reason) in [
        (FIRST_TOOL, 2, "tool kind"),
        (FIRST_TOOL + 4, u32::MAX, "remaining data"),
        (FIRST_LOOP, 2, "loop point count"),
        (FIRST_LOOP, 20_001, "loop point count"),
        (FIRST_LOOP + 4, 1, "padding"),
        (PLATE_BODIES, 4, "body flags"),
        (PLATE_BODIES + 4, 0, "no steps"),
        (PLATE_BODIES + 4, u32::MAX, "remaining data"),
        (PLATE_BODIES + 8, 2, "start with a union"),
        (PLATE_BODIES + 12, 7, "tool index"),
        (PLATE_BODIES + 16, 3, "body operation"),
    ] {
        plate_word_edit(offset, value, reason);
    }
    let mut bytes = PLATE.to_vec();
    bytes.push(0);
    reject(parse_scene(&bytes), "trailing data");
}

fn one_tool_word_scene(words: &[u32]) -> Vec<u8> {
    let mut bytes = SELECTED_LOOPS[..FIRST_TOOL].to_vec();
    put(&mut bytes, 20, &1_u32.to_le_bytes());
    put(&mut bytes, 24, &1_u32.to_le_bytes());
    for word in words {
        bytes.extend(word.to_le_bytes());
    }
    for word in [1_u32, 1, 0, 0] {
        bytes.extend(word.to_le_bytes());
    }
    bytes
}

#[test]
fn reads_mesh_positions_indices_and_an_odd_index_pad() {
    let mut bytes = one_tool_word_scene(&[1, 3, 1, 0]);
    let positions = [1.0_f64, 2.0, 3.0, -2.5, 1.0, 0.0, 0.0, 3.0, 0.0];
    let geometry = positions
        .into_iter()
        .flat_map(f64::to_le_bytes)
        .chain([2_u32, 0, 1, 0].into_iter().flat_map(u32::to_le_bytes));
    bytes.splice(FIRST_TOOL + 16..FIRST_TOOL + 16, geometry);
    let scene = parse_scene(&bytes).unwrap();
    assert!(scene.bodies[0].reference);
    assert!(!scene.bodies[0].analysed);
    let Tool::Mesh(mesh) = &scene.tools[0] else {
        panic!("expected a mesh")
    };
    assert_eq!(mesh.positions, positions);
    assert_eq!(mesh.triangles, [2, 0, 1]);
    for (offset, value, reason) in [
        (4, 4_000_001_u32, "too many scene points"),
        (8, 2_000_001, "too many mesh triangles"),
        (12, 1, "padding"),
        (16 + 9 * 8, 3, "triangle index"),
        (16 + 9 * 8 + 12, 1, "padding"),
    ] {
        let mut mutated = bytes.clone();
        put(&mut mutated, FIRST_TOOL + offset, &value.to_le_bytes());
        reject(parse_scene(&mutated), reason);
    }
    bytes.truncate(FIRST_TOOL + 16 + 9 * 8 + 8);
    reject(parse_scene(&bytes), "remaining data");
}

#[test]
fn checks_a_three_point_prism_pad() {
    let mut bytes = PLATE[..FIRST_LOOP].to_vec();
    put(&mut bytes, 20, &1_u32.to_le_bytes());
    put(&mut bytes, 24, &1_u32.to_le_bytes());
    bytes.extend([3_u32, 0].into_iter().flat_map(u32::to_le_bytes));
    bytes.extend(
        [0.0_f64, 0.0, 1.0, 0.0, 0.0, 1.0]
            .into_iter()
            .flat_map(f64::to_le_bytes),
    );
    bytes.extend(
        [2_u32, 3, 4, 0, 2, 1, 0, 0]
            .into_iter()
            .flat_map(u32::to_le_bytes),
    );
    assert!(parse_scene(&bytes).is_ok());
    put(&mut bytes, FIRST_LOOP + 68, &7_u32.to_le_bytes());
    reject(parse_scene(&bytes), "padding");
}

#[test]
fn rejects_64_truncations_and_survives_2000_single_byte_changes() {
    for index in 0..64 {
        let end = index * (PLATE.len() - 1) / 63;
        assert!(parse_scene(&PLATE[..end]).is_err(), "truncation at {end}");
    }
    let mut bytes = PLATE.to_vec();
    for index in 0..2000 {
        let position = (index * 6841 + 13) % bytes.len();
        bytes[position] ^= 1 << (index % 8);
        let _ = parse_scene(&bytes);
        bytes[position] = PLATE[position];
    }
}

#[test]
fn checks_each_camera_axis_and_pair_on_both_sides_of_the_tolerance() {
    let header = SELECTED_LOOPS;
    for offset in [40, 72, 104, 48, 56, 80] {
        // The fixture's camera is axis-aligned. The first three changes vary
        // one length; the others introduce a dot product of the same size.
        let original = f64::from_le_bytes(header[offset..offset + 8].try_into().unwrap());
        for (delta, valid) in [(0.5e-9, true), (2e-9, false)] {
            let mut bytes = header.to_vec();
            put(&mut bytes, offset, &(original + delta).to_le_bytes());
            if valid {
                assert!(parse_scene(&bytes).is_ok(), "offset {offset}");
            } else {
                reject(parse_scene(&bytes), "orthonormal");
            }
        }
    }
}

#[test]
fn option_one_analyses_without_drawing() {
    let mut bytes = PLATE.to_vec();
    put(&mut bytes, 28, &1_u32.to_le_bytes());
    let scene = parse_scene(&bytes).unwrap();
    assert!(scene.analyse);
    assert!(!scene.draw_interference);
}

#[test]
fn prism_point_limit_accumulates_across_tools_and_loops() {
    let mut bytes = SELECTED_LOOPS[..FIRST_TOOL].to_vec();
    put(&mut bytes, 20, &2_u32.to_le_bytes());
    put(&mut bytes, 24, &0_u32.to_le_bytes());

    for (loops, final_counts) in [(100_u32, &[][..]), (99, &[19_998, 4][..])] {
        let tool = bytes.len();
        bytes.extend_from_slice(&SELECTED_LOOPS[FIRST_TOOL..FIRST_LOOP]);
        put(
            &mut bytes,
            tool + 4,
            &(loops + final_counts.len() as u32).to_le_bytes(),
        );
        for count in
            std::iter::repeat_n(20_000_u32, loops as usize).chain(final_counts.iter().copied())
        {
            bytes.extend_from_slice(&count.to_le_bytes());
            bytes.resize(bytes.len() + 4 + count as usize * 20, 0);
        }
    }
    reject(parse_scene(&bytes), "too many scene points");
}
