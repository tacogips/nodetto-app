#[allow(dead_code)]
mod support;

use nodetto_capture::render_rgb;
use nodetto_capture::scene::{Op, Tool};
use support::{body, box_prism, scene};

#[test]
fn overlapping_bodies_are_marked_reported_and_deterministic() {
    let mut a = body(&[(Op::Union, 0)]);
    let mut b = body(&[(Op::Union, 1)]);
    a.analysed = true;
    b.analysed = true;
    let mut s = scene(
        vec![
            box_prism([-5.0, -5.0, 0.0], 10.0, 10.0, 4.0),
            box_prism([0.0, -3.0, 2.0], 7.0, 6.0, 4.0),
        ],
        vec![a, b],
    );
    let marked = render_rgb(&s, 1).unwrap();
    assert_eq!(marked.1.pairs.len(), 1);
    assert_eq!((marked.1.pairs[0].a, marked.1.pairs[0].b), (0, 1));
    assert!(marked.1.pairs[0].volume > 0.0);
    for threads in [2, 5] {
        assert_eq!(render_rgb(&s, threads).unwrap(), marked);
    }
    s.draw_interference = false;
    let plain = render_rgb(&s, 1).unwrap();
    assert_ne!(marked.0, plain.0);
    assert_eq!(marked.1.pairs, plain.1.pairs);
    let first_body = s.bodies.remove(0);
    let block_only = render_rgb(&s, 1).unwrap().0;
    s.bodies.insert(0, first_body);
    let mut on_block_face = 0;
    for y in 42..54 {
        for x in 52..64 {
            let position = (x, y);
            if support::pixel(&marked.0, s.width, position)
                != support::pixel(&plain.0, s.width, position)
            {
                assert_eq!(
                    support::pixel(&plain.0, s.width, position),
                    support::pixel(&block_only, s.width, position)
                );
                on_block_face += 1;
            }
        }
    }
    assert!(
        on_block_face > 0,
        "overlap behind the nearer Block face must be hatched"
    );
    if let Tool::Prism(block) = &mut s.tools[1] {
        block.o[0] += 30.0;
    }
    let clear = render_rgb(&s, 1).unwrap();
    s.draw_interference = true;
    let clear_marked = render_rgb(&s, 2).unwrap();
    assert_eq!(clear.0, clear_marked.0);
    assert!(clear_marked.1.pairs.is_empty());
}

#[test]
fn through_hole_is_not_hatched_but_surrounding_overlap_is() {
    let mut a = body(&[(Op::Union, 0), (Op::Difference, 2)]);
    let mut b = body(&[(Op::Union, 1)]);
    a.analysed = true;
    b.analysed = true;
    let mut s = scene(
        vec![
            box_prism([-5.0, -5.0, 0.0], 10.0, 10.0, 4.0),
            box_prism([-4.0, -4.0, 2.0], 8.0, 8.0, 4.0),
            box_prism([-1.0, -1.0, -1.0], 2.0, 2.0, 6.0),
        ],
        vec![a, b],
    );
    let marked = render_rgb(&s, 1).unwrap().0;
    s.draw_interference = false;
    let plain = render_rgb(&s, 1).unwrap().0;
    for y in 46..50 {
        for x in 46..50 {
            assert_eq!(
                support::pixel(&marked, s.width, (x, y)),
                support::pixel(&plain, s.width, (x, y))
            );
        }
    }
    assert_ne!(marked, plain);
}

#[test]
fn plate_iso_bit_clear_retains_picture_digest() {
    let mut s =
        nodetto_capture::scene::parse_scene(include_bytes!("fixtures/plate-iso.ncs1")).unwrap();
    s.draw_interference = false;
    let (image, _) = render_rgb(&s, 1).unwrap();
    assert_eq!(support::digest(&image), 0x29c6_4b3e_156d_0941);
}

