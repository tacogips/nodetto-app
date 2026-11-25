use super::budget::CHUNK;
use super::reference::{render_reference, render_reference_full};
use super::*;
use crate::scene::{Body, Loop, Prism, Step, Tool};

fn plate() -> Scene {
    crate::scene::parse_scene(include_bytes!("../../tests/fixtures/plate-iso.ncs1")).unwrap()
}
fn box_tool(o: [f64; 3], width: f64, depth: f64, height: f64) -> Tool {
    Tool::Prism(Prism {
        o,
        u: [1.0, 0.0, 0.0],
        v: [0.0, 1.0, 0.0],
        n: [0.0, 0.0, 1.0],
        t0: 0.0,
        t1: height,
        loops: vec![Loop {
            points: vec![0.0, 0.0, width, 0.0, width, depth, 0.0, depth],
            faces: vec![2, 3, 4, u32::MAX],
        }],
    })
}
fn body(steps: &[(Op, u32)]) -> Body {
    Body {
        reference: false,
        analysed: true,
        steps: steps.iter().map(|&(op, tool)| Step { op, tool }).collect(),
    }
}
fn base() -> Scene {
    let mut s = plate();
    s.width = 96;
    s.height = 96;
    s.supersample = 1;
    s.camera = Camera {
        right: [1.0, 0.0, 0.0],
        up: [0.0, 1.0, 0.0],
        forward: [0.0, 0.0, -1.0],
        centre: [0.0; 3],
        mm_per_pixel: 0.25,
    };
    s.tools.clear();
    s.bodies.clear();
    s.analyse = false;
    s.draw_interference = false;
    s
}
fn compare(s: &Scene) -> Report {
    let (rgb, report) = render_reference(s);
    for threads in [1, 2, 5] {
        let (actual_rgb, actual_report) = render_rgb(s, threads).unwrap();
        assert_eq!(actual_rgb, rgb, "RGB differs with {threads} threads");
        assert_eq!(
            actual_report, report,
            "report differs with {threads} threads"
        );
    }
    report
}
fn refilled() -> Scene {
    let mut s = base();
    s.tools = vec![
        box_tool([-4.0, -4.0, 0.0], 8.0, 8.0, 4.0),
        box_tool([-5.0, -5.0, -1.0], 10.0, 10.0, 6.0),
    ];
    s.bodies = vec![body(&[(Op::Union, 0), (Op::Difference, 1), (Op::Union, 0)])];
    s
}
#[test]
fn reduced_plate_matches_reference() {
    let mut s = plate();
    s.width = 64;
    s.height = 64;
    s.supersample = 1;
    compare(&s);
}
#[test]
fn reduced_refilled_matches_reference() {
    let mut s = refilled();
    s.width = 64;
    s.height = 64;
    assert_eq!(compare(&s).bodies[0].emptied_by_step, 1);
}
#[test]
#[cfg_attr(debug_assertions, ignore = "release only")]
fn plate_matches_reference() {
    compare(&plate());
}
#[test]
#[cfg_attr(debug_assertions, ignore = "release only")]
fn holes_match_reference() {
    let mut s = base();
    s.tools.push(box_tool([-10.0, -10.0, 0.0], 20.0, 20.0, 2.0));
    let mut steps = vec![(Op::Union, 0)];
    for i in 0..600 {
        let x = (i % 30) as f64 * 0.6 - 9.0;
        let y = (i / 30) as f64 * 0.8 - 8.0;
        s.tools.push(box_tool([x, y, -1.0], 0.2, 0.2, 4.0));
        steps.push((Op::Difference, (i + 1) as u32));
    }
    s.bodies.push(body(&steps));
    compare(&s);
}
#[test]
#[cfg_attr(debug_assertions, ignore = "release only")]
fn grid_matches_reference() {
    let mut s = base();
    for y in 0..15 {
        for x in 0..20 {
            let index = s.tools.len() as u32;
            s.tools.push(box_tool(
                [x as f64 * 1.0 - 10.0, y as f64 * 1.0 - 7.5, 0.0],
                0.8,
                0.8,
                2.0,
            ));
            s.bodies.push(body(&[(Op::Union, index)]));
        }
    }
    compare(&s);
}
#[test]
#[cfg_attr(debug_assertions, ignore = "release only")]
fn intersections_match_reference() {
    let mut s = base();
    s.draw_interference = true;
    for i in 0..50 {
        let x = (i % 10) as f64 * 2.0 - 10.0;
        let y = (i / 10) as f64 * 2.0 - 5.0;
        let index = s.tools.len() as u32;
        s.tools.push(box_tool([x, y, 0.0], 1.6, 1.6, 2.0));
        s.tools
            .push(box_tool([x + 0.4, y + 0.4, -1.0], 1.6, 1.6, 4.0));
        s.bodies
            .push(body(&[(Op::Union, index), (Op::Intersection, index + 1)]));
    }
    compare(&s);
}
#[test]
#[cfg_attr(debug_assertions, ignore = "release only")]
fn refilled_matches_reference() {
    assert_eq!(compare(&refilled()).bodies[0].emptied_by_step, 1);
}
#[test]
fn span_maxima_match_individual_marks() {
    let mut seed = 173u32;
    for len in 1..100 {
        let mut spans = vec![0usize; len];
        let mut expected = Liveness::new(len);
        for _ in 0..300 {
            seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
            let start = seed as usize % len;
            seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
            let end = start + seed as usize % (len - start + 1);
            spans[start] = spans[start].max(end);
            expected.mark(start, end);
        }
        assert_eq!(materialize_spans(&spans), expected);
    }
}

