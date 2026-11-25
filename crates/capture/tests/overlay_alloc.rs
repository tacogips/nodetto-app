#[allow(dead_code)]
mod support;

use nodetto_capture::{render_rgb, scene::Op};
use std::alloc::{GlobalAlloc, Layout, System};
use std::sync::atomic::{AtomicUsize, Ordering};
use support::{body, box_prism, scene};

struct Counting;
static ALLOCATIONS: AtomicUsize = AtomicUsize::new(0);
unsafe impl GlobalAlloc for Counting {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        ALLOCATIONS.fetch_add(1, Ordering::Relaxed);
        unsafe { System.alloc(layout) }
    }
    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        unsafe { System.dealloc(ptr, layout) }
    }
    unsafe fn realloc(&self, ptr: *mut u8, layout: Layout, size: usize) -> *mut u8 {
        ALLOCATIONS.fetch_add(1, Ordering::Relaxed);
        unsafe { System.realloc(ptr, layout, size) }
    }
}
#[global_allocator]
static ALLOCATOR: Counting = Counting;

#[test]
fn single_solid_does_not_allocate_per_sample() {
    let mut s = scene(
        vec![box_prism([-1000.0, -1000.0, 0.0], 2000.0, 2000.0, 4.0)],
        vec![body(&[(Op::Union, 0)])],
    );
    s.width = 1024;
    s.height = 768;
    s.supersample = 2;
    s.analyse = false;
    s.bodies[0].analysed = true;
    let before = ALLOCATIONS.load(Ordering::Relaxed);
    let marked = render_rgb(&s, 1).unwrap().0;
    let allocations = ALLOCATIONS.load(Ordering::Relaxed) - before;
    s.draw_interference = false;
    assert_eq!(marked, render_rgb(&s, 1).unwrap().0);
    let samples = s.width as usize * s.height as usize * 4;
    assert!(
        allocations < samples / 16,
        "render allocations: {allocations}, samples: {samples}"
    );
}

fn mesh_scene(positions: Vec<f64>, triangles: Vec<u32>) -> nodetto_capture::scene::Scene {
    let mut s = scene(
        vec![nodetto_capture::scene::Tool::Mesh(
            nodetto_capture::scene::Mesh {
                positions,
                triangles,
            },
        )],
        vec![body(&[(Op::Union, 0)])],
    );
    s.analyse = false;
    s.draw_interference = false;
    s
}

#[test]
fn open_square_does_not_allocate_per_sample() {
    let mut s = mesh_scene(
        vec![
            -100., -100., 0., 100., -100., 0., 100., 100., 0., -100., 100., 0.,
        ],
        vec![0, 1, 2, 0, 2, 3],
    );
    s.width = 1024;
    s.height = 1024;
    s.supersample = 2;
    let before = ALLOCATIONS.load(Ordering::Relaxed);
    let rgb = render_rgb(&s, 1).unwrap().0;
    let allocations = ALLOCATIONS.load(Ordering::Relaxed) - before;
    assert_eq!(rgb, render_rgb(&s, 4).unwrap().0);
    let samples = s.width as usize * s.height as usize * 4;
    assert!(
        allocations < samples / 16,
        "render allocations: {allocations}, samples: {samples}"
    );
}

#[test]
fn open_mesh_ordering_render_digests() {
    // Pixel centres include x = 0: an odd width makes the crossing visible.
    for equal in [false, true] {
        let positions = if equal {
            vec![
                -16., -16., 0., 16., -16., 0., 0., 16., 0., -16., -16., -16., 16., -16., 16., 0.,
                16., 0.,
            ]
        } else {
            vec![
                -16., -16., 0., 16., -16., 0., 0., 16., 0., -12., -16., 2., 20., -16., 6., 4., 16.,
                4.,
            ]
        };
        let mut digests = Vec::new();
        for triangles in [vec![0, 1, 2, 3, 4, 5], vec![3, 4, 5, 0, 1, 2]] {
            let mut s = mesh_scene(positions.clone(), triangles);
            s.width = 95;
            s.height = 95;
            let rgb = render_rgb(&s, 1).unwrap().0;
            assert_eq!(rgb, render_rgb(&s, 4).unwrap().0);
            digests.push(support::digest(&rgb));
        }
        let expected = if equal {
            [7235842131322816141, 18189382779238489804]
        } else {
            [1759672757054305250, 1759672757054305250]
        };
        assert_eq!(digests, expected);
        if equal {
            assert_ne!(digests[0], digests[1]);
        }
    }
}
