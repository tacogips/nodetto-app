//! Exact, conservative closure test for meshes with welded contact edges.
use std::collections::{BTreeMap, BTreeSet};

use crate::nmesh::{COORDINATE_LIMIT, UNITS_PER_MILLIMETRE};

type Point = [i128; 3];
type Edge = (usize, usize);
type Use = (usize, i8);
type Plane = [i128; 4];
type Boundary = Vec<(Edge, i8)>;

#[cfg(test)]
thread_local! {
    static FIND_HOPS: std::cell::Cell<u64> = const { std::cell::Cell::new(0) };
}

fn cross(a: Point, b: Point) -> Option<Point> {
    Some([
        a[1].checked_mul(b[2])?
            .checked_sub(a[2].checked_mul(b[1])?)?,
        a[2].checked_mul(b[0])?
            .checked_sub(a[0].checked_mul(b[2])?)?,
        a[0].checked_mul(b[1])?
            .checked_sub(a[1].checked_mul(b[0])?)?,
    ])
}
fn dot(a: Point, b: Point) -> Option<i128> {
    a[0].checked_mul(b[0])?
        .checked_add(a[1].checked_mul(b[1])?)?
        .checked_add(a[2].checked_mul(b[2])?)
}
fn gcd(mut a: i128, mut b: i128) -> Option<i128> {
    a = a.checked_abs()?;
    b = b.checked_abs()?;
    while b != 0 {
        (a, b) = (b, a % b);
    }
    Some(a)
}
fn find(parent: &mut [usize], mut i: usize) -> usize {
    while parent[i] != i {
        #[cfg(test)]
        FIND_HOPS.with(|hops| hops.set(hops.get() + 1));
        parent[i] = parent[parent[i]];
        i = parent[i];
    }
    i
}
fn join(parent: &mut [usize], a: usize, b: usize) {
    let a = find(parent, a);
    let b = find(parent, b);
    parent[a] = b;
}
#[derive(Clone)]
struct Triangle {
    vertices: [usize; 3],
    plane: Plane,
    side: i8,
}
struct Patch {
    plane: Plane,
    side: i8,
    triangles: Vec<usize>,
    boundary: Boundary,
}
struct Shell {
    min: Point,
    max: Point,
    volume: i128,
}

