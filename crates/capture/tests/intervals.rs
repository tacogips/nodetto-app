use nodetto_capture::interval::{combine, overlap, Boundary, Intervals};
use nodetto_capture::prism::PrismView;
use nodetto_capture::scene::{parse_scene, Loop, Op, Prism, Scene, Tool};
use nodetto_capture::view::{Ray, RayFamily};

const X: [f64; 3] = [1.0, 0.0, 0.0];
const Y: [f64; 3] = [0.0, 1.0, 0.0];
const Z: [f64; 3] = [0.0, 0.0, 1.0];
const PLATE: &[u8] = include_bytes!("fixtures/plate-iso.ncs1");

fn boundary(s: f64, tool: u32, face: u32) -> Boundary {
    Boundary { s, tool, face }
}

fn rectangle() -> Prism {
    Prism {
        o: [10.0, 20.0, 30.0],
        u: X,
        v: Y,
        n: Z,
        t0: 2.0,
        t1: 5.0,
        loops: vec![Loop {
            points: vec![0.0, 0.0, 4.0, 0.0, 4.0, 3.0, 0.0, 3.0],
            faces: vec![2, 3, 4, u32::MAX],
        }],
    }
}

fn cast(view: &PrismView, origin: [f64; 3]) -> Intervals {
    let mut out = vec![boundary(-1.0, 0, 0)];
    view.intervals(&Ray { origin }, &mut Vec::new(), &mut out);
    out
}

fn depths(intervals: &[Boundary]) -> Vec<f64> {
    intervals.iter().map(|b| b.s).collect()
}

#[test]
fn rectangle_caps_sides_and_world_bounds() {
    let mut prism = rectangle();
    let axial = PrismView::new(&prism, 17, &RayFamily { forward: Z });
    assert_eq!(axial.bounds(), ([10.0, 20.0, 32.0], [14.0, 23.0, 35.0]));
    assert_eq!(
        cast(&axial, [12.0, 21.0, 28.0]),
        [boundary(4.0, 17, 0), boundary(7.0, 17, 1)]
    );
    assert!(cast(&axial, [9.0, 21.0, 28.0]).is_empty());
    let side = PrismView::new(&prism, 17, &RayFamily { forward: X });
    assert_eq!(
        cast(&side, [8.0, 21.0, 34.0]),
        [boundary(2.0, 17, u32::MAX), boundary(6.0, 17, 3)]
    );
    assert!(cast(&side, [8.0, 21.0, 31.0]).is_empty());
    assert_eq!(depths(&cast(&side, [8.0, 20.0, 34.0])), [2.0, 6.0]);
    assert!(cast(&side, [8.0, 23.0, 34.0]).is_empty());

    // Rotate the sketch basis in the XY plane and extrude in reverse.
    prism.u = Y;
    prism.v = [-1.0, 0.0, 0.0];
    prism.t1 = -5.0;
    let reverse = PrismView::new(&prism, 19, &RayFamily { forward: Z });
    assert_eq!(reverse.bounds(), ([7.0, 20.0, 25.0], [10.0, 24.0, 32.0]));
    assert_eq!(
        cast(&reverse, [9.0, 22.0, 30.0]),
        [boundary(-5.0, 19, 1), boundary(2.0, 19, 0)]
    );
}

#[test]
fn rays_through_vertices_use_the_half_open_rule() {
    let prism = rectangle();
    let diagonal = PrismView::new(
        &prism,
        17,
        &RayFamily {
            forward: [0.8, 0.6, 0.0],
        },
    );
    assert_eq!(depths(&cast(&diagonal, [10.0, 20.0, 34.0])), [0.0, 5.0]);
    assert!(cast(&diagonal, [14.0, 20.0, 34.0]).is_empty());
}

#[test]
fn oblique_prism_interval_keeps_side_and_clipped_cap_faces() {
    let view = PrismView::new(
        &rectangle(),
        17,
        &RayFamily {
            forward: [0.6, 0.0, 0.8],
        },
    );
    let out = cast(&view, [8.0, 21.0, 30.0]);
    assert_eq!(out.len(), 2);
    assert!((out[0].s - 2.0 / 0.6).abs() < 1e-12);
    assert_eq!((out[0].tool, out[0].face), (17, u32::MAX));
    assert_eq!(out[1], boundary(6.25, 17, 1));
}

