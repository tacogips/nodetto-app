//! Projected triangle grids for parallel mesh rays.
use crate::interval::{Boundary, Intervals};
use crate::scene::Mesh;
use crate::view::{cross, dot, Ray, RayFamily};
use std::sync::atomic::{AtomicU64, Ordering};

#[doc(hidden)]
pub static CLOSURE_EVALUATIONS: AtomicU64 = AtomicU64::new(0);

pub fn is_closed(mesh: &Mesh) -> bool {
    mesh.positions.len().is_multiple_of(3)
        && closed_by(mesh.positions.len() / 3, &mesh.triangles, |i| {
            let n = i * 3;
            [
                mesh.positions[n],
                mesh.positions[n + 1],
                mesh.positions[n + 2],
            ]
        })
}

pub fn closed_by(
    vertex_count: usize,
    triangles: &[u32],
    position: impl Fn(usize) -> [f64; 3],
) -> bool {
    CLOSURE_EVALUATIONS.fetch_add(1, Ordering::Relaxed);
    if triangles.is_empty() || !triangles.len().is_multiple_of(3) {
        return false;
    }
    let mut edges = Vec::with_capacity(triangles.len());
    for tri in triangles.as_chunks::<3>().0 {
        if tri.iter().any(|&i| i as usize >= vertex_count)
            || tri[0] == tri[1]
            || tri[1] == tri[2]
            || tri[2] == tri[0]
        {
            return false;
        }
        let points = tri.map(|i| position(i as usize));
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
        if i + 1 >= edges.len() || edges[i] != edges[i + 1] {
            return false;
        }
        if i + 2 < edges.len() && edges[i] == edges[i + 2] {
            return crate::mesh_contact::contact_closed(vertex_count, triangles, &position);
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
/// One projected mesh. Corners are shared through vertex indices and the
/// bins are one flat list: a view costs about 40 bytes per triangle.
pub struct MeshView {
    /// Vertex positions and their projection onto the view plane.
    points: Vec<[f64; 3]>,
    projected: Vec<[f64; 2]>,
    /// The valid triangles; a facet number indexes this list.
    triangles: Vec<[u32; 3]>,
    /// Bin `b` lists `items[starts[b]..starts[b + 1]]`, in triangle order.
    starts: Vec<u32>,
    items: Vec<u32>,
    lo: [f64; 2],
    hi: [f64; 2],
    side: usize,
    basis: [[f64; 3]; 2],
    forward: [f64; 3],
    tool: u32,
    closed: bool,
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
        Self::with_closure(mesh, tool, family, window, is_closed(mesh))
    }
    pub(crate) fn with_closure(
        mesh: &Mesh,
        tool: u32,
        family: &RayFamily,
        window: Option<([f64; 2], [f64; 2])>,
        closed: bool,
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
        let points = mesh.positions.as_chunks::<3>().0.to_vec();
        let projected: Vec<_> = points
            .iter()
            .map(|&point| [dot(point, u), dot(point, v)])
            .collect();
        let finite = |i: u32| {
            points
                .get(i as usize)
                .is_some_and(|point| point.iter().all(|v| v.is_finite()))
        };
        let triangles: Vec<[u32; 3]> = mesh
            .triangles
            .as_chunks::<3>()
            .0
            .iter()
            .copied()
            .filter(|t| t.iter().all(|&i| finite(i)))
            .collect();
        let mut lo = [f64::INFINITY; 2];
        let mut hi = [f64::NEG_INFINITY; 2];
        for &i in triangles.iter().flatten() {
            for a in 0..2 {
                lo[a] = lo[a].min(projected[i as usize][a]);
                hi[a] = hi[a].max(projected[i as usize][a]);
            }
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
        // The bins each triangle's projected box covers, as (x range, y range).
        let cover = |t: &[u32; 3], side: usize| {
            let mut a = [f64::INFINITY; 2];
            let mut b = [f64::NEG_INFINITY; 2];
            for &i in t {
                for k in 0..2 {
                    a[k] = a[k].min(projected[i as usize][k]);
                    b[k] = b[k].max(projected[i as usize][k]);
                }
            }
            (0..2).all(|k| b[k] >= lo[k] && a[k] <= hi[k]).then(|| {
                let range =
                    |k: usize| index(a[k], lo[k], hi[k], side)..=index(b[k], lo[k], hi[k], side);
                (range(0), range(1))
            })
        };
        let mut side = ((triangles.len() as f64 / 2.0).sqrt() as usize).clamp(1, 1024);
        // Halve the grid until the listings fit the limit, then fill the
        // bins in two passes: count each bin, then place the triangles.
        let mut starts = loop {
            let limit = triangles
                .len()
                .saturating_mul(4)
                .saturating_add(side * side);
            let mut counts = vec![0u32; side * side + 1];
            let mut total = 0usize;
            'triangles: for t in &triangles {
                let Some((xs, ys)) = cover(t, side) else {
                    continue;
                };
                for y in ys {
                    for x in xs.clone() {
                        counts[y * side + x + 1] += 1;
                        total += 1;
                        if total > limit {
                            break 'triangles;
                        }
                    }
                }
            }
            if total <= limit || side == 1 {
                break counts;
            }
            side = (side / 2).max(1);
        };
        for bin in 1..starts.len() {
            starts[bin] += starts[bin - 1];
        }
        let mut items = vec![0u32; starts[side * side] as usize];
        let mut next = starts.clone();
        for (i, t) in triangles.iter().enumerate() {
            let Some((xs, ys)) = cover(t, side) else {
                continue;
            };
            for y in ys {
                for x in xs.clone() {
                    let slot = &mut next[y * side + x];
                    items[*slot as usize] = i as u32;
                    *slot += 1;
                }
            }
        }
        Self {
            points,
            projected,
            triangles,
            starts,
            items,
            lo,
            hi,
            side,
            basis: [u, v],
            forward: f,
            tool,
            closed,
        }
    }
    /// The triangles one ray tests: the bin the ray falls in.
    fn bin(&self, ray: &Ray) -> Option<([f64; 2], &[u32])> {
        let q = [
            dot(ray.origin, self.basis[0]),
            dot(ray.origin, self.basis[1]),
        ];
        if (0..2).any(|i| !q[i].is_finite() || q[i] < self.lo[i] || q[i] > self.hi[i]) {
            return None;
        }
        let bin = index(q[1], self.lo[1], self.hi[1], self.side) * self.side
            + index(q[0], self.lo[0], self.hi[0], self.side);
        let listed = self.starts[bin] as usize..self.starts[bin + 1] as usize;
        Some((q, &self.items[listed]))
    }
    pub(crate) fn scan_cost(&self, ray: &Ray) -> usize {
        self.bin(ray).map_or(0, |(_, bin)| bin.len())
    }
    fn facet_depth(&self, i: u32, q: [f64; 2], ray: &Ray) -> Option<f64> {
        let corners = self.triangles[i as usize].map(|vertex| vertex as usize);
        let tq = corners.map(|vertex| self.projected[vertex]);
        let area = edge(tq[0], tq[1], tq[2]);
        if area == 0.0 || !area.is_finite() {
            return None;
        }
        let order = if area > 0.0 { [0, 1, 2] } else { [0, 2, 1] };
        let mut inside = true;
        for j in 0..3 {
            let a = tq[order[j]];
            let b = tq[order[(j + 1) % 3]];
            let e = edge(a, b, q);
            if e < 0.0 || (e == 0.0 && !inclusive(a, b)) {
                inside = false;
                break;
            }
        }
        if !inside {
            return None;
        }
        self.depth(corners, ray)
    }
    fn depth(&self, corners: [usize; 3], ray: &Ray) -> Option<f64> {
        let p = corners.map(|vertex| self.points[vertex]);
        let n = cross(
            std::array::from_fn(|k| p[1][k] - p[0][k]),
            std::array::from_fn(|k| p[2][k] - p[0][k]),
        );
        let d = dot(n, self.forward);
        if d == 0.0 || !d.is_finite() {
            return None;
        }
        let s = dot(n, std::array::from_fn(|k| p[0][k] - ray.origin[k])) / d;
        s.is_finite().then_some(s)
    }
    fn edge_band(&self, a: usize, b: usize, q: [f64; 2]) -> (f64, f64) {
        let c0 = a.min(b);
        let c1 = a.max(b);
        let p = self.projected[c0];
        let r = self.projected[c1];
        let value = edge(p, r, q);
        let scale = p[0].abs() + p[1].abs() + r[0].abs() + r[1].abs() + q[0].abs() + q[1].abs();
        let err = 8.0 * f64::EPSILON * ((r[0] - p[0]).abs() + (r[1] - p[1]).abs()) * scale;
        (if a == c0 { value } else { -value }, err)
    }
    fn volume_contains(&self, i: u32, q: [f64; 2]) -> bool {
        let corners = self.triangles[i as usize].map(|v| v as usize);
        let p = corners.map(|v| self.projected[v]);
        let area = edge(p[0], p[1], p[2]);
        if area == 0.0 || !area.is_finite() {
            return false;
        }
        let order = if area > 0.0 { [0, 1, 2] } else { [0, 2, 1] };
        for j in 0..3 {
            let a = corners[order[j]];
            let b = corners[order[(j + 1) % 3]];
            let (e, err) = self.edge_band(a, b, q);
            if e < -err {
                return false;
            }
            if e <= err {
                let dx = self.projected[b][0] - self.projected[a][0];
                let dy = self.projected[b][1] - self.projected[a][1];
                let gradient =
                    std::array::from_fn(|k| -dy * self.basis[0][k] + dx * self.basis[1][k]);
                if !crate::prism::increases_in_world(gradient) {
                    return false;
                }
            }
        }
        true
    }
    fn near_tie(&self, i: u32, q: [f64; 2]) -> bool {
        let corners = self.triangles[i as usize].map(|v| v as usize);
        let p = corners.map(|v| self.projected[v]);
        let area = edge(p[0], p[1], p[2]);
        if area == 0.0 || !area.is_finite() {
            return false;
        }
        let order = if area > 0.0 { [0, 1, 2] } else { [0, 2, 1] };
        (0..3).any(|j| {
            let a = corners[order[j]];
            let b = corners[order[(j + 1) % 3]];
            let (_, err) = self.edge_band(a, b, q);
            edge(self.projected[a], self.projected[b], q).abs() <= err
        })
    }
    fn hits_impl<const FACETS: bool>(&self, ray: &Ray, scratch: &mut Vec<Boundary>) {
        scratch.clear();
        let Some((q, bin)) = self.bin(ray) else {
            return;
        };
        for &i in bin {
            let depth = if FACETS {
                self.facet_depth(i, q, ray)
            } else if self.volume_contains(i, q) {
                self.depth(self.triangles[i as usize].map(|v| v as usize), ray)
            } else {
                None
            };
            if let Some(s) = depth {
                scratch.push(Boundary {
                    s,
                    tool: self.tool,
                    face: if FACETS { i } else { 0 },
                });
            }
        }
        scratch.sort_by(|a, b| a.s.total_cmp(&b.s));
    }
    fn hits(&self, ray: &Ray, scratch: &mut Vec<Boundary>) {
        self.hits_impl::<false>(ray, scratch);
    }
    /// Flag near-ties where facet and volume ownership differ.
    pub(crate) fn surface_intervals(
        &self,
        ray: &Ray,
        scratch: &mut Vec<Boundary>,
        out: &mut Intervals,
    ) -> bool {
        out.clear();
        if self.closed {
            self.hits_impl::<true>(ray, scratch);
            out.extend_from_slice(&scratch[..scratch.len() / 2 * 2]);
            if let Some((q, bin)) = self.bin(ray) {
                return bin.iter().any(|&i| {
                    self.near_tie(i, q)
                        && self.volume_contains(i, q) != self.facet_depth(i, q, ray).is_some()
                });
            }
        }
        false
    }
    pub(crate) fn first_surface_hit(&self, ray: &Ray) -> Option<Boundary> {
        let (q, bin) = self.bin(ray)?;
        let mut best: Option<Boundary> = None;
        for &i in bin {
            if let Some(s) = self.facet_depth(i, q, ray) {
                if best.as_ref().is_none_or(|hit| s.total_cmp(&hit.s).is_lt()) {
                    best = Some(Boundary {
                        s,
                        tool: self.tool,
                        face: i,
                    });
                }
            }
        }
        best
    }
    pub(crate) fn surface(&self, facet: u32) -> Option<(u32, [f64; 3])> {
        let p = self
            .triangles
            .get(facet as usize)?
            .map(|vertex| self.points[vertex as usize]);
        let normal = cross(
            std::array::from_fn(|i| p[1][i] - p[0][i]),
            std::array::from_fn(|i| p[2][i] - p[0][i]),
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
        self.listings() as f64 / self.bin_count() as f64
    }
    pub fn listings(&self) -> usize {
        self.items.len()
    }
    pub fn bin_count(&self) -> usize {
        self.side * self.side
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
    fn cube_surface_and_volume_casts_differ_only_at_ownership_ties() {
        let view = MeshView::new(
            &cube(),
            0,
            &RayFamily {
                forward: [0., 0., 1.],
            },
            None,
        );
        for [x, y] in [[0., 0.], [0.25, 0.25], [0.5, 0.5], [0.75, 0.25], [1.5, 0.5]] {
            let ray = Ray {
                origin: [x, y, -1.],
            };
            let mut scratch = Vec::new();
            let mut surface = Vec::new();
            let mut volume = Vec::new();
            let sensitive = view.surface_intervals(&ray, &mut scratch, &mut surface);
            view.intervals(&ray, &mut scratch, &mut volume);
            if x == 0.0 && y == 0.0 {
                assert!(sensitive);
                assert!(surface.is_empty());
                assert_eq!(
                    volume.iter().map(|b| b.s).collect::<Vec<_>>(),
                    vec![1.0, 2.0]
                );
                continue;
            }
            assert!(!sensitive);
            assert_eq!(
                surface.iter().map(|b| b.s).collect::<Vec<_>>(),
                volume.iter().map(|b| b.s).collect::<Vec<_>>()
            );
        }
    }
    #[test]
    fn contact_plane_rays_follow_prism_ownership() {
        for (forward, y, back) in [([0., -1., 0.], 3., true), ([0., 1., 0.], -2., false)] {
            for lower in [true, false] {
                let mut mesh = cube();
                if lower {
                    for p in mesh.positions.as_chunks_mut::<3>().0 {
                        p[2] -= 1.;
                    }
                }
                let view = MeshView::new(&mesh, 0, &RayFamily { forward }, None);
                let ray = Ray {
                    origin: [0.25, y, 0.],
                };
                let mut scratch = Vec::new();
                let mut surface = Vec::new();
                let mut volume = Vec::new();
                let sensitive = view.surface_intervals(&ray, &mut scratch, &mut surface);
                view.intervals(&ray, &mut scratch, &mut volume);
                assert_eq!(sensitive, back);
                assert_eq!(surface.len(), if lower == back { 2 } else { 0 });
                assert_eq!(volume.len(), if lower { 0 } else { 2 });
                if !lower {
                    assert!((volume[1].s - volume[0].s - 1.).abs() < 1e-12);
                }
            }
        }
    }
    #[test]
    fn volume_ties_are_watertight_for_oblique_rays() {
        let f = [1. / 14_f64.sqrt(), 2. / 14_f64.sqrt(), 3. / 14_f64.sqrt()];
        let view = MeshView::new(&cube(), 0, &RayFamily { forward: f }, None);
        let diagonal = [1., 1., 0.];
        let mut normal = cross(f, diagonal);
        let length = dot(normal, normal).sqrt();
        normal = normal.map(|v| v / length);
        let mut points = Vec::new();
        for k in -4..=4 {
            points.push(([0.5, 0.5, 0.], k as f64 * 1e-15, true));
        }
        for p in [
            [0., 0., 0.],
            [1., 0., 0.],
            [1., 1., 0.],
            [0., 1., 0.],
            [0., 0., 1.],
            [1., 0., 1.],
            [1., 1., 1.],
            [0., 1., 1.],
        ] {
            points.push((p, 0., false));
        }
        for (p, offset, interior) in points {
            let ray = Ray {
                origin: std::array::from_fn(|i| p[i] + offset * normal[i] - f[i] * 2.),
            };
            let mut hits = Vec::new();
            view.hits(&ray, &mut hits);
            assert_eq!(hits.len() % 2, 0);
            if interior {
                assert_eq!(hits.len(), 2);
            }
            if hits.len() == 2 {
                let enter = (0..3)
                    .map(|i| -ray.origin[i] / f[i])
                    .fold(f64::NEG_INFINITY, f64::max);
                let exit = (0..3)
                    .map(|i| (1. - ray.origin[i]) / f[i])
                    .fold(f64::INFINITY, f64::min);
                assert!((hits[0].s - enter).abs() < 1e-12);
                assert!((hits[1].s - exit).abs() < 1e-12);
            }
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
        assert!(view.listings() <= 4 * 12 + view.bin_count());
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
        assert!(view.listings() <= 4 * mesh.triangles.len() / 3 + view.bin_count());
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
    #[test]
    fn nearest_surface_matches_sorted_oracle() {
        let family = RayFamily {
            forward: [0., 0., 1.],
        };
        let square = Mesh {
            positions: vec![-2., -2., 0., 2., -2., 0., 2., 2., 0., -2., 2., 0.],
            triangles: vec![0, 1, 2, 0, 2, 3],
        };
        let view = MeshView::new(&square, 7, &family, None);
        for x in -5..=5 {
            for y in -5..=5 {
                let ray = Ray {
                    origin: [f64::from(x) / 2., f64::from(y) / 2., -1.],
                };
                let mut hits = Vec::new();
                view.hits_impl::<true>(&ray, &mut hits);
                let encode = |hit: Boundary| (hit.s.to_bits(), hit.tool, hit.face);
                assert_eq!(
                    view.first_surface_hit(&ray).map(encode),
                    hits.first().copied().map(encode)
                );
            }
        }
        let zero_mesh = Mesh {
            positions: vec![
                -2., -2., 0., 2., -2., 0., 0., 2., 0., -2., -2., 0., 2., -2., 0., 0., 2., 0.,
            ],
            triangles: vec![0, 1, 2, 4, 3, 5],
        };
        let zero_view = MeshView::new(&zero_mesh, 7, &family, None);
        let zero_ray = Ray {
            origin: [0., 0., 0.],
        };
        let mut zero_hits = Vec::new();
        zero_view.hits_impl::<true>(&zero_ray, &mut zero_hits);
        assert_eq!(
            zero_hits
                .iter()
                .map(|hit| hit.s.to_bits())
                .collect::<Vec<_>>(),
            vec![(-0.0_f64).to_bits(), 0.0_f64.to_bits()]
        );
        let hit = zero_view.first_surface_hit(&zero_ray).unwrap();
        assert_eq!(
            (hit.s.to_bits(), hit.tool, hit.face),
            (
                zero_hits[0].s.to_bits(),
                zero_hits[0].tool,
                zero_hits[0].face
            )
        );
        for depths in [[0., 1.], [0., 0.], [-0., 0.], [0., -0.]] {
            for reverse in [false, true] {
                let mesh = Mesh {
                    positions: vec![
                        -2., -2., depths[0], 2., -2., depths[0], 0., 2., depths[0], -2., -2.,
                        depths[1], 2., -2., depths[1], 0., 2., depths[1],
                    ],
                    triangles: if reverse {
                        vec![3, 4, 5, 0, 1, 2]
                    } else {
                        vec![0, 1, 2, 3, 4, 5]
                    },
                };
                let view = MeshView::new(&mesh, 7, &family, None);
                for x in -4..=4 {
                    for y in -4..=4 {
                        let ray = Ray {
                            origin: [f64::from(x) / 2., f64::from(y) / 2., 0.],
                        };
                        let mut hits = Vec::new();
                        view.hits_impl::<true>(&ray, &mut hits);
                        let encode = |hit: Boundary| (hit.s.to_bits(), hit.tool, hit.face);
                        assert_eq!(
                            view.first_surface_hit(&ray).map(encode),
                            hits.first().copied().map(encode)
                        );
                    }
                }
            }
        }
    }
}
