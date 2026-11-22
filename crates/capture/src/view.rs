//! Parallel rays parametrised by their origin and shared direction.

pub struct RayFamily {
    pub forward: [f64; 3],
}

pub struct Ray {
    pub origin: [f64; 3],
}

pub(crate) fn dot(a: [f64; 3], b: [f64; 3]) -> f64 {
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