#[test]
fn coincident_profile_crossings_keep_edge_order_and_reuse_buffers() {
    let mut prism = rectangle();
    prism.loops.push(Loop {
        points: vec![4.0, 0.0, 6.0, 0.0, 6.0, 3.0, 4.0, 3.0],
        faces: vec![6, 9, 8, 2],
    });
    let view = PrismView::new(&prism, 7, &RayFamily { forward: X });
    let mut scratch = Vec::with_capacity(4);
    let mut out = Vec::with_capacity(4);
    for origin in [[10.0, 21.0, 34.0], [10.0, 22.0, 34.0]] {
        view.intervals(&Ray { origin }, &mut scratch, &mut out);
        assert_eq!(
            out,
            [
                boundary(0.0, 7, u32::MAX),
                boundary(4.0, 7, 3),
                boundary(4.0, 7, 2),
                boundary(6.0, 7, 9),
            ]
        );
    }
    assert_eq!((scratch.capacity(), out.capacity()), (4, 4));
    view.intervals(
        &Ray {
            origin: [f64::MAX; 3],
        },
        &mut scratch,
        &mut out,
    );
    assert!(out.is_empty());
    assert!(scratch.is_empty());
}

#[test]
fn near_axial_rays_agree_on_both_sides_of_the_projection_threshold() {
    let prism = rectangle();
    let axial = PrismView::new(&prism, 1, &RayFamily { forward: Z });
    let origin = [12.0, 21.0, 28.0];
    for dx in [0.5e-9, 1e-9, 2e-9] {
        let tilted = PrismView::new(
            &prism,
            1,
            &RayFamily {
                forward: [dx, 0.0, 1.0],
            },
        );
        let expected = cast(&axial, origin);
        let actual = cast(&tilted, origin);
        assert_eq!(actual.len(), expected.len());
        for (a, b) in actual.iter().zip(expected) {
            assert!((a.s - b.s).abs() < 1e-6);
            assert_eq!((a.tool, a.face), (b.tool, b.face));
        }
    }
}

#[test]
fn degenerate_frames_parsed_from_ncs1_contribute_no_solid() {
    let mut bytes = PLATE.to_vec();
    // The first tool starts at byte 176; its frame follows the tool tag and loop count.
    bytes[184..280].fill(0);
    let scene = parse_scene(&bytes).unwrap();
    let views = prism_views(&scene, Z);
    assert!(cast(&views[0], [20.0, 20.0, 0.0]).is_empty());
    assert_eq!(views[0].average_occupancy(), 1.0);
    assert_eq!(views[0].bounds(), ([0.0; 3], [0.0; 3]));

    let mut prism = rectangle();
    prism.v = X;
    assert!(cast(
        &PrismView::new(&prism, 1, &RayFamily { forward: Z }),
        [12.0, 21.0, 28.0],
    )
    .is_empty());
}

#[test]
fn boolean_operations_preserve_the_causing_faces_and_cancel_coincident_events() {
    let a = [boundary(0.0, 1, 3), boundary(2.0, 1, 4)];
    let touching = [boundary(2.0, 2, 5), boundary(4.0, 2, 6)];
    let mut out = Vec::new();
    combine(&a, &touching, Op::Union, &mut out);
    assert_eq!(out, [a[0], touching[1]]);
    combine(&a, &touching, Op::Intersection, &mut out);
    assert!(out.is_empty());
    combine(&a, &a, Op::Difference, &mut out);
    assert!(out.is_empty());

    let prefix = [boundary(0.0, 2, 7), boundary(1.0, 2, 8)];
    combine(&a, &prefix, Op::Difference, &mut out);
    assert_eq!(out, [prefix[1], a[1]]);
    combine(&a, &prefix, Op::Union, &mut out);
    assert_eq!(out[0], a[0], "the left operand is visited first at a tie");

    let offset = [boundary(1e-12, 2, 9), boundary(2.0 - 1e-12, 2, 10)];
    combine(&a, &offset, Op::Difference, &mut out);
    assert!(out.is_empty());
    let disjoint = [boundary(2.0 + 1e-12, 2, 11), touching[1]];
    combine(&a, &disjoint, Op::Intersection, &mut out);
    assert!(out.is_empty());
    combine(&a, &disjoint, Op::Union, &mut out);
    assert_eq!(out, [a[0], disjoint[1]]);
}

