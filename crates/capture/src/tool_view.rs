//! Shared axis-specific tool views for interference analysis.
use crate::interval::{Boundary, Intervals};
use crate::lattice::{empty_bounds, extend, valid_bounds, Bounds};
use crate::mesh::{is_closed, mesh_bounds, MeshView};
use crate::prism::PrismView;
use crate::scene::Tool;
use crate::view::{Ray, RayFamily};
use std::sync::OnceLock;

#[allow(clippy::large_enum_variant)]
pub enum ToolView {
    Prism(PrismView),
    Mesh(MeshView),
}
impl ToolView {
    pub fn new(tool: &Tool, index: u32, family: &RayFamily) -> Self {
        match tool {
            Tool::Prism(prism) => Self::Prism(PrismView::new(prism, index, family)),
            Tool::Mesh(mesh) => Self::Mesh(MeshView::new(mesh, index, family, None)),
        }
    }
    pub(crate) fn picture(
        tool: &Tool,
        index: u32,
        family: &RayFamily,
        window: Option<([f64; 2], [f64; 2])>,
    ) -> Self {
        match tool {
            Tool::Prism(prism) => Self::Prism(PrismView::new(prism, index, family)),
            Tool::Mesh(mesh) => Self::Mesh(MeshView::new(mesh, index, family, window)),
        }
    }
    pub(crate) fn surface_intervals(
        &self,
        ray: &Ray,
        scratch: &mut Vec<Boundary>,
        out: &mut Intervals,
    ) {
        match self {
            Self::Prism(view) => view.surface_intervals(ray, scratch, out),
            Self::Mesh(view) => view.surface_intervals(ray, scratch, out),
        }
    }
    /// Edges or triangles one ray tests in this view.
    pub(crate) fn scan_cost(&self, ray: &Ray) -> usize {
        match self {
            Self::Prism(view) => view.scan_cost(ray),
            Self::Mesh(view) => view.scan_cost(ray),
        }
    }
    pub(crate) fn surface(&self, facet: u32) -> Option<(u32, [f64; 3])> {
        match self {
            Self::Prism(view) => view.surface(facet),
            Self::Mesh(view) => view.surface(facet),
        }
    }
    pub(crate) fn first_surface_hit(&self, ray: &Ray) -> Option<Boundary> {
        match self {
            Self::Prism(_) => None,
            Self::Mesh(view) => view.first_surface_hit(ray),
        }
    }
    pub fn intervals(&self, ray: &Ray, scratch: &mut Vec<Boundary>, out: &mut Intervals) {
        match self {
            Self::Prism(view) => view.intervals(ray, scratch, out),
            Self::Mesh(view) => view.intervals(ray, scratch, out),
        }
    }
    pub fn average_occupancy(&self) -> f64 {
        match self {
            Self::Prism(view) => view.average_occupancy(),
            Self::Mesh(view) => view.average_occupancy(),
        }
    }
}
pub fn is_solid(tool: &Tool) -> bool {
    match tool {
        Tool::Prism(_) => true,
        Tool::Mesh(mesh) => is_closed(mesh),
    }
}
pub fn tool_bounds(tool: &Tool) -> Option<Bounds> {
    if let Tool::Mesh(mesh) = tool {
        let bounds = mesh_bounds(mesh);
        return valid_bounds(bounds).then_some(bounds);
    }
    let mut bounds = empty_bounds();
    for item in tool_loops(tool) {
        extend(&mut bounds, item);
    }
    valid_bounds(bounds).then_some(bounds)
}
pub fn tool_loops(tool: &Tool) -> Vec<Bounds> {
    let Tool::Prism(prism) = tool else {
        return Vec::new();
    };
    if !crate::prism::orthonormal([prism.u, prism.v, prism.n]) || prism.t0 == prism.t1 {
        return Vec::new();
    }
    prism
        .loops
        .iter()
        .filter_map(|profile| {
            let (points, remainder) = profile.points.as_chunks::<2>();
            if !remainder.is_empty() || points.len() < 3 || points.len() != profile.faces.len() {
                return None;
            }
            let mut bounds = empty_bounds();
            for &[x, y] in points {
                for axis in 0..3 {
                    let base = prism.o[axis] + prism.u[axis] * x + prism.v[axis] * y;
                    let a = base + prism.n[axis] * prism.t0;
                    let b = base + prism.n[axis] * prism.t1;
                    bounds.0[axis] = bounds.0[axis].min(a.min(b));
                    bounds.1[axis] = bounds.1[axis].max(a.max(b));
                }
            }
            valid_bounds(bounds).then_some(bounds)
        })
        .collect()
}
pub(crate) struct ViewCache(Vec<[OnceLock<ToolView>; 3]>);
impl ViewCache {
    pub fn new(count: usize) -> Self {
        Self(
            (0..count)
                .map(|_| std::array::from_fn(|_| OnceLock::new()))
                .collect(),
        )
    }
    pub fn get(&self, tool: &Tool, index: usize, axis: usize) -> &ToolView {
        self.0[index][axis].get_or_init(|| {
            let mut forward = [0.0; 3];
            forward[axis] = 1.0;
            ToolView::new(tool, index as u32, &RayFamily { forward })
        })
    }
}
