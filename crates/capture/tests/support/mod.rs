use nodetto_capture::scene::{Body, Camera, Loop, Op, Prism, Step, Tool};

pub fn camera(forward: [f64; 3], centre: [f64; 3], mm_per_pixel: f64) -> Camera {
    let forward = unit(forward);
    let up_hint = if forward[2].abs() > 0.99 {
        [0.0, 1.0, 0.0]
    } else {
        [0.0, 0.0, 1.0]
    };
    let right = unit(cross(forward, up_hint));
    let up = cross(right, forward);
    Camera {
        right,
        up,
        forward,
        centre,
        mm_per_pixel,
    }
}

pub fn project(camera: &Camera, width: u32, height: u32, point: [f64; 3]) -> (usize, usize) {
    let offset = std::array::from_fn(|i| point[i] - camera.centre[i]);
    let x = f64::from(width) / 2.0 + dot(offset, camera.right) / camera.mm_per_pixel;
    let y = f64::from(height) / 2.0 - dot(offset, camera.up) / camera.mm_per_pixel;
    assert!((0.0..f64::from(width)).contains(&x) && (0.0..f64::from(height)).contains(&y));
    (x as usize, y as usize)
}

pub fn pixel(rgb: &[u8], width: u32, (x, y): (usize, usize)) -> [u8; 3] {
    let i = (y * width as usize + x) * 3;
    rgb[i..i + 3].try_into().unwrap()
}

pub fn digest(rgb: &[u8]) -> u64 {
    rgb.iter().fold(0xcbf2_9ce4_8422_2325, |hash, &byte| {
        (hash ^ u64::from(byte)).wrapping_mul(0x100_0000_01b3)
    })
}

pub fn box_prism(o: [f64; 3], width: f64, depth: f64, height: f64) -> Tool {
    Tool::Prism(Prism {
        o,
        u: [1.0, 0.0, 0.0],
        v: [0.0, 1.0, 0.0],
        n: [0.0, 0.0, 1.0],
        t0: 0.0,
        t1: height,
        loops: vec![Loop {
            points: vec![0.0, 0.0, width, 0.0, width, depth, 0.0, depth],
            faces: vec![2, 3, 4, u32::MAX],
        }],
    })
}

pub fn body(steps: &[(Op, u32)]) -> Body {
    Body {
        reference: false,
        analysed: false,
        steps: steps.iter().map(|&(op, tool)| Step { op, tool }).collect(),
    }
}

pub fn dot(a: [f64; 3], b: [f64; 3]) -> f64 {
    a.into_iter().zip(b).map(|(a, b)| a * b).sum()
}

pub fn unit(v: [f64; 3]) -> [f64; 3] {
    let norm = dot(v, v).sqrt();
    v.map(|x| x / norm)
}

fn cross(a: [f64; 3], b: [f64; 3]) -> [f64; 3] {
    [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}