#[test]
fn randomized_interval_lengths_obey_boolean_identities() {
    let mut seed = 27u32;
    let mut random_list = || {
        let mut next = 0.0;
        (0..20)
            .map(|face| {
                seed = seed.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
                next += f64::from((seed >> 16) % 101 + 1) / 32.0;
                boundary(next, 0, face)
            })
            .collect::<Intervals>()
    };
    let length = |list: &[Boundary]| {
        assert_eq!(list.len() % 2, 0);
        assert!(list.windows(2).all(|pair| pair[0].s < pair[1].s));
        list.as_chunks::<2>()
            .0
            .iter()
            .map(|p| p[1].s - p[0].s)
            .sum::<f64>()
    };
    let mut out = Vec::new();
    for _ in 0..256 {
        let a = random_list();
        let b = random_list();
        combine(&a, &b, Op::Intersection, &mut out);
        let intersection = length(&out);
        combine(&a, &b, Op::Union, &mut out);
        assert!((length(&out) + intersection - length(&a) - length(&b)).abs() < 1e-9);
        combine(&a, &b, Op::Difference, &mut out);
        assert!((length(&out) - (length(&a) - intersection)).abs() < 1e-9);
    }
}

fn prism_views(scene: &Scene, forward: [f64; 3]) -> Vec<PrismView> {
    let family = RayFamily { forward };
    scene
        .tools
        .iter()
        .enumerate()
        .map(|(tool, kind)| {
            let Tool::Prism(prism) = kind else {
                panic!("expected only prisms in the fixture")
            };
            PrismView::new(prism, tool as u32, &family)
        })
        .collect()
}

fn fold_body(scene: &Scene, views: &[PrismView], body: usize, origin: [f64; 3]) -> Intervals {
    let mut current = Vec::new();
    let mut tool = Vec::new();
    let mut next = Vec::new();
    let mut scratch = Vec::new();
    for step in &scene.bodies[body].steps {
        views[step.tool as usize].intervals(&Ray { origin }, &mut scratch, &mut tool);
        combine(&current, &tool, step.op, &mut next);
        std::mem::swap(&mut current, &mut next);
    }
    current
}

#[test]
fn plate_fixture_folds_through_holes_pocket_boss_and_intersection() {
    let scene = parse_scene(PLATE).unwrap();
    let views = prism_views(&scene, Z);
    let height = |body, x, y| depths(&fold_body(&scene, &views, body, [x, y, 0.0]));
    assert!(height(0, 5.0, 5.0).is_empty());
    assert_eq!(height(0, 10.0, 5.0), [0.0, 5.0]);
    assert_eq!(height(0, 20.0, 20.0), [0.0, 3.0]);
    assert_eq!(height(0, 62.0, 35.0), [0.0, 13.0]);
    assert_eq!(height(2, 155.0, 20.0), [0.0, 8.0]);
    assert!(height(2, 141.0, 6.0).is_empty());
    assert!(height(2, 155.0, 36.0).is_empty());

    let along_x = prism_views(&scene, X);
    assert_eq!(
        depths(&cast(&along_x[3], [0.0, 35.0, 7.0])),
        [44.0, 50.0, 60.0, 66.0]
    );
    assert_eq!(cast(&along_x[3], [0.0, 42.0, 7.0]).len(), 2);
}

