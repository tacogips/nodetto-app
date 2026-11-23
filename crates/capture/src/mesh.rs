//! Projected triangle grids for parallel mesh rays.
use crate::interval::{Boundary, Intervals};
use crate::scene::Mesh;
use crate::view::{cross, dot, Ray, RayFamily};

pub fn is_closed(mesh: &Mesh) -> bool {
    if !mesh.positions.len().is_multiple_of(3)
        || mesh.triangles.is_empty()
        || !mesh.triangles.len().is_multiple_of(3)
    {
        return false;
    }
    let mut edges = Vec::with_capacity(mesh.triangles.len());
    for tri in mesh.triangles.as_chunks::<3>().0 {
        if tri.iter().any(|&i| i as usize >= mesh.positions.len() / 3)
            || tri[0] == tri[1]
            || tri[1] == tri[2]
            || tri[2] == tri[0]
        {
            return false;
        }
        let points = tri.map(|i| {
            let n = i as usize * 3;
            [
                mesh.positions[n],
                mesh.positions[n + 1],
                mesh.positions[n + 2],
            ]
        });
        if points.iter().flatten().any(|v| !v.is_finite()) {
            return false;
        }
        let normal = cross(
            std::array::from_fn(|i| points[1][i] - points[0][i]),
            std::array::from_fn(|i| points[2][i] - points[0][i]),
        );
        let area = dot(normal, normal);
        if !area.is_finite() || area == 0.0 {
            return false;
        }
        for (a, b) in [(tri[0], tri[1]), (tri[1], tri[2]), (tri[2], tri[0])] {
            edges.push((a.min(b), a.max(b)));
        }
    }
    edges.sort_unstable();
    let mut i = 0;
    while i < edges.len() {
        if i + 1 >= edges.len()
            || edges[i] != edges[i + 1]
            || (i + 2 < edges.len() && edges[i] == edges[i + 2])
        {
            return false;
        }
        i += 2;
    }
    true
}