fn disjoint_scene(n: usize) -> Scene {
    let mut s = base();
    s.width = 64;
    s.height = 320;
    for i in 0..n {
        s.tools.push(box_tool(
            [-100.0, -100.0, i as f64 * 3.0],
            200.0,
            200.0,
            1.0,
        ));
    }
    s.bodies.push(body(
        &(0..n).map(|i| (Op::Union, i as u32)).collect::<Vec<_>>(),
    ));
    s
}

/// A profile whose 4,000 zigzag edges all lie in one 0.2 mm band.
fn dense_band_scene(mm_per_pixel: f64, centre: [f64; 3]) -> Scene {
    const TEETH: usize = 4_000;
    let length = TEETH as f64 * 0.01;
    let mut points = Vec::with_capacity(TEETH * 2 + 4);
    for tooth in 0..TEETH {
        points.extend([tooth as f64 * 0.01, (tooth % 2) as f64 * 0.2]);
    }
    points.extend([length, -50.0, 0.0, -50.0]);
    let mut s = base();
    s.width = 256;
    s.height = 256;
    s.camera.mm_per_pixel = mm_per_pixel;
    s.camera.centre = centre;
    s.tools.push(Tool::Prism(Prism {
        o: [0.0; 3],
        u: [1.0, 0.0, 0.0],
        v: [0.0, 1.0, 0.0],
        n: [0.0, 0.0, 1.0],
        t0: 0.0,
        t1: 1.0,
        loops: vec![Loop {
            faces: (0..points.len() as u32 / 2).collect(),
            points,
        }],
    }));
    s.bodies.push(body(&[(Op::Union, 0)]));
    s
}

#[test]
fn a_view_zoomed_onto_a_dense_bucket_is_refused_by_the_scan_budget() {
    let fitted = dense_band_scene(0.25, [20.0, -25.0, 0.0]);
    let zoomed = dense_band_scene(0.2 / 256.0, [20.0, 0.1, 0.0]);
    for threads in [1, 2, 5] {
        assert!(render_with(&fitted, threads, 50_000_000).0.is_ok());
        let error = render_with(&zoomed, threads, 50_000_000).0.unwrap_err();
        assert!(error.0.contains("too heavy"), "{}", error.0);
    }
}

#[test]
fn disjoint_boundary_reads_follow_formula() {
    for n in [3usize, 7] {
        let s = disjoint_scene(n);
        let samples = 64 * (320 + 320usize.div_ceil(BAND_ROWS) - 1);
        for threads in [1, 2, 5] {
            let (result, stats) = render_with(&s, threads, SCAN_ALLOWANCE);
            result.unwrap();
            assert_eq!(
                stats.reads,
                (samples * n * (n - 1) + samples * 2 * n) as u64
            );
        }
    }
    let mut invalid = base();
    invalid.width = 1;
    let (result, stats) = render_with(&invalid, 1, SCAN_ALLOWANCE);
    assert!(result.is_err());
    assert_eq!((stats.reads, stats.workers), (0, 0));
    assert!(stats.liveness.is_empty());
    assert_eq!(stats.census.rays, 0);
}

