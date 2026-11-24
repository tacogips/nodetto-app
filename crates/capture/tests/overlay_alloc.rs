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
