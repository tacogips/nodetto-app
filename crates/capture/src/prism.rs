//! Ray intersections with an extruded even-odd sketch profile.

use std::cmp::Ordering;

use crate::interval::{Boundary, Intervals, MERGE_EPS};
use crate::scene::{Loop, Prism};
use crate::view::{dot, Ray, RayFamily};

struct Edge {
    a: [f64; 2],
    b: [f64; 2],
    ca: f64,
    cb: f64,
    face: u32,
}

struct Buckets {
    lo: f64,
    hi: f64,
    bins: Vec<Vec<usize>>,
    average_occupancy: f64,
}

impl Buckets {
    fn new(edges: &[Edge], max_bins: usize) -> Self {
        let mut lo = f64::INFINITY;
        let mut hi = f64::NEG_INFINITY;
        for edge in edges {
            lo = lo.min(edge.ca.min(edge.cb));
            hi = hi.max(edge.ca.max(edge.cb));
        }
        let mut count = if lo < hi && (hi - lo).is_finite() {
            edges.len().clamp(1, max_bins)
        } else {
            1
        };
        let limit = edges.len().saturating_mul(4).saturating_add(4096);
        let bins = loop {
            let ranges = || {
                edges.iter().map(|edge| {
                    let start = bin_index(edge.ca.min(edge.cb), lo, hi, count);
                    let end = bin_index(edge.ca.max(edge.cb), lo, hi, count);
                    start..=end
                })
            };
            let mut listings = 0usize;
            for range in ranges() {
                listings = listings.saturating_add(range.end() - range.start() + 1);
                if listings > limit {
                    break;
                }
            }
            if listings <= limit {
                let mut bins = vec![Vec::new(); count];
                for (edge, range) in ranges().enumerate() {
                    for bin in range {
                        bins[bin].push(edge);
                    }
                }
                break bins;
            }
            count /= 2;
        };
        let occupied = bins.iter().filter(|bin| !bin.is_empty()).count().max(1);
        let listings: usize = bins.iter().map(Vec::len).sum();
        Self {
            lo,
            hi,
            bins,
            average_occupancy: (listings as f64 / occupied as f64).max(1.0),
        }
    }

    fn at(&self, c: f64) -> &[usize] {
        if (self.lo..=self.hi).contains(&c) {
            &self.bins[bin_index(c, self.lo, self.hi, self.bins.len())]
        } else {
            &[]
        }
    }
}

fn bin_index(c: f64, lo: f64, hi: f64, count: usize) -> usize {
    if count == 1 {
        return 0;
    }
    (((c - lo) / (hi - lo) * count as f64) as usize).min(count - 1)
}

pub struct PrismView {
    origin: [f64; 3],
    basis: [[f64; 3]; 3],
    span: [f64; 2],
    tool: u32,
    dx: f64,
    dy: f64,
    dz: f64,
    projected_length_sq: f64,
    c_increases: bool,
    parallel: bool,
    bounds: ([f64; 3], [f64; 3]),
    edges: Vec<Edge>,
    buckets: Buckets,
}

pub(crate) fn orthonormal([u, v, n]: [[f64; 3]; 3]) -> bool {
    const TOLERANCE: f64 = 1e-9;
    [u, v, n]
        .into_iter()
        .all(|axis| (dot(axis, axis).sqrt() - 1.0).abs() <= TOLERANCE)
        && [(u, v), (u, n), (v, n)]
            .into_iter()
            .all(|(a, b)| dot(a, b).abs() <= TOLERANCE)
}

// Choose a common infinitesimal world direction ordered by X, Y, Z.
fn increases_in_world(gradient: [f64; 3]) -> bool {
    let scale = gradient.into_iter().map(f64::abs).fold(0.0, f64::max);
    gradient
        .into_iter()
        .find(|value| value.abs() > 1e-12 * scale)
        .is_some_and(|value| value > 0.0)
}