pub fn mesh_bounds(mesh: &Mesh) -> ([f64; 3], [f64; 3]) {
    let mut lo = [f64::INFINITY; 3];
    let mut hi = [f64::NEG_INFINITY; 3];
    for p in mesh.positions.as_chunks::<3>().0 {
        for a in 0..3 {
            lo[a] = lo[a].min(p[a]);
            hi[a] = hi[a].max(p[a]);
        }
    }
    (lo, hi)
}
#[derive(Clone, Copy)]
struct Triangle {
    p: [[f64; 3]; 3],
    q: [[f64; 2]; 3],
}
pub struct MeshView {
    triangles: Vec<Triangle>,
    bins: Vec<Vec<usize>>,
    lo: [f64; 2],
    hi: [f64; 2],
    side: usize,
    basis: [[f64; 3]; 2],
    forward: [f64; 3],
    tool: u32,
    closed: bool,
    listings: usize,
}
fn index(v: f64, lo: f64, hi: f64, side: usize) -> usize {
    if hi <= lo || !v.is_finite() {
        0
    } else {
        (((v - lo) / (hi - lo) * side as f64) as usize).min(side - 1)
    }
}
fn edge(a: [f64; 2], b: [f64; 2], p: [f64; 2]) -> f64 {
    (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
}
fn inclusive(a: [f64; 2], b: [f64; 2]) -> bool {
    b[1] > a[1] || (b[1] == a[1] && b[0] < a[0])
}
impl MeshView {
    pub fn new(
        mesh: &Mesh,
        tool: u32,
        family: &RayFamily,
        window: Option<([f64; 2], [f64; 2])>,
    ) -> Self {
        let f = family.forward;
        let helper = if f[0].abs() < 0.8 {
            [1.0, 0.0, 0.0]
        } else {
            [0.0, 1.0, 0.0]
        };
        let mut u = cross(f, helper);
        let len = dot(u, u).sqrt();
        if len.is_finite() && len > 0.0 {
            u = u.map(|v| v / len);
        } else {
            u = [1.0, 0.0, 0.0];
        }
        let v = cross(f, u);
        let basis = [u, v];
        let mut triangles = Vec::new();
        let mut lo = [f64::INFINITY; 2];
        let mut hi = [f64::NEG_INFINITY; 2];
        for t in mesh.triangles.as_chunks::<3>().0 {
            let mut p = [[0.0; 3]; 3];
            let mut valid = true;
            for i in 0..3 {
                let n = (t[i] as usize).checked_mul(3);
                if let Some(s) = n.and_then(|n| mesh.positions.get(n..n.saturating_add(3))) {
                    p[i].copy_from_slice(s);
                    valid &= s.iter().all(|v| v.is_finite());
                } else {
                    valid = false;
                }
            }
            if !valid {
                continue;
            }
            let q = p.map(|point| [dot(point, u), dot(point, v)]);
            for point in q {
                for a in 0..2 {
                    lo[a] = lo[a].min(point[a]);
                    hi[a] = hi[a].max(point[a]);
                }
            }
            triangles.push(Triangle { p, q });
        }
        if let Some((a, b)) = window {
            if (0..2).all(|i| a[i].is_finite() && b[i].is_finite() && a[i] < b[i]) {
                lo = a;
                hi = b;
            }
        }
        if !lo.iter().chain(hi.iter()).all(|x| x.is_finite()) {
            lo = [0.0; 2];
            hi = [0.0; 2];
        }
        let mut side = ((triangles.len() as f64 / 2.0).sqrt() as usize).clamp(1, 1024);
        let (bins, listings) = loop {
            let mut bins = vec![Vec::new(); side * side];
            let mut count = 0usize;
            let limit = triangles
                .len()
                .saturating_mul(4)
                .saturating_add(side * side);
            'triangles: for (i, t) in triangles.iter().enumerate() {
                let mut a = [f64::INFINITY; 2];
                let mut b = [f64::NEG_INFINITY; 2];
                for q in t.q {
                    for k in 0..2 {
                        a[k] = a[k].min(q[k]);
                        b[k] = b[k].max(q[k]);
                    }
                }
                if (0..2).any(|k| b[k] < lo[k] || a[k] > hi[k]) {
                    continue;
                }
                for y in index(a[1], lo[1], hi[1], side)..=index(b[1], lo[1], hi[1], side) {
                    for x in index(a[0], lo[0], hi[0], side)..=index(b[0], lo[0], hi[0], side) {
                        bins[y * side + x].push(i);
                        count += 1;
                        if count > limit {
                            break 'triangles;
                        }
                    }
                }
            }
            if count
                <= triangles
                    .len()
                    .saturating_mul(4)
                    .saturating_add(side * side)
                || side == 1
            {
                break (bins, count);
            }
            side = (side / 2).max(1);
        };
        Self {
            triangles,
            bins,
            lo,
            hi,
            side,
            basis,
            forward: f,
            tool,
            closed: is_closed(mesh),
            listings,
        }
    }
    /// The triangles one ray tests: the bin the ray falls in.
    fn bin(&self, ray: &Ray) -> Option<([f64; 2], &[usize])> {
        let q = [
            dot(ray.origin, self.basis[0]),
            dot(ray.origin, self.basis[1]),
        ];
        if (0..2).any(|i| !q[i].is_finite() || q[i] < self.lo[i] || q[i] > self.hi[i]) {
            return None;
        }
        let bin = index(q[1], self.lo[1], self.hi[1], self.side) * self.side
            + index(q[0], self.lo[0], self.hi[0], self.side);
        Some((q, &self.bins[bin]))
    }
    pub(crate) fn scan_cost(&self, ray: &Ray) -> usize {
        self.bin(ray).map_or(0, |(_, bin)| bin.len())
    }
    fn hits_impl<const FACETS: bool>(&self, ray: &Ray, scratch: &mut Vec<Boundary>) {
        scratch.clear();
        let Some((q, bin)) = self.bin(ray) else {
            return;
        };
        for &i in bin {
            let t = self.triangles[i];
            let area = edge(t.q[0], t.q[1], t.q[2]);
            if area == 0.0 || !area.is_finite() {
                continue;
            }
            let order = if area > 0.0 { [0, 1, 2] } else { [0, 2, 1] };
            let mut inside = true;
            for j in 0..3 {
                let a = t.q[order[j]];
                let b = t.q[order[(j + 1) % 3]];
                let e = edge(a, b, q);
                if e < 0.0 || (e == 0.0 && !inclusive(a, b)) {
                    inside = false;
                    break;
                }
            }
            if !inside {
                continue;
            }
            let n = cross(
                std::array::from_fn(|k| t.p[1][k] - t.p[0][k]),
                std::array::from_fn(|k| t.p[2][k] - t.p[0][k]),
            );
            let d = dot(n, self.forward);
            if d == 0.0 || !d.is_finite() {
                continue;
            }
            let s = dot(n, std::array::from_fn(|k| t.p[0][k] - ray.origin[k])) / d;
            if s.is_finite() {
                scratch.push(Boundary {
                    s,
                    tool: self.tool,
                    face: if FACETS { i as u32 } else { 0 },
                });
            }
        }
        scratch.sort_by(|a, b| a.s.total_cmp(&b.s));
    }
    fn hits(&self, ray: &Ray, scratch: &mut Vec<Boundary>) {
        self.hits_impl::<false>(ray, scratch);
    }
    pub(crate) fn surface_intervals(
        &self,
        ray: &Ray,
        scratch: &mut Vec<Boundary>,
        out: &mut Intervals,
    ) {
        out.clear();
        if self.closed {
            self.hits_impl::<true>(ray, scratch);
            out.extend_from_slice(&scratch[..scratch.len() / 2 * 2]);
        }
    }
    pub(crate) fn first_surface_hit(&self, ray: &Ray) -> Option<Boundary> {
        let mut scratch = Vec::new();
        self.hits_impl::<true>(ray, &mut scratch);
        scratch.first().copied()
    }
    pub(crate) fn surface(&self, facet: u32) -> Option<(u32, [f64; 3])> {
        let t = self.triangles.get(facet as usize)?;
        let normal = cross(
            std::array::from_fn(|i| t.p[1][i] - t.p[0][i]),
            std::array::from_fn(|i| t.p[2][i] - t.p[0][i]),
        );
        let length = dot(normal, normal).sqrt();
        if !length.is_finite() || length == 0.0 {
            return None;
        }
        Some((0, normal.map(|v| v / length)))
    }
    pub fn intervals(&self, ray: &Ray, scratch: &mut Vec<Boundary>, out: &mut Intervals) {
        out.clear();
        if !self.closed {
            return;
        }
        self.hits(ray, scratch);
        out.extend_from_slice(&scratch[..scratch.len() / 2 * 2]);
    }
    pub fn first_hit(&self, ray: &Ray) -> Option<Boundary> {
        let mut scratch = Vec::new();
        self.hits(ray, &mut scratch);
        scratch.first().copied()
    }
    pub fn average_occupancy(&self) -> f64 {
        self.listings as f64 / self.bins.len() as f64
    }
    pub fn listings(&self) -> usize {
        self.listings
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn cube() -> Mesh {
        Mesh {
            positions: vec![
                0., 0., 0., 1., 0., 0., 1., 1., 0., 0., 1., 0., 0., 0., 1., 1., 0., 1., 1., 1., 1.,
                0., 1., 1.,
            ],
            triangles: vec![
                0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2,
                7, 6, 3, 0, 4, 3, 4, 7,
            ],
        }
    }
    #[test]
    fn mesh_box_analysis_and_open_candidate() {
        use crate::scene::{Body, Loop, Op, Prism, Step, Tool};
        let mut scene =
            crate::scene::parse_scene(include_bytes!("../tests/fixtures/plate-iso.ncs1")).unwrap();
        scene.tolerance = 0.001;
        scene.tools = vec![
            Tool::Mesh(cube()),
            Tool::Prism(Prism {
                o: [0.5, 0., 0.],
                u: [1., 0., 0.],
                v: [0., 1., 0.],
                n: [0., 0., 1.],
                t0: 0.,
                t1: 1.,
                loops: vec![Loop {
                    points: vec![0., 0., 1., 0., 1., 1., 0., 1.],
                    faces: vec![2, 3, 4, u32::MAX],
                }],
            }),
        ];
        scene.bodies = (0..2)
            .map(|tool| Body {
                reference: false,
                analysed: true,
                steps: vec![Step {
                    op: Op::Union,
                    tool,
                }],
            })
            .collect();
        let boxes = crate::lattice::scene_tool_bounds(&scene);
        let (candidates, count) = crate::interference::candidates(&scene, &boxes, 2);
        assert_eq!(count, 1);
        let (report, _) = crate::interference::analyse_pair(&scene, &candidates[0], 0.05, 200_000);
        let volume = report.unwrap().volume;
        assert!((volume - 0.5).abs() <= 0.01, "volume={volume}");
        if let Tool::Mesh(mesh) = &mut scene.tools[0] {
            mesh.triangles.truncate(33);
        }
        let (candidates, count) = crate::interference::candidates(&scene, &boxes, 2);
        assert!(candidates.is_empty());
        assert_eq!(count, 0);
    }
    #[test]
    fn cube_intervals_and_open_mesh() {
        let mut mesh = cube();
        assert!(is_closed(&mesh));
        let family = RayFamily {
            forward: [0., 0., 1.],
        };
        let view = MeshView::new(&mesh, 0, &family, None);
        let ray = Ray {
            origin: [0.5, 0.5, -1.],
        };
        let mut scratch = Vec::new();
        let mut out = Vec::new();
        view.intervals(&ray, &mut scratch, &mut out);
        assert_eq!(out.len(), 2);
        assert!((out[1].s - out[0].s - 1.).abs() < 1e-9);
        assert!(view.listings() <= 4 * 12 + view.bins.len());
        mesh.triangles.truncate(33);
        assert!(!is_closed(&mesh));
        let view = MeshView::new(&mesh, 0, &family, None);
        view.intervals(&ray, &mut scratch, &mut out);
        assert!(out.is_empty());
        assert!(view.first_hit(&ray).is_some());
    }
    #[test]
    fn lattice_crossings_are_even() {
        let view = MeshView::new(
            &cube(),
            0,
            &RayFamily {
                forward: [0., 0., 1.],
            },
            None,
        );
        let mut scratch = Vec::new();
        for y in 0..100 {
            for x in 0..100 {
                let ray = Ray {
                    origin: [x as f64 / 99., y as f64 / 99., -1.],
                };
                view.hits(&ray, &mut scratch);
                assert_eq!(scratch.len() % 2, 0, "x={x} y={y}");
            }
        }
    }
    #[test]
    fn sphere_chord_matches_tessellation() {
        let mut positions = vec![0., -1., 0.];
        let mut triangles = Vec::new();
        let (c, s) = (0.9951847266721969, 0.0980171403295606);
        for row in 1..32 {
            let y = -1. + row as f64 / 16.;
            let radius = (1. - y * y).sqrt();
            let (mut x, mut z) = (1., 0.);
            for _ in 0..64 {
                positions.extend_from_slice(&[radius * x, y, radius * z]);
                (x, z) = (x * c - z * s, x * s + z * c);
            }
        }
        let top = positions.len() as u32 / 3;
        positions.extend_from_slice(&[0., 1., 0.]);
        for col in 0..64u32 {
            let next = (col + 1) % 64;
            triangles.extend_from_slice(&[0, 1 + col, 1 + next]);
            for row in 0..30u32 {
                let a = 1 + row * 64 + col;
                let b = 1 + row * 64 + next;
                let c = a + 64;
                let d = b + 64;
                triangles.extend_from_slice(&[a, c, b, b, c, d]);
            }
            let last = 1 + 30 * 64;
            triangles.extend_from_slice(&[top, last + next, last + col]);
        }
        let mesh = Mesh {
            positions,
            triangles,
        };
        assert!(is_closed(&mesh));
        let view = MeshView::new(
            &mesh,
            0,
            &RayFamily {
                forward: [0., 0., 1.],
            },
            None,
        );
        let mut scratch = Vec::new();
        let mut out = Vec::new();
        let ray = Ray {
            origin: [0.25, 0.125, -2.],
        };
        view.intervals(&ray, &mut scratch, &mut out);
        assert_eq!(out.len(), 2);
        let exact = 2.0_f64 * (1.0_f64 - 0.25 * 0.25 - 0.125 * 0.125).sqrt();
        assert!(((out[1].s - out[0].s) - exact).abs() < 0.02);
        assert!(view.listings() <= 4 * mesh.triangles.len() / 3 + view.bins.len());
    }
    #[test]
    fn facet_surfaces_preserve_analysis_and_open_hits() {
        let family = RayFamily {
            forward: [0., 0., 1.],
        };
        let ray = Ray {
            origin: [0.5, 0.5, -1.],
        };
        let mut mesh = cube();
        let view = MeshView::new(&mesh, 7, &family, None);
        let mut scratch = Vec::new();
        let mut analysis = Vec::new();
        let mut surfaces = Vec::new();
        view.intervals(&ray, &mut scratch, &mut analysis);
        view.surface_intervals(&ray, &mut scratch, &mut surfaces);
        assert_eq!(analysis.len(), 2);
        assert_eq!(surfaces.len(), analysis.len());
        for (a, b) in analysis.iter().zip(&surfaces) {
            assert_eq!(a.s, b.s);
            assert_eq!(a.tool, b.tool);
            assert_eq!(a.face, 0);
            let (face, normal) = view.surface(b.face).unwrap();
            assert_eq!(face, 0);
            assert!(normal[0].abs() < 1e-12 && normal[1].abs() < 1e-12);
            assert!((normal[2].abs() - 1.).abs() < 1e-12);
        }
        assert!(view.surface(u32::MAX).is_none());
        assert!(view.surface(view.triangles.len() as u32).is_none());
        mesh.triangles.truncate(33);
        let view = MeshView::new(&mesh, 7, &family, None);
        view.surface_intervals(&ray, &mut scratch, &mut surfaces);
        assert!(surfaces.is_empty());
        let hit = view.first_surface_hit(&ray).unwrap();
        assert_eq!(hit.s, view.first_hit(&ray).unwrap().s);
        let normal = view.surface(hit.face).unwrap().1;
        assert!((dot(normal, normal).sqrt() - 1.).abs() < 1e-12);
    }
    #[test]
    fn facet_index_tracks_stored_triangles() {
        let mut mesh = cube();
        mesh.triangles.splice(0..0, [u32::MAX, 0, 1]);
        let view = MeshView::new(
            &mesh,
            0,
            &RayFamily {
                forward: [0., 0., 1.],
            },
            None,
        );
        let (face, normal) = view.surface(0).unwrap();
        assert_eq!(face, 0);
        assert_eq!(normal, [0., 0., -1.]);
    }
}