#[test]
#[cfg_attr(debug_assertions, ignore = "release only")]
fn boundary_read_counts_and_refusal_are_bounded() {
    let s = disjoint_scene(50);
    let mut expected = None;
    for threads in [1, 2, 5] {
        let (result, stats) = render_with(&s, threads, 100_000_000);
        assert_eq!(stats.workers, threads);
        assert_eq!(stats.reads, 53_692_800);
        let output = result.unwrap();
        if let Some(ref old) = expected {
            assert_eq!(&output, old);
        }
        expected = Some(output);
    }
    let s = disjoint_scene(2000);
    for threads in [1, 2, 5] {
        let (result, stats) = render_with(&s, threads, 10_000_000);
        assert_eq!(stats.workers, threads);
        assert!(stats.reads <= 10_000_000 + threads as u64 * CHUNK);
        assert_eq!(result.unwrap_err().to_string(), "The scene is too heavy for this picture size (picture boundary scans over 10000000). Use a smaller --size.");
        assert!(stats.liveness.is_empty());
        assert_eq!(stats.census.rays, 0);
    }
}

#[test]
fn off_view_liveness_matches_reference_and_census_rays() {
    let mut s = base();
    s.width = 64;
    s.height = 64;
    s.tools.push(box_tool([-20.0, -20.0, 0.0], 40.0, 40.0, 2.0));
    s.tools.push(box_tool([100.0, 100.0, 0.0], 2.0, 2.0, 2.0));
    let count = if cfg!(debug_assertions) { 2000 } else { 20_000 };
    let mut steps = vec![(Op::Union, 0)];
    steps.extend(std::iter::repeat_n((Op::Difference, 1), count));
    for intersection in [false, true] {
        let mut history = steps.clone();
        if intersection {
            history.push((Op::Intersection, 1));
        }
        s.bodies = vec![body(&history)];
        let reference = render_reference_full(&s);
        for threads in [1, 2, 5] {
            let (result, stats) = render_with(&s, threads, SCAN_ALLOWANCE);
            assert_eq!(result.unwrap(), (reference.0.clone(), reference.1.clone()));
            assert_eq!(stats.liveness, reference.2);
            if !intersection {
                assert_eq!(stats.census.rays, 0);
            }
        }
    }
    let sound = plate();
    assert_eq!(render_with(&sound, 1, SCAN_ALLOWANCE).1.census.rays, 0);
    s.tools = vec![Tool::Mesh(crate::scene::Mesh {
        positions: vec![100.0, 100.0, 0.0, 101.0, 100.0, 0.0, 100.0, 101.0, 0.0],
        triangles: vec![0, 1, 2],
    })];
    s.bodies = vec![body(&[(Op::Union, 0)])];
    assert_eq!(render_with(&s, 1, SCAN_ALLOWANCE).1.census.rays, 0);
}

#[test]
#[cfg_attr(debug_assertions, ignore = "release only")]
fn disjoint_witness_keeps_reads_and_charges() {
    let mut s = disjoint_scene(50);
    s.analyse = true;
    s.draw_interference = true;
    for threads in 0..=8 {
        let (result, stats) = render_with(&s, threads, SCAN_ALLOWANCE);
        result.unwrap();
        assert_eq!(stats.reads, 53_692_800);
        assert_eq!(stats.charged, 53_692_800);
        assert_eq!(stats.witness, 0);
    }
}

fn compare_every_thread_count(s: &Scene) -> Report {
    let (rgb, report) = render_reference(s);
    for threads in 0..=8 {
        let (actual_rgb, actual_report) = render_rgb(s, threads).unwrap();
        assert_eq!(
            actual_report.pairs.len(),
            report.pairs.len(),
            "pairs at threads {threads}"
        );
        assert_eq!(actual_rgb, rgb, "RGB at threads {threads}");
        assert_eq!(actual_report, report, "report at threads {threads}");
    }
    report
}