impl PrismView {
    pub fn new(prism: &Prism, tool: u32, family: &RayFamily) -> Self {
        let basis = [prism.u, prism.v, prism.n];
        let [mut dx, mut dy, dz] = basis.map(|axis| dot(family.forward, axis));
        let parallel = dx * dx + dy * dy < 1e-18;
        if parallel {
            dx = 1.0;
            dy = 0.0;
        }
        let mut edges = Vec::new();
        let mut min = [f64::INFINITY; 3];
        let mut max = [f64::NEG_INFINITY; 3];
        // Parsed scenes can carry a degenerate frame. Such a tool contributes
        // no solid, while its original face ids remain opaque when valid.
        if orthonormal(basis)
            && (dx * dx + dy * dy).is_finite()
            && dz.is_finite()
            && prism.t0.is_finite()
            && prism.t1.is_finite()
            && prism.t0 != prism.t1
        {
            for Loop { points, faces } in &prism.loops {
                let (vertices, remainder) = points.as_chunks::<2>();
                if !remainder.is_empty() || vertices.len() != faces.len() || vertices.len() < 3 {
                    continue;
                }
                for ((&a, &b), &face) in vertices
                    .iter()
                    .zip(vertices.iter().cycle().skip(1))
                    .zip(faces)
                {
                    let ca = dx * a[1] - dy * a[0];
                    let cb = dx * b[1] - dy * b[0];
                    if ca.is_finite() && cb.is_finite() {
                        edges.push(Edge { a, b, ca, cb, face });
                    }
                    for axis in 0..3 {
                        let base = prism.o[axis] + prism.u[axis] * a[0] + prism.v[axis] * a[1];
                        let start = base + prism.n[axis] * prism.t0;
                        let end = base + prism.n[axis] * prism.t1;
                        min[axis] = min[axis].min(start.min(end));
                        max[axis] = max[axis].max(start.max(end));
                    }
                }
            }
        }
        let bounds = if edges.is_empty() {
            (prism.o, prism.o)
        } else {
            (min, max)
        };
        let buckets = Buckets::new(&edges, 4096);
        Self {
            origin: prism.o,
            basis,
            span: [prism.t0, prism.t1],
            tool,
            dx,
            dy,
            dz,
            projected_length_sq: dx * dx + dy * dy,
            c_increases: increases_in_world(std::array::from_fn(|i| {
                dx * prism.v[i] - dy * prism.u[i]
            })),
            parallel,
            bounds,
            edges,
            buckets,
        }
    }

    pub fn bounds(&self) -> ([f64; 3], [f64; 3]) {
        self.bounds
    }

    pub fn average_occupancy(&self) -> f64 {
        self.buckets.average_occupancy
    }

    /// Edges one ray tests: the length of the bucket the ray falls in.
    pub(crate) fn scan_cost(&self, ray: &Ray) -> usize {
        let offset: [f64; 3] = std::array::from_fn(|axis| ray.origin[axis] - self.origin[axis]);
        let [x, y, _] = self.basis.map(|axis| dot(offset, axis));
        self.buckets.at(self.dx * y - self.dy * x).len()
    }

    fn cap_error(&self, offset: [f64; 3], lo: f64, hi: f64) -> f64 {
        8.0 * f64::EPSILON
            * (dot(self.basis[2].map(f64::abs), offset.map(f64::abs)) + lo.abs().max(hi.abs()))
    }

    fn slab<const FACETS: bool>(&self, z: f64, offset: [f64; 3]) -> Option<[Boundary; 2]> {
        let [start, end] = self.span;
        if !z.is_finite() {
            return None;
        }
        let boundary = |s, face| Boundary {
            s,
            tool: self.tool,
            face,
        };
        if self.dz.abs() <= 1e-12 {
            let (lo, hi) = (start.min(end), start.max(end));
            let inside = if FACETS {
                (lo..=hi).contains(&z)
            } else {
                // Resolve coplanar volume rays consistently even if adjoining
                // prisms use opposite normals. Shading retains its closed slab.
                let normal = self.basis[2];
                let error = self.cap_error(offset, lo, hi);
                let near_lo = (z - lo).abs();
                let near_hi = (z - hi).abs();
                if near_lo.min(near_hi) <= error {
                    (near_lo <= near_hi) == increases_in_world(normal)
                } else {
                    (lo..hi).contains(&z)
                }
            };
            return inside.then(|| [boundary(f64::NEG_INFINITY, 0), boundary(f64::INFINITY, 1)]);
        }
        let a = boundary((start - z) / self.dz, 0);
        let b = boundary((end - z) / self.dz, 1);
        Some(if a.s <= b.s { [a, b] } else { [b, a] })
    }

    /// Replace the ray's intervals in `out`, using reusable crossing storage.
    pub fn intervals(&self, ray: &Ray, scratch: &mut Vec<Boundary>, out: &mut Intervals) {
        self.cast::<false>(ray, scratch, out);
    }

    /// Retain the actual facet for shading when several edges share a face id.
    pub(crate) fn surface_intervals(
        &self,
        ray: &Ray,
        scratch: &mut Vec<Boundary>,
        out: &mut Intervals,
    ) -> bool {
        self.cast::<true>(ray, scratch, out)
    }