#[test]
fn plate_iso_changes_are_contained_in_reported_pair_boxes_and_use_both_hatch_colours() {
    let mut s =
        nodetto_capture::scene::parse_scene(include_bytes!("fixtures/plate-iso.ncs1")).unwrap();
    let (marked, report) = render_rgb(&s, 1).unwrap();
    assert!(!report.pairs.is_empty());
    s.draw_interference = false;
    let (plain, _) = render_rgb(&s, 1).unwrap();
    let boxes: Vec<_> = report
        .pairs
        .iter()
        .map(|pair| {
            let corners: Vec<_> = (0..8)
                .map(|mask| {
                    let point = std::array::from_fn(|i| {
                        if mask & (1 << i) == 0 {
                            pair.min[i]
                        } else {
                            pair.max[i]
                        }
                    });
                    support::project(&s.camera, s.width, s.height, point)
                })
                .collect();
            (
                corners.iter().map(|p| p.0).min().unwrap().saturating_sub(2),
                corners.iter().map(|p| p.0).max().unwrap() + 2,
                corners.iter().map(|p| p.1).min().unwrap().saturating_sub(2),
                corners.iter().map(|p| p.1).max().unwrap() + 2,
            )
        })
        .collect();
    let mut changed = 0;
    let mut body = false;
    let mut ink = false;
    for y in 0..s.height as usize {
        for x in 0..s.width as usize {
            let m = support::pixel(&marked, s.width, (x, y));
            if m != support::pixel(&plain, s.width, (x, y)) {
                changed += 1;
                assert!(
                    boxes
                        .iter()
                        .any(|&(x0, x1, y0, y1)| (x0..=x1).contains(&x) && (y0..=y1).contains(&y)),
                    "changed pixel ({x}, {y}) outside {boxes:?}"
                );
                body |= m == s.colours.body;
                ink |= m == s.colours.interference;
            }
        }
    }
    assert!(changed > 0);
    assert!(body && ink, "changed pixels contain body={body}, ink={ink}");
}

#[test]
fn seeded_two_body_scenes_report_every_mark_and_mark_wide_overlaps() {
    let mut seed = 0x8357_u64;
    for _ in 0..100 {
        seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1);
        let dx = ((seed >> 32) % 120) as f64 / 10.0 - 6.0;
        let mut a = body(&[(Op::Union, 0)]);
        let mut b = body(&[(Op::Union, 1)]);
        a.analysed = true;
        b.analysed = true;
        let mut s = scene(
            vec![
                box_prism([-3.0, -3.0, 0.0], 6.0, 6.0, 3.0),
                box_prism([dx, -2.0, 1.0], 4.0, 4.0, 3.0),
            ],
            vec![a, b],
        );
        s.width = 64;
        s.height = 64;
        s.camera.mm_per_pixel = 0.4;
        let (marked, report) = render_rgb(&s, 1).unwrap();
        s.draw_interference = false;
        let (plain, _) = render_rgb(&s, 1).unwrap();
        let marked_count = marked
            .as_chunks::<3>()
            .0
            .iter()
            .zip(plain.as_chunks::<3>().0.iter())
            .filter(|(a, b)| a != b)
            .count();
        if marked_count > 0 {
            assert!(report.pairs.iter().any(|p| (p.a, p.b) == (0, 1)));
        }
        for pair in &report.pairs {
            let mut projected_samples = 0;
            for y in 0..s.height {
                for x in 0..s.width {
                    let world_x =
                        (f64::from(x) + 0.5 - f64::from(s.width) / 2.0) * s.camera.mm_per_pixel;
                    let world_y =
                        -(f64::from(y) + 0.5 - f64::from(s.height) / 2.0) * s.camera.mm_per_pixel;
                    if world_x > pair.min[0]
                        && world_x < pair.max[0]
                        && world_y > pair.min[1]
                        && world_y < pair.max[1]
                    {
                        projected_samples += 1;
                    }
                }
            }
            if projected_samples > 2 {
                assert!(
                    marked_count > 0,
                    "dx={dx}, projected_samples={projected_samples}, pair={pair:?}"
                );
            }
        }
    }
}

#[test]
fn forty_stacked_bodies_limit_each_sample_to_twenty_eight_comparisons() {
    use nodetto_capture::interval::Boundary;
    use nodetto_capture::overlay::{overlapping_pairs, SampleBody};
    let interval = [
        Boundary {
            s: 0.0,
            tool: 0,
            face: 0,
        },
        Boundary {
            s: 2.0,
            tool: 0,
            face: 0,
        },
    ];
    let bodies: Vec<_> = (0..40)
        .map(|body| SampleBody {
            body,
            intervals: &interval,
        })
        .collect();
    let mut comparisons = 0;
    let mut overlaps = Vec::new();
    overlapping_pairs(&bodies, 0.001, &mut comparisons, &mut overlaps);
    assert_eq!(comparisons, 28);
    assert_eq!(overlaps.len(), 28);
}