fn production_touching(mut scene: Scene) {
    let report = compare_every_thread_count(&scene);
    assert!(report.pairs.is_empty());
    assert_eq!(report.analysis.unwrap().candidates, 0);
    let rgb = render_rgb(&scene, 0).unwrap().0;
    scene.draw_interference = false;
    assert_eq!(rgb, render_rgb(&scene, 0).unwrap().0);
}

#[test]
fn production_touching_caps() {
    production_touching(super::reference::fixtures::stacked_caps(0.0));
}

#[test]
fn production_touching_mesh_caps() {
    for back in [false, true] {
        production_touching(super::reference::fixtures::mesh_under_prism(back, 0.0));
    }
}

#[test]
fn production_touching_tall_mesh() {
    for back in [false, true] {
        production_touching(super::reference::fixtures::tall_mesh_under_prism(back, 0.0));
    }
}

#[test]
fn production_tall_mesh_penetration() {
    for back in [false, true] {
        let report = compare_every_thread_count(
            &super::reference::fixtures::tall_mesh_under_prism(back, 0.01),
        );
        assert_eq!(report.pairs.len(), 1);
        assert_eq!((report.pairs[0].a, report.pairs[0].b), (0, 1));
    }
}

#[test]
fn production_touching_opposed_side() {
    production_touching(super::reference::fixtures::shared_side(true, 0.0));
}

#[test]
fn production_touching_same_side() {
    production_touching(super::reference::fixtures::shared_side(false, 0.0));
}

#[test]
fn production_overlap_witness() {
    use super::reference::fixtures::{mesh_under_prism, shared_side, stacked_caps};
    for mut scene in [
        stacked_caps(0.01),
        shared_side(true, 0.01),
        mesh_under_prism(true, 0.01),
        mesh_under_prism(false, 0.01),
    ] {
        let report = compare_every_thread_count(&scene);
        assert_eq!(report.pairs.len(), 1);
        let rgb = render_rgb(&scene, 0).unwrap().0;
        scene.draw_interference = false;
        assert_ne!(rgb, render_rgb(&scene, 0).unwrap().0);
    }
}

#[test]
fn stacked_caps_witness_charge_is_the_delta() {
    let scene = super::reference::fixtures::stacked_caps(0.0);
    for threads in 0..=8 {
        let (actual, stats) = render_tuned(&scene, threads, SCAN_ALLOWANCE, Tuning::PRODUCTION);
        let (baseline, never) = render_tuned(
            &scene,
            threads,
            SCAN_ALLOWANCE,
            Tuning {
                never_flag: true,
                ..Tuning::PRODUCTION
            },
        );
        actual.unwrap();
        baseline.unwrap();
        assert!(stats.witness > 0);
        assert_eq!(stats.charged, never.charged + stats.witness);
    }
}

fn fnv1a(bytes: &[u8]) -> u64 {
    bytes.iter().fold(0xcbf29ce484222325u64, |hash, byte| {
        (hash ^ u64::from(*byte)).wrapping_mul(0x100000001b3)
    })
}

#[test]
fn layers_board_baseline() {
    let scene = super::reference::fixtures::sheets_over_board(&[], true);
    for threads in 0..=8 {
        let (result, stats) = render_with(&scene, threads, SCAN_ALLOWANCE);
        let (rgb, report) = result.unwrap();
        assert_eq!(fnv1a(&rgb), 8_838_539_948_900_981_082);
        assert_eq!(report.bodies.len(), 1);
        assert_eq!(report.bodies[0].state, BodyState::Drawn);
        assert_eq!(stats.reads, 3360);
    }
}

fn layers_check_sheets(sheets: &[f64]) {
    use super::reference::fixtures::sheets_over_board;
    let scene = sheets_over_board(sheets, true);
    let report = compare_every_thread_count(&scene);
    let rgb = render_rgb(&scene, 0).unwrap().0;
    let plain = render_rgb(&sheets_over_board(sheets, false), 0).unwrap().0;
    let pixel = |bytes: &[u8], x: usize, y: usize| -> [u8; 3] {
        bytes[(y * 96 + x) * 3..][..3].try_into().unwrap()
    };
    assert_ne!(pixel(&rgb, 48, 48), pixel(&plain, 48, 48));
    assert_ne!(pixel(&rgb, 67, 48), pixel(&rgb, 48, 48));
    assert_ne!(pixel(&rgb, 67, 48), pixel(&plain, 67, 48));
    assert!(report
        .bodies
        .iter()
        .all(|body| body.state == BodyState::Drawn));
}