/// Classifies the contact path only; arithmetic failure rejects the mesh.
pub(crate) fn contact_closed(
    vertex_count: usize,
    triangles: &[u32],
    position: impl Fn(usize) -> [f64; 3],
) -> bool {
    contact_checked(vertex_count, triangles, position).unwrap_or(false)
}
fn contact_checked(
    vertex_count: usize,
    indices: &[u32],
    position: impl Fn(usize) -> [f64; 3],
) -> Option<bool> {
    if indices.is_empty() || !indices.len().is_multiple_of(3) {
        return Some(false);
    }
    let mut points = BTreeMap::new();
    for &index in indices {
        let i = usize::try_from(index).ok()?;
        if i >= vertex_count {
            return Some(false);
        }
        if let std::collections::btree_map::Entry::Vacant(entry) = points.entry(i) {
            let values = position(i);
            let mut p = [0_i128; 3];
            for axis in 0..3 {
                let k = (values[axis] * UNITS_PER_MILLIMETRE).round();
                if !k.is_finite() || k.abs() > COORDINATE_LIMIT as f64 {
                    return Some(false);
                }
                let integer = k as i64;
                if ((integer as f64) / UNITS_PER_MILLIMETRE).to_bits() != values[axis].to_bits() {
                    return Some(false);
                }
                p[axis] = i128::from(integer);
            }
            entry.insert(p);
        }
    }
    let mut edges: BTreeMap<Edge, Vec<Use>> = BTreeMap::new();
    let mut vertices = Vec::new();
    for (i, chunk) in indices.as_chunks::<3>().0.iter().enumerate() {
        let v = [chunk[0] as usize, chunk[1] as usize, chunk[2] as usize];
        vertices.push(v);
        for (u, w) in [(v[0], v[1]), (v[1], v[2]), (v[2], v[0])] {
            edges
                .entry((u.min(w), u.max(w)))
                .or_default()
                .push((i, if u < w { 1 } else { -1 }));
        }
    }
    // C1 precedes all plane calculations. Two-use orientation is an eligibility rule.
    for uses in edges.values() {
        if uses.len() % 2 != 0
            || (uses.len() >= 3 && uses.iter().map(|u| i64::from(u.1)).sum::<i64>() != 0)
        {
            return Some(false);
        }
    }
    let mut tris = Vec::new();
    for v in vertices {
        let [a, b, c] = [
            *points.get(&v[0])?,
            *points.get(&v[1])?,
            *points.get(&v[2])?,
        ];
        let mut ab = [0; 3];
        let mut ac = [0; 3];
        for axis in 0..3 {
            ab[axis] = b[axis].checked_sub(a[axis])?;
            ac[axis] = c[axis].checked_sub(a[axis])?;
        }
        let n = cross(ab, ac)?;
        if n == [0; 3] {
            return Some(false);
        }
        let divisor = gcd(gcd(n[0], n[1])?, n[2])?;
        let mut normal = [n[0] / divisor, n[1] / divisor, n[2] / divisor];
        let side = if normal.iter().find(|&&x| x != 0).copied()? > 0 {
            1
        } else {
            -1
        };
        if side == -1 {
            for x in &mut normal {
                *x = x.checked_neg()?;
            }
        }
        let plane = [normal[0], normal[1], normal[2], dot(normal, a)?];
        tris.push(Triangle {
            vertices: v,
            plane,
            side,
        });
    }
    let mut parent: Vec<usize> = (0..tris.len()).collect();
    for uses in edges.values() {
        let mut groups: BTreeMap<(Plane, i8), Vec<Use>> = BTreeMap::new();
        for &u in uses {
            let t = &tris[u.0];
            groups.entry((t.plane, t.side)).or_default().push(u);
        }
        for group in groups.values() {
            if group.len() == 2 && group[0].1 != group[1].1 {
                join(&mut parent, group[0].0, group[1].0);
            }
        }
    }
    let mut patches: Vec<Patch> = Vec::new();
    let mut roots = BTreeMap::new();
    for (i, t) in tris.iter().enumerate() {
        let root = find(&mut parent, i);
        let idx = *roots.entry(root).or_insert_with(|| {
            patches.push(Patch {
                plane: t.plane,
                side: t.side,
                triangles: Vec::new(),
                boundary: Vec::new(),
            });
            patches.len() - 1
        });
        patches[idx].triangles.push(i);
    }
    for (&edge, uses) in &edges {
        let mut groups: BTreeMap<usize, Vec<Use>> = BTreeMap::new();
        for &u in uses {
            let root = find(&mut parent, u.0);
            groups.entry(root).or_default().push(u);
        }
        for (root, group) in groups {
            if group.len() == 2 && group[0].1 != group[1].1 {
                continue;
            }
            let patch = patches.get_mut(*roots.get(&root)?)?;
            for u in group {
                patch.boundary.push((edge, u.1));
            }
        }
    }
    let mut unmatched: BTreeMap<(Plane, i8, Boundary), Vec<usize>> = BTreeMap::new();
    let mut cancelled = vec![false; tris.len()];
    let mut attachment = BTreeSet::new();
    for (i, patch) in patches.iter().enumerate() {
        let mut boundary = patch.boundary.clone();
        boundary.sort_unstable();
        let mut reverse: Boundary = boundary.iter().map(|&(edge, dir)| (edge, -dir)).collect();
        reverse.sort_unstable();
        let key = (patch.plane, -patch.side, reverse);
        let matched = unmatched.get_mut(&key).and_then(|list| {
            if list.is_empty() {
                None
            } else {
                Some(list.remove(0))
            }
        });
        if let Some(other) = matched {
            for &(edge, _) in &boundary {
                if edges.get(&edge)?.len() < 4 {
                    return Some(false);
                }
                attachment.insert(edge);
            }
            for &t in patch.triangles.iter().chain(&patches[other].triangles) {
                cancelled[t] = true;
            }
        } else {
            unmatched
                .entry((patch.plane, patch.side, boundary))
                .or_default()
                .push(i);
        }
    }
    let remaining: BTreeMap<Edge, Vec<Use>> = edges
        .iter()
        .map(|(&edge, uses)| {
            (
                edge,
                uses.iter().copied().filter(|u| !cancelled[u.0]).collect(),
            )
        })
        .collect();
    for edge in attachment {
        let uses = remaining.get(&edge)?;
        if uses.len() != 2 || uses[0].1 == uses[1].1 {
            return Some(false);
        }
    }
    let mut faces = BTreeSet::new();
    for (i, t) in tris.iter().enumerate() {
        if !cancelled[i] {
            let mut face = t.vertices;
            face.sort_unstable();
            if !faces.insert(face) {
                return Some(false);
            }
        }
    }
    parent = (0..tris.len()).collect();
    for uses in remaining.values() {
        if uses.len() == 2 {
            join(&mut parent, uses[0].0, uses[1].0);
        }
    }
    let mut shells: BTreeMap<usize, Shell> = BTreeMap::new();
    for (i, t) in tris.iter().enumerate() {
        if cancelled[i] {
            continue;
        }
        let root = find(&mut parent, i);
        let shell = shells.entry(root).or_insert(Shell {
            min: [i128::MAX; 3],
            max: [i128::MIN; 3],
            volume: 0,
        });
        let [a, b, c] = [
            *points.get(&t.vertices[0])?,
            *points.get(&t.vertices[1])?,
            *points.get(&t.vertices[2])?,
        ];
        for p in [a, b, c] {
            for (axis, value) in p.iter().enumerate() {
                shell.min[axis] = shell.min[axis].min(*value);
                shell.max[axis] = shell.max[axis].max(*value);
            }
        }
        shell.volume = shell.volume.checked_add(dot(a, cross(b, c)?)?)?;
    }
    let mut sign = 0;
    for shell in shells.values() {
        let next = shell.volume.signum();
        if next == 0 || (sign != 0 && sign != next) {
            return Some(false);
        }
        sign = next;
    }
    if sign == 0 {
        return Some(false);
    }
    for uses in remaining.values() {
        if uses.is_empty() || uses.len() == 2 {
            continue;
        }
        let mut groups: BTreeMap<usize, Vec<Use>> = BTreeMap::new();
        for &u in uses {
            groups.entry(find(&mut parent, u.0)).or_default().push(u);
        }
        for group in groups.values() {
            if group.len() != 2 || group[0].1 == group[1].1 {
                return Some(false);
            }
        }
        let ids: Vec<_> = groups.keys().copied().collect();
        for i in 0..ids.len() {
            for j in i + 1..ids.len() {
                let a = shells.get(&ids[i])?;
                let b = shells.get(&ids[j])?;
                if !(0..3).any(|axis| a.max[axis] <= b.min[axis] || b.max[axis] <= a.min[axis]) {
                    return Some(false);
                }
            }
        }
    }
    Some(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[derive(Default)]
    struct Mesh {
        points: Vec<[f64; 3]>,
        indices: Vec<u32>,
    }
    impl Mesh {
        fn vertex(&mut self, p: [f64; 3]) -> u32 {
            if let Some(i) = self.points.iter().position(|v| *v == p) {
                i as u32
            } else {
                self.points.push(p);
                (self.points.len() - 1) as u32
            }
        }
        fn cube(&mut self, min: [f64; 3], max: [f64; 3], crossed: bool, reverse: bool) {
            let [x, y, z] = min;
            let [a, b, c] = max;
            let p = [
                [x, y, z],
                [a, y, z],
                [a, b, z],
                [x, b, z],
                [x, y, c],
                [a, y, c],
                [a, b, c],
                [x, b, c],
            ];
            let ids = p.map(|v| self.vertex(v));
            let faces = [
                [0, 3, 2, 1],
                [4, 5, 6, 7],
                [0, 1, 5, 4],
                [1, 2, 6, 5],
                [2, 3, 7, 6],
                [3, 0, 4, 7],
            ];
            for (face_index, f) in faces.iter().enumerate() {
                let ts = if !crossed && face_index == 5 {
                    [[f[0], f[1], f[3]], [f[1], f[2], f[3]]]
                } else {
                    [[f[0], f[1], f[2]], [f[0], f[2], f[3]]]
                };
                for mut t in ts {
                    if reverse {
                        t.swap(1, 2);
                    }
                    self.indices.extend(t.map(|i| ids[i]));
                }
            }
        }
        fn closed(&self) -> bool {
            contact_closed(self.points.len(), &self.indices, |i| self.points[i])
        }
    }
    fn pair(min: [f64; 3], max: [f64; 3], crossed: bool) -> Mesh {
        let mut m = Mesh::default();
        m.cube([0., 0., 0.], [10., 10., 5.], false, false);
        m.cube(min, max, crossed, false);
        m
    }
    #[test]
    fn strip_contact_is_near_linear() {
        const N: usize = 1024;
        let mut m = Mesh::default();
        let mut rings = Vec::new();
        for x in 0..=N {
            rings.push([
                m.vertex([x as f64, 0., 0.]),
                m.vertex([x as f64, 10., 0.]),
                m.vertex([x as f64, 10., 5.]),
                m.vertex([x as f64, 0., 5.]),
            ]);
        }
        let mut quad = |v: [u32; 4]| {
            m.indices.extend([v[0], v[1], v[2], v[0], v[2], v[3]]);
        };
        let a = rings[0];
        quad([a[1], a[0], a[3], a[2]]);
        for pair in rings.windows(2) {
            let a = pair[0];
            let b = pair[1];
            quad([a[0], b[0], b[3], a[3]]);
            quad([b[1], a[1], a[2], b[2]]);
            quad([a[0], a[1], b[1], b[0]]);
            quad([a[3], b[3], b[2], a[2]]);
        }
        let b = rings[N];
        quad([b[0], b[1], b[2], b[3]]);
        m.cube([N as f64, 10., 0.], [N as f64 + 10., 20., 5.], false, false);
        let edge = (b[1], b[2]);
        let uses: Vec<_> = m
            .indices
            .as_chunks::<3>()
            .0
            .iter()
            .flat_map(|t| [(t[0], t[1]), (t[1], t[2]), (t[2], t[0])])
            .filter(|&(u, v)| (u == edge.0 && v == edge.1) || (u == edge.1 && v == edge.0))
            .collect();
        assert_eq!(uses.len(), 4);
        assert_eq!(uses.iter().filter(|&&(u, _)| u == edge.0).count(), 2);
        FIND_HOPS.with(|hops| hops.set(0));
        assert!(m.closed());
        let hops = FIND_HOPS.with(|hops| hops.get());
        let triangles = m.indices.len() / 3;
        assert!(
            hops <= 64 * triangles as u64,
            "{hops} hops for {triangles} triangles"
        );
    }
    #[test]
    fn edge_contact() {
        assert!(pair([10., 10., 0.], [20., 20., 5.], false).closed());
    }
    #[test]
    fn face_contact() {
        assert!(pair([10., 0., 0.], [20., 10., 5.], false).closed());
    }
    #[test]
    fn crossed_diagonal_contact() {
        assert!(pair([10., 0., 0.], [20., 10., 5.], true).closed());
    }
    #[test]
    fn welded_overlap() {
        assert!(!pair([0., 0., 0.], [6., 6., 5.], false).closed());
    }
    #[test]
    fn coincident_shells() {
        let mut m = Mesh::default();
        m.cube([0., 0., 0.], [1., 1., 1.], false, false);
        m.cube([0., 0., 0.], [1., 1., 1.], false, true);
        m.cube([2., 0., 0.], [3., 1., 1.], false, false);
        assert!(!m.closed());
    }
    #[test]
    fn zero_normal() {
        let mut m = pair([10., 10., 0.], [20., 20., 5.], false);
        let p = m.vertex([30., 0., 0.]);
        let q = m.vertex([31., 0., 0.]);
        let r = m.vertex([32., 0., 0.]);
        m.indices.extend([p, q, r, p, r, q]);
        assert!(!m.closed());
    }
    #[test]
    fn off_grid() {
        let mut m = pair([10., 10., 0.], [20., 20., 5.], false);
        m.points[0][0] += 0.0004;
        assert!(!m.closed());
    }
    #[test]
    fn overflow_scale() {
        let mut m = pair([10., 10., 0.], [20., 20., 5.], false);
        let shift = (COORDINATE_LIMIT as f64 / UNITS_PER_MILLIMETRE) - 20.;
        for p in &mut m.points {
            p[0] += shift;
            p[1] += shift;
            p[2] += shift;
        }
        let _ = m.closed();
    }
}
