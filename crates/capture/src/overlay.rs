//! M17 interference overlay.

use crate::interference::ViewPair;
use crate::interval::{overlap, Boundary};
use crate::report::PairReport;
use crate::view::Ray;
use crate::CaptureError;
use std::collections::{BTreeMap, BTreeSet};

pub const NEAREST_BODIES: usize = 8;
pub const VIEW_PAIR_LIMIT: usize = 4096;
#[derive(Clone, Copy)]
pub struct SampleBody<'a> {
    pub body: u32,
    pub intervals: &'a [Boundary],
}

pub fn overlapping_pairs(
    bodies: &[SampleBody<'_>],
    tolerance: f64,
    comparisons: &mut u64,
    out: &mut Vec<(u32, u32, f64, f64)>,
) {
    overlapping_pairs_iter(bodies.iter().copied(), tolerance, comparisons, out);
}

pub(crate) fn overlapping_pairs_iter<'a>(
    bodies: impl Iterator<Item = SampleBody<'a>>,
    tolerance: f64,
    comparisons: &mut u64,
    out: &mut Vec<(u32, u32, f64, f64)>,
) {
    let mut nearest: [Option<SampleBody<'_>>; NEAREST_BODIES] = [None; NEAREST_BODIES];
    let mut len = 0;
    for body in bodies.filter(|body| !body.intervals.is_empty()) {
        let position = (0..len)
            .find(|&i| {
                let current = nearest[i].unwrap();
                body.intervals[0]
                    .s
                    .total_cmp(&current.intervals[0].s)
                    .then(body.body.cmp(&current.body))
                    .is_lt()
            })
            .unwrap_or(len);
        if position < NEAREST_BODIES {
            let end = len.min(NEAREST_BODIES - 1);
            for i in (position..end).rev() {
                nearest[i + 1] = nearest[i];
            }
            nearest[position] = Some(body);
            len = (len + 1).min(NEAREST_BODIES);
        }
    }
    if len < 2 {
        return;
    }
    let nearest = &nearest[..len];
    for (i, a) in nearest.iter().enumerate() {
        let a = a.unwrap();
        for b in &nearest[i + 1..] {
            let b = b.unwrap();
            *comparisons = comparisons.saturating_add(1);
            if a.body != b.body {
                if let Some((s0, s1, _)) = overlap(a.intervals, b.intervals, tolerance) {
                    out.push((a.body.min(b.body), a.body.max(b.body), s0, s1));
                }
            }
        }
    }
}

pub fn stretch_box(
    ray: &Ray,
    forward: [f64; 3],
    right: [f64; 3],
    up: [f64; 3],
    half_step: f64,
    s0: f64,
    s1: f64,
) -> ([f64; 3], [f64; 3]) {
    let mut min = [0.0; 3];
    let mut max = [0.0; 3];
    for i in 0..3 {
        let a = ray.origin[i] + forward[i] * s0;
        let b = ray.origin[i] + forward[i] * s1;
        let radius = half_step.abs() * (right[i].abs() + up[i].abs());
        min[i] = a.min(b) - radius;
        max[i] = a.max(b) + radius;
    }
    (min, max)
}

#[derive(Default)]
pub struct MarkTable {
    marks: BTreeMap<(u32, u32), ([f64; 3], [f64; 3])>,
}
impl MarkTable {
    pub fn record(&mut self, a: u32, b: u32, min: [f64; 3], max: [f64; 3]) {
        let entry = self.marks.entry((a.min(b), a.max(b))).or_insert((min, max));
        for i in 0..3 {
            entry.0[i] = entry.0[i].min(min[i]);
            entry.1[i] = entry.1[i].max(max[i]);
        }
    }
    pub fn merge(&mut self, later_band: MarkTable) {
        for ((a, b), (min, max)) in later_band.marks {
            self.record(a, b, min, max);
        }
    }
    pub fn picture_only(&self, reported: &[PairReport]) -> Result<Vec<ViewPair>, CaptureError> {
        let reported: BTreeSet<_> = reported.iter().map(|p| (p.a, p.b)).collect();
        let pairs: Vec<_> = self
            .marks
            .iter()
            .filter(|(key, _)| !reported.contains(key))
            .map(|(&(a, b), &(min, max))| ViewPair { a, b, min, max })
            .collect();
        if pairs.len() > VIEW_PAIR_LIMIT {
            return Err(CaptureError(format!("Too many interfering pairs in this view ({}). Use --interference-bodies or --no-interference.", pairs.len())));
        }
        Ok(pairs)
    }
}
pub fn hatch(x: u32, y: u32, body: [u8; 3], interference: [u8; 3], outline: bool) -> [u8; 3] {
    if outline || ((u64::from(x) + u64::from(y)) / 8) % 2 == 0 {
        interference
    } else {
        body
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn boundary(s: f64) -> Boundary {
        Boundary {
            s,
            tool: 0,
            face: 0,
        }
    }
    #[test]
    fn overlaps_and_nearest_limit() {
        let intervals = [boundary(0.0), boundary(2.0)];
        let bodies: Vec<_> = (0..10)
            .map(|body| SampleBody {
                body,
                intervals: &intervals,
            })
            .collect();
        let mut out = Vec::new();
        let mut comparisons = 0;
        overlapping_pairs(&bodies, 0.001, &mut comparisons, &mut out);
        assert_eq!(comparisons, 28);
        assert_eq!(out.len(), 28);
        assert!(out.iter().all(|p| p.1 < 8));
        let touch = [boundary(2.0), boundary(3.0)];
        let sliver = [boundary(1.9995), boundary(3.0)];
        for other in [&touch, &sliver] {
            out.clear();
            overlapping_pairs(
                &[
                    SampleBody {
                        body: 0,
                        intervals: &intervals,
                    },
                    SampleBody {
                        body: 1,
                        intervals: other,
                    },
                ],
                0.001,
                &mut comparisons,
                &mut out,
            );
            assert!(out.is_empty());
        }
    }
    #[test]
    fn table_and_hatch() {
        let mut a = MarkTable::default();
        let mut b = MarkTable::default();
        a.record(1, 0, [0.0; 3], [1.0; 3]);
        b.record(0, 1, [-1.0; 3], [2.0; 3]);
        a.merge(b);
        let pairs = a.picture_only(&[]).unwrap();
        assert_eq!(pairs[0].min, [-1.0; 3]);
        assert_eq!(pairs[0].max, [2.0; 3]);
        for i in 2..=4097 {
            a.record(0, i, [0.0; 3], [1.0; 3]);
        }
        assert_eq!(a.picture_only(&[]).unwrap_err().0, "Too many interfering pairs in this view (4097). Use --interference-bodies or --no-interference.");
        for (body, ink) in [
            ([255, 253, 248], [51, 92, 103]),
            ([31, 36, 39], [95, 180, 199]),
        ] {
            assert_eq!(hatch(0, 0, body, ink, false), ink);
            assert_eq!(hatch(8, 0, body, ink, false), body);
            assert_eq!(hatch(8, 0, body, ink, true), ink);
        }
    }
}

#[cfg(test)]
mod contract_tests {
    use super::*;
    fn bounds(s: f64) -> Boundary {
        Boundary {
            s,
            tool: 0,
            face: 0,
        }
    }
    #[test]
    fn overlap_stretch_and_box() {
        let a = [bounds(0.0), bounds(2.0)];
        let b = [bounds(1.0), bounds(3.0)];
        let mut out = vec![];
        let mut comparisons = 0;
        overlapping_pairs(
            &[
                SampleBody {
                    body: 3,
                    intervals: &a,
                },
                SampleBody {
                    body: 1,
                    intervals: &b,
                },
            ],
            0.001,
            &mut comparisons,
            &mut out,
        );
        assert_eq!(out, vec![(1, 3, 1.0, 2.0)]);
        assert_eq!(comparisons, 1);
        let ray = Ray {
            origin: [10.0, 20.0, 30.0],
        };
        assert_eq!(
            stretch_box(
                &ray,
                [0.0, 0.0, -1.0],
                [1.0, 0.0, 0.0],
                [0.0, 1.0, 0.0],
                0.5,
                2.0,
                4.0
            ),
            ([9.5, 19.5, 26.0], [10.5, 20.5, 28.0])
        );
    }
    #[test]
    fn bands_merge_deterministically_and_exclude_reported() {
        let mut first = MarkTable::default();
        first.record(1, 2, [0.0; 3], [1.0; 3]);
        first.record(0, 2, [3.0; 3], [4.0; 3]);
        let mut later = MarkTable::default();
        later.record(2, 1, [-1.0; 3], [2.0; 3]);
        first.merge(later);
        let mut reverse = MarkTable::default();
        reverse.record(2, 1, [-1.0; 3], [2.0; 3]);
        let mut other = MarkTable::default();
        other.record(0, 2, [3.0; 3], [4.0; 3]);
        other.record(1, 2, [0.0; 3], [1.0; 3]);
        reverse.merge(other);
        assert_eq!(
            first.picture_only(&[]).unwrap(),
            reverse.picture_only(&[]).unwrap()
        );
        let report = PairReport {
            a: 0,
            b: 2,
            volume: 1.0,
            min: [0.0; 3],
            max: [1.0; 3],
            from_view: false,
            capped: false,
        };
        let remaining = first.picture_only(&[report]).unwrap();
        assert_eq!(
            remaining,
            vec![ViewPair {
                a: 1,
                b: 2,
                min: [-1.0; 3],
                max: [2.0; 3]
            }]
        );
        let mut limit = MarkTable::default();
        for i in 1..=4096 {
            limit.record(0, i, [0.0; 3], [1.0; 3]);
        }
        assert_eq!(limit.picture_only(&[]).unwrap().len(), 4096);
    }
}
