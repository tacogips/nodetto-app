//! Reader for the little-endian NCS1 capture scene.

use crate::CaptureError;

const MAX_MAGNITUDE: f64 = 1e7;
const MAX_RECORDS: usize = 20_000;
const MAX_POINTS: usize = 4_000_000;
const MAX_TRIANGLES: usize = 2_000_000;

#[derive(Debug)]
pub struct Scene {
    pub width: u32,
    pub height: u32,
    pub supersample: u32,
    pub camera: Camera,
    pub colours: Colours,
    pub reference_opacity: u8,
    pub analyse: bool,
    pub draw_interference: bool,
    pub budget_million_rays: u32,
    pub tolerance: f64,
    pub target_cell: f64,
    pub tools: Vec<Tool>,
    pub bodies: Vec<Body>,
    /// Census-only Boolean histories of hidden targets; never drawn or analysed.
    pub hidden: Vec<Body>,
}

#[derive(Clone, Copy, Debug)]
pub struct Camera {
    pub right: [f64; 3],
    pub up: [f64; 3],
    pub forward: [f64; 3],
    pub centre: [f64; 3],
    pub mm_per_pixel: f64,
}

#[derive(Clone, Copy, Debug)]
pub struct Colours {
    pub background: [u8; 3],
    pub body: [u8; 3],
    pub edge: [u8; 3],
    pub interference: [u8; 3],
}

#[derive(Debug)]
pub enum Tool {
    Prism(Prism),
    Mesh(Mesh),
}

#[derive(Debug)]
pub struct Prism {
    pub o: [f64; 3],
    pub u: [f64; 3],
    pub v: [f64; 3],
    pub n: [f64; 3],
    pub t0: f64,
    pub t1: f64,
    pub loops: Vec<Loop>,
}

#[derive(Debug)]
pub struct Loop {
    pub points: Vec<f64>,
    pub faces: Vec<u32>,
}

#[derive(Debug)]
pub struct Mesh {
    pub positions: Vec<f64>,
    pub triangles: Vec<u32>,
}

#[derive(Debug)]
pub struct Body {
    pub reference: bool,
    pub analysed: bool,
    pub steps: Vec<Step>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Step {
    pub op: Op,
    pub tool: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Op {
    Union,
    Difference,
    Intersection,
}

fn invalid(reason: &str) -> CaptureError {
    CaptureError(format!("Invalid capture scene: {reason}."))
}

struct Reader<'a> {
    rest: &'a [u8],
}

impl Reader<'_> {
    fn bytes<const N: usize>(&mut self) -> Result<[u8; N], CaptureError> {
        let (head, tail) = self
            .rest
            .split_first_chunk::<N>()
            .ok_or_else(|| invalid("truncated data"))?;
        self.rest = tail;
        Ok(*head)
    }

    fn u32(&mut self) -> Result<u32, CaptureError> {
        Ok(u32::from_le_bytes(self.bytes()?))
    }

    fn real(&mut self) -> Result<f64, CaptureError> {
        let value = f64::from_le_bytes(self.bytes()?);
        if !(-MAX_MAGNITUDE..=MAX_MAGNITUDE).contains(&value) {
            return Err(invalid("non-finite or out-of-range real"));
        }
        Ok(value)
    }

    fn vec3(&mut self) -> Result<[f64; 3], CaptureError> {
        Ok([self.real()?, self.real()?, self.real()?])
    }

    fn zero<const N: usize>(&mut self) -> Result<(), CaptureError> {
        if self.bytes::<N>()? != [0; N] {
            return Err(invalid("nonzero padding"));
        }
        Ok(())
    }

    // Establish that data for the count exists before any allocation, even
    // when the caller will read a record at a time.
    fn require_records(&self, count: usize, stride: usize) -> Result<(), CaptureError> {
        if count > self.rest.len() / stride {
            return Err(invalid("record count exceeds remaining data"));
        }
        Ok(())
    }

