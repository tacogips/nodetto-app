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