    pub(crate) fn surface(&self, index: u32) -> Option<(u32, [f64; 3])> {
        let [u, v, n] = self.basis;
        if index < 2 {
            return Some((index, n));
        }
        let edge = self.edges.get((index - 2) as usize)?;
        let x = edge.b[1] - edge.a[1];
        let y = edge.a[0] - edge.b[0];
        let scale = x.abs().max(y.abs());
        if scale == 0.0 {
            return None;
        }
        let (x, y) = (x / scale, y / scale);
        let length = (x * x + y * y).sqrt();
        Some((
            edge.face,
            std::array::from_fn(|axis| (u[axis] * x + v[axis] * y) / length),
        ))
    }

    fn cast<const FACETS: bool>(
        &self,
        ray: &Ray,
        scratch: &mut Vec<Boundary>,
        out: &mut Intervals,
    ) -> bool {
        scratch.clear();
        out.clear();
        let offset = std::array::from_fn(|axis| ray.origin[axis] - self.origin[axis]);
        let [x, y, z] = self.basis.map(|axis| dot(offset, axis));
        let [start, end] = self.span;
        let (lo, hi) = (start.min(end), start.max(end));
        let cap_band = FACETS
            && self.dz.abs() <= 1e-12
            && z.is_finite()
            && (z - lo).abs().min((z - hi).abs()) <= self.cap_error(offset, lo, hi);
        let Some([near, far]) = self.slab::<FACETS>(z, offset) else {
            return cap_band;
        };
        let mut sensitive = cap_band;
        let error_v = 8.0 * f64::EPSILON * offset.into_iter().map(f64::abs).sum::<f64>();
        let c_error_v = (self.dx.abs() + self.dy.abs()) * error_v;
        let c = self.dx * y - self.dy * x;
        let mut inside = false;
        // Resolve crossings on a shared side using the same infinitesimal
        // world direction as the cap test, even in reversed sketch frames.
        let error = if FACETS {
            0.0
        } else {
            8.0 * f64::EPSILON * offset.into_iter().map(f64::abs).sum::<f64>()
        };
        let c_error = (self.dx.abs() + self.dy.abs()) * error;
        let after_ray = |end: f64| {
            if !FACETS && (end - c).abs() <= c_error {
                !self.c_increases
            } else {
                end > c
            }
        };
        for &index in self.buckets.at(c) {
            let edge = &self.edges[index];
            if FACETS && ((edge.ca - c).abs() <= c_error_v || (edge.cb - c).abs() <= c_error_v) {
                sensitive = true;
            }
            if after_ray(edge.ca) == after_ray(edge.cb) {
                continue;
            }
            let fraction = (c - edge.ca) / (edge.cb - edge.ca);
            let fraction = if FACETS {
                fraction
            } else {
                fraction.clamp(0.0, 1.0)
            };
            let qx = edge.a[0] + fraction * (edge.b[0] - edge.a[0]);
            if self.parallel {
                if FACETS && (qx - x).abs() <= error_v {
                    sensitive = true;
                }
                let side = if !FACETS && (qx - x).abs() <= error {
                    let rise = edge.b[1] - edge.a[1];
                    let slope = (edge.b[0] - edge.a[0]) / rise;
                    let [u, v, _] = self.basis;
                    increases_in_world(std::array::from_fn(|i| slope * v[i] - u[i]))
                } else {
                    qx > x
                };
                inside ^= side;
                continue;
            }
            let qy = edge.a[1] + fraction * (edge.b[1] - edge.a[1]);
            let s = ((qx - x) * self.dx + (qy - y) * self.dy) / self.projected_length_sq;
            if s.is_finite() {
                // An NCS1 scene has at most four million edges. Keep their
                // order in ties without allocating temporary sort storage.
                scratch.push(Boundary {
                    s,
                    tool: index as u32,
                    face: if FACETS { index as u32 + 2 } else { edge.face },
                });
            }
        }
        if self.parallel {
            if inside && near.s.is_finite() && far.s.is_finite() && far.s - near.s >= MERGE_EPS {
                out.extend([near, far]);
            }
            return sensitive;
        }
        scratch.sort_unstable_by(|a, b| {
            a.s.partial_cmp(&b.s)
                .unwrap_or(Ordering::Equal)
                .then(a.tool.cmp(&b.tool))
        });
        // A malformed profile with an unpaired crossing cannot create a solid.
        for pair in scratch.as_chunks::<2>().0 {
            let side = |i: usize| Boundary {
                tool: self.tool,
                ..pair[i]
            };
            let start = if pair[0].s < near.s { near } else { side(0) };
            let end = if pair[1].s > far.s { far } else { side(1) };
            if end.s - start.s >= MERGE_EPS {
                out.extend([start, end]);
            }
        }
        sensitive
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ownership_sensitive_surface_casts() {
        let mut prism = Prism {
            o: [0., 0., 0.],
            u: [1., 0., 0.],
            v: [0., 1., 0.],
            n: [0., 0., 1.],
            t0: 0.,
            t1: 0.9375,
            loops: vec![Loop {
                points: vec![0., 0., 16., 0., 16., 8., 0., 8.],
                faces: vec![2, 3, 4, u32::MAX],
            }],
        };
        let check = |prism: &Prism, forward, origin, expected| {
            let view = PrismView::new(prism, 0, &RayFamily { forward });
            let ray = Ray { origin };
            let mut scratch = Vec::new();
            let mut surface = Vec::new();
            let mut volume = Vec::new();
            let flag = view.surface_intervals(&ray, &mut scratch, &mut surface);
            assert_eq!(flag, expected, "forward={forward:?} origin={origin:?}");
            if !expected {
                view.intervals(&ray, &mut scratch, &mut volume);
                assert_eq!(
                    surface.iter().map(|b| b.s).collect::<Vec<_>>(),
                    volume.iter().map(|b| b.s).collect::<Vec<_>>()
                );
            }
        };
        for z in [0., 0.9375] {
            check(&prism, [0., 1., 0.], [4., -1., z], true);
        }
        for z in [-1e-16, 0.9375 + 1e-15] {
            let view = PrismView::new(
                &prism,
                0,
                &RayFamily {
                    forward: [0., 1., 0.],
                },
            );
            let ray = Ray {
                origin: [4., -1., z],
            };
            let mut scratch = Vec::new();
            let mut surface = Vec::new();
            let flag = view.surface_intervals(&ray, &mut scratch, &mut surface);
            assert!(surface.is_empty());
            assert!(flag, "z={z:?}");
        }
        check(&prism, [0., 1., 0.], [4., -1., 0.5], false);
        check(&prism, [1., 0., 0.], [-1., 0., 0.5], true);
        check(&prism, [1., 0., 0.], [-1., 4., 0.5], false);
        let scale = (0.3_f64 * 0.3 + 0.4 * 0.4 + 0.866 * 0.866).sqrt();
        check(
            &prism,
            [0.3 / scale, 0.4 / scale, -0.866 / scale],
            [8., 4., 0.5],
            false,
        );
        prism.o = [8., 8., 0.];
        prism.u = [-1., 0., 0.];
        prism.v = [0., -1., 0.];
        prism.loops[0].points = vec![0., 0., 8., 0., 8., 8., 0., 8.];
        check(&prism, [0., 0., -1.], [8., 4., 2.], true);
        check(&prism, [0., 0., -1.], [4., 4., 2.], false);
    }

    #[test]
    fn long_crossing_edges_fit_the_bucket_budget() {
        let edges = 2000;
        let points = (0..edges)
            .flat_map(|i| [f64::from(i), f64::from(i % 2)])
            .collect();
        let prism = Prism {
            o: [0.0; 3],
            u: [1.0, 0.0, 0.0],
            v: [0.0, 1.0, 0.0],
            n: [0.0, 0.0, 1.0],
            t0: 0.0,
            t1: 1.0,
            loops: vec![Loop {
                points,
                faces: (2..edges + 2).collect(),
            }],
        };
        let mut view = PrismView::new(&prism, 3, &RayFamily { forward: prism.u });
        let limit = 4 * edges as usize + 4096;
        let bins = &view.buckets.bins;
        assert_eq!(bins.len(), 3);
        assert!(bins.iter().map(Vec::len).sum::<usize>() <= limit);
        assert_eq!(view.average_occupancy(), f64::from(edges));

        let one_bin = Buckets::new(&view.edges, 1);
        let origins = [0.0, 0.25, 1.0 / 3.0, 0.5, 2.0 / 3.0, 0.75, 1.0];
        let mut scratch = Vec::new();
        let mut out = Vec::new();
        let answers: Vec<_> = origins
            .iter()
            .map(|&y| {
                view.intervals(
                    &Ray {
                        origin: [0.0, y, 0.5],
                    },
                    &mut scratch,
                    &mut out,
                );
                out.clone()
            })
            .collect();
        assert!(!answers[3].is_empty());
        view.buckets = one_bin;
        for (y, expected) in origins.into_iter().zip(answers) {
            view.intervals(
                &Ray {
                    origin: [0.0, y, 0.5],
                },
                &mut scratch,
                &mut out,
            );
            assert_eq!(out, expected);
        }
    }
}