#[test]
fn layers_sheet_over_board() {
    layers_check_sheets(&[3.0]);
}

#[test]
fn layers_four_sheets() {
    layers_check_sheets(&[3.0, 4.0, 5.0, 6.0]);
}

#[test]
fn layers_opaque_hides_board() {
    use super::reference::fixtures::opaque_over_board;
    let scene = opaque_over_board(true);
    let report = compare_every_thread_count(&scene);
    assert_eq!(report.bodies[0].state, BodyState::Hidden);
    assert_eq!(
        render_rgb(&scene, 0).unwrap().0,
        render_rgb(&opaque_over_board(false), 0).unwrap().0
    );
}

#[test]
fn layers_storage_cap_refuses() {
    let scene = super::reference::fixtures::sheets_over_board(&[3.0, 4.0, 5.0, 6.0], true);
    for threads in 0..=8 {
        let (result, stats) = render_tuned(
            &scene,
            threads,
            SCAN_ALLOWANCE,
            Tuning {
                layer_cap: 4,
                ..Tuning::PRODUCTION
            },
        );
        assert_eq!(result.unwrap_err().to_string(), "The scene is too heavy for this picture size (picture boundary scans over 16000000000). Use a smaller --size.");
        assert!(stats.liveness.is_empty());
        assert_eq!(stats.census.rays, 0);
    }
}

fn stripe_scene(rows: &[usize], sheets: usize, height: u32) -> Scene {
    let mut scene = base();
    scene.width = 64;
    scene.height = height;
    scene.supersample = 3;
    let h = 0.25 / 3.0;
    for &row in rows {
        let y = (f64::from(height * 3) / 2.0 - (row as f64 + 0.5)) * h;
        for sheet in 0..sheets {
            let z = 3.0 + sheet as f64;
            let tool = scene.tools.len() as u32;
            scene.tools.push(Tool::Mesh(crate::scene::Mesh {
                positions: vec![
                    -9.0,
                    y - h / 4.0,
                    z,
                    9.0,
                    y - h / 4.0,
                    z,
                    9.0,
                    y + h / 4.0,
                    z,
                    -9.0,
                    y + h / 4.0,
                    z,
                ],
                triangles: vec![0, 1, 2, 0, 2, 3],
            }));
            scene.bodies.push(body(&[(Op::Union, tool)]));
        }
    }
    scene
}

fn compare_capped(scene: &Scene, cap: usize) -> usize {
    let reference = render_reference(scene);
    let mut maximum = 0;
    for threads in 0..=8 {
        let (result, stats) = render_tuned(
            scene,
            threads,
            SCAN_ALLOWANCE,
            Tuning {
                layer_cap: cap,
                ..Tuning::PRODUCTION
            },
        );
        assert_eq!(result.unwrap(), reference, "threads {threads}");
        assert!(
            stats.layer_capacity <= cap,
            "threads {threads}: capacity {} > {cap}",
            stats.layer_capacity
        );
        maximum = maximum.max(stats.layer_capacity);
    }
    maximum
}

#[test]
fn layer_window_staggered_stripes() {
    let cap = 192 * 8 + 192;
    assert!(compare_capped(&stripe_scene(&[100, 201, 302, 403], 8, 512), cap) > 0);
}

#[test]
fn layer_window_band_boundary() {
    let cap = 192 * 8 + 192;
    assert!(cap < 2 * 192 * 8);
    assert!(compare_capped(&stripe_scene(&[96], 8, 512), cap) > 0);
}

#[test]
fn layer_window_final_row() {
    assert!(compare_capped(&stripe_scene(&[191], 2, 64), MAX_LAYER_WINDOW) > 0);
}

