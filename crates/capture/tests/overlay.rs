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