#[test]
fn sub_cell_pin_is_reported_from_the_view() {
    let mut a = body(&[(Op::Union, 0)]);
    let mut b = body(&[(Op::Union, 1)]);
    a.analysed = true;
    b.analysed = true;
    let mut s = scene(
        vec![
            box_prism([-3.0, -3.0, 0.0], 6.0, 6.0, 2.0),
            box_prism([0.10, 0.10, 0.0], 0.05, 0.05, 2.0),
        ],
        vec![a, b],
    );
    s.camera.mm_per_pixel = 0.05;
    s.budget_million_rays = 0;
    let (_, report) = render_rgb(&s, 1).unwrap();
    assert!(
        report
            .pairs
            .iter()
            .any(|p| (p.a, p.b) == (0, 1) && p.from_view),
        "{:?}",
        report.pairs
    );
}

#[test]
fn two_hundred_subcell_bodies_exceed_view_pair_limit() {
    let mut tools = Vec::new();
    let mut bodies = Vec::new();
    for i in 0..100 {
        let offset = -4.975 + f64::from(i) * 0.1 - 0.02;
        tools.push(box_prism([-5.05, offset, 0.0], 10.1, 0.04, 1.0));
        tools.push(box_prism([offset, -5.05, 0.0], 0.04, 10.1, 1.0));
    }
    for index in 0..tools.len() {
        let mut next = body(&[(Op::Union, index as u32)]);
        next.analysed = true;
        bodies.push(next);
    }
    let mut s = scene(tools, bodies);
    s.width = 224;
    s.height = 224;
    s.camera.mm_per_pixel = 0.05;
    s.budget_million_rays = 0;
    let error = render_rgb(&s, 1).unwrap_err().0;
    assert!(
        error.contains("Too many interfering pairs in this view"),
        "{error}"
    );
    assert!(
        error.contains("--interference-bodies") && error.contains("--no-interference"),
        "{error}"
    );
}

#[test]
fn tied_depth_matches_sort_truncate_reference() {
    use nodetto_capture::interval::{overlap, Boundary};
    use nodetto_capture::overlay::{overlapping_pairs, SampleBody};
    let interval = [
        Boundary {
            s: 0.0,
            tool: 0,
            face: 0,
        },
        Boundary {
            s: 2.0,
            tool: 0,
            face: 0,
        },
    ];
    let bodies: Vec<_> = (0..12)
        .rev()
        .map(|body| SampleBody {
            body,
            intervals: &interval,
        })
        .collect();
    let mut reference: Vec<_> = bodies.iter().collect();
    reference.sort_by(|a, b| {
        a.intervals[0]
            .s
            .total_cmp(&b.intervals[0].s)
            .then(a.body.cmp(&b.body))
    });
    reference.truncate(8);
    let mut expected = Vec::new();
    for (i, a) in reference.iter().enumerate() {
        for b in &reference[i + 1..] {
            if let Some((s0, s1, _)) = overlap(a.intervals, b.intervals, 0.001) {
                expected.push((a.body.min(b.body), a.body.max(b.body), s0, s1));
            }
        }
    }
    let mut actual = Vec::new();
    let mut comparisons = 0;
    overlapping_pairs(&bodies, 0.001, &mut comparisons, &mut actual);
    assert_eq!(actual, expected);
    assert_eq!(comparisons, 28);
    let mut s = scene(
        vec![box_prism([-5.0, -5.0, 0.0], 10.0, 10.0, 4.0)],
        (0..12)
            .map(|_| {
                let mut b = body(&[(Op::Union, 0)]);
                b.analysed = true;
                b
            })
            .collect(),
    );
    s.budget_million_rays = 0;
    let (twelve, report) = render_rgb(&s, 1).unwrap();
    assert_eq!(
        report.pairs.iter().map(|p| (p.a, p.b)).collect::<Vec<_>>(),
        expected.iter().map(|p| (p.0, p.1)).collect::<Vec<_>>()
    );
    s.bodies.truncate(8);
    assert_eq!(twelve, render_rgb(&s, 1).unwrap().0);
    s.draw_interference = false;
    assert_ne!(twelve, render_rgb(&s, 1).unwrap().0);
}