    fn camera(&mut self) -> Result<Camera, CaptureError> {
        let camera = Camera {
            right: self.vec3()?,
            up: self.vec3()?,
            forward: self.vec3()?,
            centre: self.vec3()?,
            mm_per_pixel: self.real()?,
        };
        if camera.mm_per_pixel <= 0.0 {
            return Err(invalid("camera scale must be positive"));
        }
        let [right, up, forward] = [camera.right, camera.up, camera.forward];
        let dot = |a: [f64; 3], b: [f64; 3]| a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
        const TOLERANCE: f64 = 1e-9;
        if [right, up, forward]
            .into_iter()
            .any(|axis| (dot(axis, axis).sqrt() - 1.0).abs() > TOLERANCE)
            || [(right, up), (right, forward), (up, forward)]
                .into_iter()
                .any(|(a, b)| dot(a, b).abs() > TOLERANCE)
        {
            return Err(invalid("camera basis must be orthonormal"));
        }
        Ok(camera)
    }

    fn colours(&mut self) -> Result<Colours, CaptureError> {
        Ok(Colours {
            background: self.bytes()?,
            body: self.bytes()?,
            edge: self.bytes()?,
            interference: self.bytes()?,
        })
    }

    fn prism(&mut self, loops: usize, points_left: &mut usize) -> Result<Prism, CaptureError> {
        let o = self.vec3()?;
        let u = self.vec3()?;
        let v = self.vec3()?;
        let n = self.vec3()?;
        let t0 = self.real()?;
        let t1 = self.real()?;
        if t0 == t1 {
            return Err(invalid("zero prism span"));
        }
        // Three points at 20 bytes each, the loop header and odd padding.
        self.require_records(loops, 72)?;
        if loops > *points_left / 3 {
            return Err(invalid("too many scene points"));
        }
        let mut profiles = Vec::with_capacity(loops);
        for _ in 0..loops {
            let count = self.u32()? as usize;
            self.zero::<4>()?;
            if !(3..=20_000).contains(&count) {
                return Err(invalid("loop point count must be in 3..20000"));
            }
            reserve_points(points_left, count)?;
            let padding = count % 2;
            self.require_records(count * 5 + padding, 4)?;
            let points = (0..count * 2)
                .map(|_| self.real())
                .collect::<Result<Vec<_>, _>>()?;
            let faces = (0..count)
                .map(|_| self.u32())
                .collect::<Result<Vec<_>, _>>()?;
            if padding != 0 {
                self.zero::<4>()?;
            }
            profiles.push(Loop { points, faces });
        }
        Ok(Prism {
            o,
            u,
            v,
            n,
            t0,
            t1,
            loops: profiles,
        })
    }

    fn mesh(&mut self, vertices: usize, points_left: &mut usize) -> Result<Mesh, CaptureError> {
        let triangles = self.u32()? as usize;
        self.zero::<4>()?;
        if triangles > MAX_TRIANGLES {
            return Err(invalid("too many mesh triangles"));
        }
        reserve_points(points_left, vertices)?;
        let indices = triangles * 3;
        let padding = indices % 2;
        self.require_records(vertices * 6 + indices + padding, 4)?;
        let positions = (0..vertices * 3)
            .map(|_| self.real())
            .collect::<Result<Vec<_>, _>>()?;
        let triangles = (0..indices)
            .map(|_| {
                let index = self.u32()?;
                if index as usize >= vertices {
                    return Err(invalid("mesh triangle index is out of range"));
                }
                Ok(index)
            })
            .collect::<Result<Vec<_>, _>>()?;
        if padding != 0 {
            self.zero::<4>()?;
        }
        Ok(Mesh {
            positions,
            triangles,
        })
    }

    fn body(&mut self, tool_count: usize) -> Result<Body, CaptureError> {
        let flags = self.u32()?;
        if flags & !3 != 0 {
            return Err(invalid("unknown body flags"));
        }
        self.body_steps(tool_count, flags)
    }

    fn body_steps(&mut self, tool_count: usize, flags: u32) -> Result<Body, CaptureError> {
        let count = self.u32()? as usize;
        if count == 0 {
            return Err(invalid("body has no steps"));
        }
        self.require_records(count, 8)?;
        let mut steps = Vec::with_capacity(count);
        for index in 0..count {
            let op = match self.u32()? {
                0 => Op::Union,
                1 => Op::Difference,
                2 => Op::Intersection,
                _ => return Err(invalid("unknown body operation")),
            };
            if index == 0 && op != Op::Union {
                return Err(invalid("body must start with a union"));
            }
            let tool = self.u32()?;
            if tool as usize >= tool_count {
                return Err(invalid("step tool index is out of range"));
            }
            steps.push(Step { op, tool });
        }
        Ok(Body {
            reference: flags & 1 != 0,
            analysed: flags & 2 != 0,
            steps,
        })
    }
}

