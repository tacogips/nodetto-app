//! Boolean operations on the solid portions of a ray.

use crate::scene::Op;

pub const MERGE_EPS: f64 = 1e-7;

#[derive(Clone, Copy, PartialEq, Debug)]
pub struct Boundary {
    pub s: f64,
    pub tool: u32,
    pub face: u32,
}

/// Sorted boundaries in entering and leaving pairs.
pub type Intervals = Vec<Boundary>;

pub fn combine(a: &[Boundary], b: &[Boundary], op: Op, out: &mut Intervals) {
    out.clear();
    let mut i = 0;
    let mut j = 0;
    let mut inside = false;
    while i < a.len() || j < b.len() {
        let boundary = if j == b.len() || (i < a.len() && a[i].s <= b[j].s) {
            i += 1;
            a[i - 1]
        } else {
            j += 1;
            b[j - 1]
        };
        let in_a = i % 2 != 0;
        let in_b = j % 2 != 0;
        let next = match op {
            Op::Union => in_a || in_b,
            Op::Difference => in_a && !in_b,
            Op::Intersection => in_a && in_b,
        };
        if next != inside {
            if out
                .last()
                .is_some_and(|last| boundary.s - last.s < MERGE_EPS)
            {
                out.pop();
            } else {
                out.push(boundary);
            }
            inside = next;
        }
    }
}

/// Return the first start, last end, and total length of overlaps longer than tolerance.
pub fn overlap(a: &[Boundary], b: &[Boundary], tolerance: f64) -> Option<(f64, f64, f64)> {
    let mut a = a.as_chunks::<2>().0.iter().peekable();
    let mut b = b.as_chunks::<2>().0.iter().peekable();
    let mut first = None;
    let mut last = 0.0;
    let mut total = 0.0;
    while let (Some(left), Some(right)) = (a.peek(), b.peek()) {
        let start = left[0].s.max(right[0].s);
        let end = left[1].s.min(right[1].s);
        let length = end - start;
        if length > tolerance {
            first.get_or_insert(start);
            last = end;
            total += length;
        }
        if left[1].s <= right[1].s {
            a.next();
        } else {
            b.next();
        }
    }
    first.map(|start| (start, last, total))
}