fn diagonal_strip_scene(strips: usize, bodies: usize, height: u32) -> Scene {
    let mut scene = base();
    scene.width = 64;
    scene.height = height;
    scene.supersample = 2;
    scene.camera.mm_per_pixel = 0.0486;
    let mut positions = Vec::new();
    for i in 0..=strips {
        let offset = (i as f64 - strips as f64 / 2.0) * 32.0 / strips as f64;
        for z in [0.0, 1.0] {
            for x in [-128.0, 128.0] {
                positions.extend([x, x + offset, z]);
            }
        }
    }
    let mut triangles = Vec::new();
    let mut quad = |a: u32, b: u32, c: u32, d: u32| {
        triangles.extend([a, b, c, a, c, d]);
    };
    for i in 0..strips as u32 {
        let a = i * 4;
        let b = a + 4;
        quad(a, b, b + 1, a + 1);
        quad(a + 2, a + 3, b + 3, b + 2);
        quad(a, a + 2, b + 2, b);
        quad(a + 1, b + 1, b + 3, a + 3);
    }
    quad(0, 1, 3, 2);
    let last = strips as u32 * 4;
    quad(last, last + 2, last + 3, last + 1);
    for index in 0..bodies {
        scene.tools.push(Tool::Mesh(crate::scene::Mesh {
            positions: positions.clone(),
            triangles: triangles.clone(),
        }));
        scene.bodies.push(body(&[(Op::Union, index as u32)]));
    }
    scene
}

#[test]
#[cfg_attr(debug_assertions, ignore = "release only")]
fn picture_triangle_audit_refused() {
    let scene = diagonal_strip_scene(8192, 3, 64);
    let mut error = None;
    for threads in [1, 5] {
        let (result, stats) = render_with(&scene, threads, SCAN_ALLOWANCE);
        let actual = result.unwrap_err().to_string();
        assert_eq!(actual, format!("The scene is too heavy for this picture size (picture boundary scans over {SCAN_ALLOWANCE}). Use a smaller --size."));
        if let Some(ref previous) = error {
            assert_eq!(&actual, previous);
        }
        error = Some(actual);
        assert_eq!(stats.workers, if threads == 1 { 1 } else { 2 });
        assert!(
            stats.visited <= PICTURE_TRIANGLE_LIMIT && stats.triangles > PICTURE_TRIANGLE_LIMIT
        );
        assert!(stats.charged <= SCAN_ALLOWANCE);
        assert!(stats.liveness.is_empty());
        assert_eq!(stats.census.rays, 0);
        println!(
            "audit threads={threads} visited={} triangles={}",
            stats.visited, stats.triangles
        );
    }
}

#[test]
#[cfg_attr(debug_assertions, ignore = "release only")]
fn picture_triangle_five_workers_refused() {
    let scene = diagonal_strip_scene(8192, 2, 160);
    let mut error = None;
    for threads in [1, 5] {
        let (result, stats) = render_with(&scene, threads, SCAN_ALLOWANCE);
        let actual = result.unwrap_err().to_string();
        assert_eq!(actual, format!("The scene is too heavy for this picture size (picture boundary scans over {SCAN_ALLOWANCE}). Use a smaller --size."));
        if let Some(ref previous) = error {
            assert_eq!(&actual, previous);
        }
        error = Some(actual);
        assert_eq!(stats.workers, threads);
        assert!(
            stats.visited <= PICTURE_TRIANGLE_LIMIT && stats.triangles > PICTURE_TRIANGLE_LIMIT
        );
        assert!(stats.charged <= SCAN_ALLOWANCE);
        assert!(stats.liveness.is_empty());
        assert_eq!(stats.census.rays, 0);
        println!(
            "five threads={threads} visited={} triangles={}",
            stats.visited, stats.triangles
        );
    }
}

#[test]
#[cfg_attr(debug_assertions, ignore = "release only")]
fn picture_triangle_admitted_parity() {
    let scene = diagonal_strip_scene(256, 3, 160);
    let mut expected = None;
    for threads in [1, 5] {
        let (result, stats) = render_with(&scene, threads, SCAN_ALLOWANCE);
        let (rgb, report) = result.unwrap();
        let png = crate::encode::png_rgb8(&rgb, scene.width, scene.height).unwrap();
        assert_eq!(stats.workers, threads);
        assert!(
            stats.visited > 0
                && stats.visited == stats.triangles
                && stats.visited <= PICTURE_TRIANGLE_LIMIT
        );
        let output = (rgb, png, report.to_json(), stats.visited);
        if let Some(ref previous) = expected {
            assert_eq!(&output, previous);
        }
        println!(
            "control threads={threads} visited={} triangles={}",
            stats.visited, stats.triangles
        );
        expected = Some(output);
    }
}
