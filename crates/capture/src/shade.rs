//! Lighting and discontinuities between neighboring surface samples.

use crate::interval::MERGE_EPS;
use crate::scene::Camera;
use crate::view::dot;

#[derive(Clone, Copy)]
pub(crate) struct Hit {
    pub depth: f64,
    pub body: usize,
    pub tool: u32,
    pub face: u32,
    pub normal: [f64; 3],
}

pub(crate) fn light(camera: &Camera) -> [f64; 3] {
    let direction = std::array::from_fn(|axis| {
        0.8 * camera.forward[axis] + 0.3 * camera.right[axis] - 0.5 * camera.up[axis]
    });
    let length = dot(direction, direction).sqrt();
    direction.map(|coordinate| coordinate / length)
}

pub(crate) fn facing(normal: [f64; 3], forward: [f64; 3]) -> [f64; 3] {
    if dot(normal, forward) > 0.0 {
        normal.map(|coordinate| -coordinate)
    } else {
        normal
    }
}

pub(crate) fn lit_colour(body: [u8; 3], normal: [f64; 3], light: [f64; 3]) -> [u8; 3] {
    let factor = 0.42 + 0.58 * (-dot(normal, light)).clamp(0.0, 1.0);
    body.map(|channel| (f64::from(channel) * factor).round() as u8)
}

pub(crate) fn reference_mix(behind: [u8; 3], shade: [u8; 3], opacity: u8) -> [u8; 3] {
    std::array::from_fn(|i| {
        let a = u32::from(behind[i]);
        let b = u32::from(shade[i]);
        ((a * (255 - u32::from(opacity)) + b * u32::from(opacity) + 127) / 255) as u8
    })
}

pub(crate) fn is_edge(
    a: Option<Hit>,
    b: Option<Hit>,
    lateral: [f64; 3],
    forward: [f64; 3],
) -> bool {
    let (Some(a), Some(b)) = (a, b) else {
        return a.is_some() != b.is_some();
    };
    if a.body != b.body {
        return true;
    }

    let delta = b.depth - a.depth;
    let chord = std::array::from_fn(|i| lateral[i] + forward[i] * delta);
    let normal_dot = dot(a.normal, b.normal);
    let along_a = dot(chord, a.normal);
    let along_b = dot(chord, b.normal);
    if (a.tool, a.face) != (b.tool, b.face) {
        // Coincident Boolean caps can inherit different ids from ray to ray.
        // Keep actual steps and creases, including contacts between bodies.
        let normal_delta = std::array::from_fn(|i| a.normal[i] - b.normal[i]);
        return dot(normal_delta, normal_delta) > 1e-18
            || along_a.abs() > MERGE_EPS
            || along_b.abs() > MERGE_EPS;
    }

    let threshold = 0.25 * dot(chord, chord);
    normal_dot < 0.866_025_403_784_438_6
        || along_a * along_a > threshold
        || along_b * along_b > threshold
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn edges_follow_creases_and_chords_instead_of_absolute_depth() {
        let a = Hit {
            depth: 0.0,
            body: 0,
            tool: 0,
            face: u32::MAX,
            normal: [0.0, 0.0, -1.0],
        };
        let sideways = [1.0, 0.0, 0.0];
        let forward = [0.0, 0.0, 1.0];
        for (normal, expected) in [
            (
                [0.0, 0.484_809_620_246_337_06, -0.874_619_707_139_395_7],
                false,
            ),
            (
                [0.0, 0.515_038_074_910_054_2, -0.857_167_300_702_112_3],
                true,
            ),
        ] {
            let b = Hit { normal, ..a };
            assert_eq!(is_edge(Some(a), Some(b), sideways, forward), expected);
        }
        let b = Hit { depth: 2.0, ..a };
        assert!(is_edge(Some(a), Some(b), sideways, forward));

        let a = Hit {
            normal: [0.995_037_190_209_989_2, 0.0, -0.099_503_719_020_998_92],
            ..a
        };
        let b = Hit { depth: 10.0, ..a };
        assert!(!is_edge(Some(a), Some(b), sideways, forward));
        let b = Hit {
            tool: 1,
            depth: 10.0 + 1e-10,
            ..a
        };
        assert!(!is_edge(Some(a), Some(b), sideways, forward));
        let b = Hit {
            depth: 10.0 + 1e-4,
            ..b
        };
        assert!(is_edge(Some(a), Some(b), sideways, forward));
    }
}