fn reserve_points(points_left: &mut usize, count: usize) -> Result<(), CaptureError> {
    *points_left = points_left
        .checked_sub(count)
        .ok_or_else(|| invalid("too many scene points"))?;
    Ok(())
}

/// Parse a complete NCS1 scene. Counts are bounded before reading arrays.
pub fn parse_scene(bytes: &[u8]) -> Result<Scene, CaptureError> {
    let mut reader = Reader { rest: bytes };
    if &reader.bytes::<4>()? != b"NCS1" {
        return Err(invalid("wrong magic"));
    }
    if u16::from_le_bytes(reader.bytes()?) != 1 {
        return Err(invalid("unsupported version"));
    }
    if reader.bytes::<2>()? != [0; 2] {
        return Err(invalid("unknown header flags"));
    }

    let width = reader.u32()?;
    let height = reader.u32()?;
    let supersample = reader.u32()?;
    if !(64..=2048).contains(&width) || !(64..=2048).contains(&height) {
        return Err(invalid("picture sides must be in 64..2048"));
    }
    if !(1..=3).contains(&supersample) {
        return Err(invalid("supersample must be in 1..3"));
    }
    let tool_count = reader.u32()? as usize;
    let body_count = reader.u32()? as usize;
    if tool_count > MAX_RECORDS || body_count > MAX_RECORDS {
        return Err(invalid("too many tools or bodies"));
    }
    let options = reader.u32()?;
    if options & !3 != 0 {
        return Err(invalid("unknown option bits"));
    }
    let analyse = options & 1 != 0;
    let draw_interference = options & 2 != 0;
    let budget_million_rays = reader.u32()?;
    if (analyse && !(1..=256).contains(&budget_million_rays))
        || (!analyse && budget_million_rays != 0)
    {
        return Err(invalid("invalid analysis budget"));
    }
    let hidden_count = reader.u32()? as usize;
    if hidden_count > MAX_RECORDS {
        return Err(invalid("too many tools or bodies"));
    }

    let camera = reader.camera()?;
    let tolerance = reader.real()?;
    let target_cell = reader.real()?;
    if !(1e-6..=1.0).contains(&tolerance) {
        return Err(invalid("tolerance must be in 0.000001..1 mm"));
    }
    if !(0.01..=10.0).contains(&target_cell) {
        return Err(invalid("target cell must be in 0.01..10 mm"));
    }
    let colours = reader.colours()?;
    let [reference_opacity] = reader.bytes()?;
    reader.zero::<3>()?;

    // The shortest tool is a mesh header and the shortest body has one step.
    reader.require_records(tool_count + body_count + hidden_count, 16)?;
    let mut points_left = MAX_POINTS;
    let mut tools = Vec::with_capacity(tool_count);
    for _ in 0..tool_count {
        let kind = reader.u32()?;
        let count = reader.u32()? as usize;
        tools.push(match kind {
            0 => Tool::Prism(reader.prism(count, &mut points_left)?),
            1 => Tool::Mesh(reader.mesh(count, &mut points_left)?),
            _ => return Err(invalid("unknown tool kind")),
        });
    }
    reader.require_records(body_count, 16)?;
    let mut bodies = Vec::with_capacity(body_count);
    for _ in 0..body_count {
        bodies.push(reader.body(tool_count)?);
    }
    reader.require_records(hidden_count, 16)?;
    let mut hidden = Vec::with_capacity(hidden_count);
    for _ in 0..hidden_count {
        if reader.u32()? != 0 {
            return Err(invalid("hidden body flags must be zero"));
        }
        hidden.push(reader.body_steps(tool_count, 0)?);
    }
    if !reader.rest.is_empty() {
        return Err(invalid("trailing data"));
    }

    Ok(Scene {
        width,
        height,
        supersample,
        camera,
        colours,
        reference_opacity,
        analyse,
        draw_interference,
        budget_million_rays,
        tolerance,
        target_cell,
        tools,
        bodies,
        hidden,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn point_budget_is_cumulative() {
        let mut remaining = MAX_POINTS;
        reserve_points(&mut remaining, MAX_POINTS - 3).unwrap();
        assert!(reserve_points(&mut remaining, 4).is_err());
        reserve_points(&mut remaining, 3).unwrap();
        assert_eq!(remaining, 0);
        assert!(reserve_points(&mut remaining, 1).is_err());
    }
}