#[test]
fn selected_loops_fixture_uses_the_normalized_profiles() {
    let scene = parse_scene(include_bytes!("fixtures/selected-loops-top.ncs1")).unwrap();
    let views = prism_views(&scene, scene.camera.forward);
    assert!(cast(&views[0], [37.0, 20.0, 10.0]).is_empty());
    assert_eq!(depths(&cast(&views[0], [30.0, 20.0, 10.0])), [6.0, 10.0]);
    assert_eq!(depths(&cast(&views[1], [110.0, 20.0, 10.0])), [6.0, 10.0]);
}

#[test]
fn overlap_reports_first_last_and_total_of_qualified_stretches() {
    let scene = parse_scene(PLATE).unwrap();
    let views = prism_views(&scene, Z);
    let at = |x, y| {
        let origin = [x, y, 0.0];
        let plate = fold_body(&scene, &views, 0, origin);
        let block = fold_body(&scene, &views, 1, origin);
        overlap(&plate, &block, scene.tolerance)
    };
    assert_eq!(at(90.0, 50.0), Some((2.0, 5.0, 3.0)));
    assert_eq!(at(20.0, 20.0), None);

    let a = [0.0, 1.0, 2.0, 5.0, 8.0, 10.0].map(|s| boundary(s, 0, 0));
    let b = [0.5, 9.5].map(|s| boundary(s, 1, 1));
    assert_eq!(overlap(&a, &b, 0.5), Some((2.0, 9.5, 4.5)));
    assert_eq!(overlap(&b, &a, 0.0), Some((0.5, 9.5, 5.0)));
    assert_eq!(overlap(&a, &b, 3.0), None);
}

#[test]
fn near_axial_projection_threshold_changes_whether_a_ray_can_enter_through_a_side() {
    let origin = [10.0 - 1.5e-9, 21.0, 30.0];
    let at = |dx| {
        cast(
            &PrismView::new(
                &rectangle(),
                17,
                &RayFamily {
                    forward: [dx, 0.0, 1.0],
                },
            ),
            origin,
        )
    };
    assert!(at(0.5e-9).is_empty());
    let above = at(2e-9);
    assert_eq!(above.len(), 2);
    assert_eq!(above[0], boundary(2.0, 17, 0));
    assert_eq!(above[1], boundary(5.0, 17, 1));
}

#[test]
fn near_planar_slab_threshold_changes_whether_a_ray_can_enter_through_a_cap() {
    let origin = [10.0, 21.0, 32.0 - 1.5e-12];
    let at = |dz| {
        cast(
            &PrismView::new(
                &rectangle(),
                17,
                &RayFamily {
                    forward: [1.0, 0.0, dz],
                },
            ),
            origin,
        )
    };
    assert!(at(0.5e-12).is_empty());
    let above = at(2e-12);
    assert_eq!(above.len(), 2);
    assert!((0.7..0.8).contains(&above[0].s));
    assert_eq!(above[0].face, 0);
    assert_eq!(above[1], boundary(4.0, 17, 3));
}

#[test]
fn near_unit_prism_frames_must_meet_the_frame_tolerance() {
    for (epsilon, solid) in [(0.5e-9, true), (2e-9, false)] {
        let mut prism = rectangle();
        prism.v[1] += epsilon;
        let view = PrismView::new(&prism, 1, &RayFamily { forward: Z });
        let intervals = cast(&view, [12.0, 21.0, 28.0]);
        if solid {
            assert_eq!(depths(&intervals), [4.0, 7.0]);
        } else {
            assert!(intervals.is_empty());
        }
    }
}

#[test]
fn average_occupancy_counts_only_nonempty_buckets() {
    let mut prism = rectangle();
    let mut second = rectangle().loops.pop().unwrap();
    for point in second.points.as_chunks_mut::<2>().0 {
        point[1] += 1_000.0;
    }
    prism.loops.push(second);
    let view = PrismView::new(&prism, 17, &RayFamily { forward: X });
    assert_eq!(view.average_occupancy(), 4.0);
    assert!(cast(&view, [10.0, 500.0, 34.0]).is_empty());
    assert_eq!(depths(&cast(&view, [10.0, 1021.0, 34.0])), [0.0, 4.0]);
}
