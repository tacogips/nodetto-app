//! Decoder for inline `nmesh1:` mesh payloads.
//!
//! The format is defined by `packages/nmesh` (TypeScript), which stays the
//! reference: this decoder accepts and rejects exactly the same payloads.
//! It exists because the native CLI interprets the TypeScript engine, where
//! the per-byte loops below take most of a second per megabyte.

const PREFIX: &str = "nmesh1:";
const MAX_CHARS: usize = 1_048_576;
pub(crate) const COORDINATE_LIMIT: i64 = 10_000_000;
pub(crate) const UNITS_PER_MILLIMETRE: f64 = 1_000.0;

/// A decoded mesh: millimetre positions and vertex indices, three per triangle.
#[derive(Debug, PartialEq)]
pub struct InlineMesh {
    pub positions: Vec<f64>,
    pub triangles: Vec<u32>,
}

impl InlineMesh {
    /// `[vertex count][triangle count]` as little-endian u32, then the
    /// positions as f64 and the indices as u32, both little-endian.
    pub fn to_packet(&self) -> Vec<u8> {
        let mut packet =
            Vec::with_capacity(8 + self.positions.len() * 8 + self.triangles.len() * 4);
        packet.extend((self.positions.len() as u32 / 3).to_le_bytes());
        packet.extend((self.triangles.len() as u32 / 3).to_le_bytes());
        packet.extend(self.positions.iter().flat_map(|value| value.to_le_bytes()));
        packet.extend(self.triangles.iter().flat_map(|value| value.to_le_bytes()));
        packet
    }
}

/// Decode an inline payload. `None` for anything the reference decoder rejects.
pub fn decode_inline(text: &str) -> Option<InlineMesh> {
    decode(&unarmor(text)?)
}

/// Options for the budgeted capture decoder.
pub struct DecodeOptions {
    pub max_vertices: u64,
    pub need_target: bool,
}
impl Default for DecodeOptions {
    fn default() -> Self {
        Self {
            max_vertices: u64::MAX,
            need_target: false,
        }
    }
}
#[derive(Debug, PartialEq)]
pub struct DecodedMesh {
    pub vertex_count: u32,
    pub triangle_count: u32,
    pub bounds: Option<([f64; 3], [f64; 3])>,
    pub boolean_target: Option<bool>,
    pub geometry: Option<InlineMesh>,
}
impl DecodedMesh {
    pub fn to_packet(&self) -> Vec<u8> {
        let mut packet = Vec::new();
        let flags = u32::from(self.geometry.is_some())
            | (u32::from(self.boolean_target.is_some()) << 1)
            | (u32::from(self.boolean_target == Some(true)) << 2)
            | (u32::from(self.bounds.is_some()) << 3);
        for n in [self.vertex_count, self.triangle_count, flags, 0] {
            packet.extend(n.to_le_bytes());
        }
        let (lo, hi) = self.bounds.unwrap_or(([0.; 3], [0.; 3]));
        for n in lo.into_iter().chain(hi) {
            packet.extend(n.to_le_bytes());
        }
        if let Some(mesh) = &self.geometry {
            for n in &mesh.positions {
                packet.extend(n.to_le_bytes());
            }
            for n in &mesh.triangles {
                packet.extend(n.to_le_bytes());
            }
        }
        packet
    }
}
#[derive(Default)]
struct AllocStats {
    positions: usize,
    triangles: usize,
    target: usize,
}

pub fn decode_inline_with(text: &str, options: DecodeOptions) -> Option<DecodedMesh> {
    decode_budgeted(text, options, &mut AllocStats::default())
}
#[cfg(test)]
fn decode_with_stats(text: &str, options: DecodeOptions) -> (Option<DecodedMesh>, AllocStats) {
    let mut stats = AllocStats::default();
    let result = decode_budgeted(text, options, &mut stats);
    (result, stats)
}
fn decode_budgeted(
    text: &str,
    options: DecodeOptions,
    stats: &mut AllocStats,
) -> Option<DecodedMesh> {
    let bytes = unarmor(text)?;
    let end = bytes.len().checked_sub(4)?;
    if bytes.len() < 12 || bytes[..8] != [b'N', b'M', b'S', b'H', 1, 0, 3, 0] {
        return None;
    }
    let mut body = Varints {
        bytes: &bytes[8..end],
    };
    let vertices = body.next()?;
    let triangles = body.next()?;
    let groups = body.next()?;
    if 3 * vertices + 3 * triangles + 2 * groups > bytes.len() as u64 - 12
        || crc32(&bytes[..end]).to_le_bytes() != bytes[end..]
        || (triangles > 0 && groups == 0)
    {
        return None;
    }
    let mut previous_face = None;
    let mut grouped = 0;
    for _ in 0..groups {
        let face = body.next()?;
        grouped += body.next()?;
        if previous_face.is_some_and(|previous| face <= previous) || grouped > triangles {
            return None;
        }
        previous_face = Some(face);
    }
    if grouped != triangles {
        return None;
    }
    let geometry_body = body.bytes;
    let mut previous = [0i64; 3];
    let mut lo = [i64::MAX; 3];
    let mut hi = [i64::MIN; 3];
    for _ in 0..vertices {
        for axis in 0..3 {
            let encoded = body.next()? as i64;
            let delta = if encoded % 2 == 0 {
                encoded / 2
            } else {
                -(encoded + 1) / 2
            };
            previous[axis] += delta;
            if previous[axis].abs() > COORDINATE_LIMIT {
                return None;
            }
            lo[axis] = lo[axis].min(previous[axis]);
            hi[axis] = hi[axis].max(previous[axis]);
        }
    }
    let mut used = 0;
    for _ in 0..triangles * 3 {
        let code = body.next()?;
        if code > used || (code == 0 && used == vertices) {
            return None;
        }
        used += u64::from(code == 0);
    }
    if used != vertices || !body.bytes.is_empty() {
        return None;
    }
    let bounds = (vertices != 0).then(|| {
        (
            lo.map(|n| n as f64 / UNITS_PER_MILLIMETRE),
            hi.map(|n| n as f64 / UNITS_PER_MILLIMETRE),
        )
    });
    let fits = vertices <= options.max_vertices;
    let mut geometry = None;
    let mut boolean_target = None;
    if fits || options.need_target {
        let mut body = Varints {
            bytes: geometry_body,
        };
        if fits {
            stats.positions += 1;
            stats.triangles += 1;
        } else {
            stats.target += 2;
        }
        let mut quantized = Vec::with_capacity(vertices as usize * 3);
        let mut prev = [0i64; 3];
        for _ in 0..vertices {
            for value in &mut prev {
                let encoded = body.next()? as i64;
                *value += if encoded % 2 == 0 {
                    encoded / 2
                } else {
                    -(encoded + 1) / 2
                };
                quantized.push(*value);
            }
        }
        let mut indices = Vec::with_capacity(triangles as usize * 3);
        let mut used = 0;
        for _ in 0..triangles * 3 {
            let code = body.next()?;
            indices.push((used - code) as u32);
            used += u64::from(code == 0);
        }
        if options.need_target {
            boolean_target = Some(target_eligible(&quantized, &indices, stats));
        }
        if fits {
            stats.positions += 1;
            let mut positions = Vec::with_capacity(quantized.len());
            positions.extend(
                quantized
                    .into_iter()
                    .map(|q| q as f64 / UNITS_PER_MILLIMETRE),
            );
            geometry = Some(InlineMesh {
                positions,
                triangles: indices,
            });
        }
    }
    Some(DecodedMesh {
        vertex_count: vertices as u32,
        triangle_count: triangles as u32,
        bounds,
        boolean_target,
        geometry,
    })
}
fn target_eligible(q: &[i64], triangles: &[u32], stats: &mut AllocStats) -> bool {
    let point = |i: usize| {
        [
            q[3 * i] as f64 / UNITS_PER_MILLIMETRE,
            q[3 * i + 1] as f64 / UNITS_PER_MILLIMETRE,
            q[3 * i + 2] as f64 / UNITS_PER_MILLIMETRE,
        ]
    };
    if !triangles.is_empty() && triangles.len().is_multiple_of(3) {
        stats.target += 1;
    }
    if !crate::mesh::closed_by(q.len() / 3, triangles, point) {
        return false;
    }
    stats.target += 2;
    let mut edges = Vec::with_capacity(triangles.len());
    let mut faces = Vec::with_capacity(triangles.len() / 3);
    for tri in triangles.as_chunks::<3>().0 {
        for (a, b) in [(tri[0], tri[1]), (tri[1], tri[2]), (tri[2], tri[0])] {
            edges.push((a.min(b), a.max(b), a < b));
        }
        let mut face = [tri[0], tri[1], tri[2]];
        face.sort_unstable();
        faces.push(face);
    }
    edges.sort_unstable();
    let mut contact = false;
    let mut start = 0;
    while start < edges.len() {
        let mut end = start + 1;
        while end < edges.len() && edges[end].0 == edges[start].0 && edges[end].1 == edges[start].1
        {
            end += 1;
        }
        match end - start {
            2 if edges[start].2 != edges[start + 1].2 => {}
            4.. => contact = true,
            _ => return false,
        }
        start = end;
    }
    if !contact {
        faces.sort_unstable();
        if faces.windows(2).any(|pair| pair[0] == pair[1]) {
            return false;
        }
    }
    let origin = point(0);
    let mut volume = 0.;
    let mut area = 0.;
    for tri in triangles.as_chunks::<3>().0 {
        let p = [
            point(tri[0] as usize),
            point(tri[1] as usize),
            point(tri[2] as usize),
        ]
        .map(|p| std::array::from_fn::<_, 3, _>(|i| p[i] - origin[i]));
        let cross = crate::view::cross(p[1], p[2]);
        volume += crate::view::dot(p[0], cross) / 6.;
        let normal = crate::view::cross(
            std::array::from_fn(|i| p[1][i] - p[0][i]),
            std::array::from_fn(|i| p[2][i] - p[0][i]),
        );
        area += crate::view::dot(normal, normal).sqrt() / 2.;
    }
    volume != 0. && 2. * volume.abs() >= area * 5e-7
}

fn unarmor(text: &str) -> Option<Vec<u8>> {
    let data = text.strip_prefix(PREFIX)?.as_bytes();
    if text.len() > MAX_CHARS || data.is_empty() || !data.len().is_multiple_of(4) {
        return None;
    }
    let padding = match data {
        [.., b'=', b'='] => 2,
        [.., b'='] => 1,
        _ => 0,
    };
    let mut output = Vec::with_capacity(data.len() / 4 * 3 - padding);
    let (mut bits, mut bit_count) = (0u32, 0);
    for &character in &data[..data.len() - padding] {
        let value = match character {
            b'A'..=b'Z' => character - b'A',
            b'a'..=b'z' => character - b'a' + 26,
            b'0'..=b'9' => character - b'0' + 52,
            b'+' => 62,
            b'/' => 63,
            _ => return None,
        };
        bits = (bits << 6) | u32::from(value);
        bit_count += 6;
        if bit_count >= 8 {
            bit_count -= 8;
            output.push((bits >> bit_count) as u8);
            bits &= (1 << bit_count) - 1;
        }
    }
    (bits == 0).then_some(output)
}

fn crc32(bytes: &[u8]) -> u32 {
    let mut crc = u32::MAX;
    for &byte in bytes {
        crc ^= u32::from(byte);
        for _ in 0..8 {
            crc = (crc >> 1) ^ (0xedb8_8320 & (crc & 1).wrapping_neg());
        }
    }
    !crc
}

/// The body between the header and the checksum, read as minimal varints.
struct Varints<'a> {
    bytes: &'a [u8],
}

impl Varints<'_> {
    fn next(&mut self) -> Option<u64> {
        let mut value = 0;
        for place in 0..5 {
            let (&byte, rest) = self.bytes.split_first()?;
            self.bytes = rest;
            if place == 4 && byte > 15 {
                return None;
            }
            value |= u64::from(byte & 127) << (7 * place);
            if byte < 128 {
                return (place == 0 || byte != 0).then_some(value);
            }
        }
        None
    }
}

fn decode(bytes: &[u8]) -> Option<InlineMesh> {
    let end = bytes.len().checked_sub(4)?;
    if bytes.len() < 12 || bytes[..8] != [b'N', b'M', b'S', b'H', 1, 0, 3, 0] {
        return None;
    }
    let mut body = Varints {
        bytes: &bytes[8..end],
    };
    let vertex_count = body.next()?;
    let triangle_count = body.next()?;
    let group_count = body.next()?;
    if 3 * vertex_count + 3 * triangle_count + 2 * group_count > bytes.len() as u64 - 12
        || crc32(&bytes[..end]).to_le_bytes() != bytes[end..]
        || (triangle_count > 0 && group_count == 0)
    {
        return None;
    }

    let mut previous_face = None;
    let mut grouped = 0;
    for _ in 0..group_count {
        let face = body.next()?;
        grouped += body.next()?;
        if previous_face.is_some_and(|previous| face <= previous) || grouped > triangle_count {
            return None;
        }
        previous_face = Some(face);
    }
    if grouped != triangle_count {
        return None;
    }

    let mut quantized = Vec::<i64>::with_capacity(vertex_count as usize * 3);
    for index in 0..vertex_count as usize * 3 {
        let encoded = body.next()? as i64;
        let delta = if encoded % 2 == 0 {
            encoded / 2
        } else {
            -(encoded + 1) / 2
        };
        let position = delta + if index < 3 { 0 } else { quantized[index - 3] };
        if position.abs() > COORDINATE_LIMIT {
            return None;
        }
        quantized.push(position);
    }
    let mut triangles = Vec::with_capacity(triangle_count as usize * 3);
    let mut used = 0;
    for _ in 0..triangle_count * 3 {
        let code = body.next()?;
        if code > used || (code == 0 && used == vertex_count) {
            return None;
        }
        triangles.push((used - code) as u32);
        used += u64::from(code == 0);
    }
    (used == vertex_count && body.bytes.is_empty()).then(|| InlineMesh {
        positions: quantized
            .into_iter()
            .map(|value| value as f64 / UNITS_PER_MILLIMETRE)
            .collect(),
        triangles,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A tetrahedron with corners at 0 and 1 mm, written by `packages/nmesh`.
    const TETRAHEDRON: &str = include_str!("../tests/fixtures/tetrahedron.nmesh.txt");

    #[test]
    fn decodes_the_reference_tetrahedron() {
        let mesh = decode_inline(TETRAHEDRON.trim()).unwrap();
        assert_eq!(mesh.positions.len(), 12);
        assert_eq!(mesh.triangles.len(), 12);
        assert!(mesh
            .positions
            .iter()
            .all(|&value| value == 0.0 || value == 1.0));
        assert!(mesh.triangles.iter().all(|&index| index < 4));
        let packet = mesh.to_packet();
        assert_eq!(packet[..8], [4, 0, 0, 0, 4, 0, 0, 0]);
        assert_eq!(packet.len(), 8 + 12 * 8 + 12 * 4);
    }

    #[test]
    fn rejects_what_the_reference_decoder_rejects() {
        let text = TETRAHEDRON.trim();
        let flipped = {
            // Change one payload character: the checksum no longer matches.
            let mut bytes = text.as_bytes().to_vec();
            let at = PREFIX.len() + 14;
            bytes[at] = if bytes[at] == b'A' { b'B' } else { b'A' };
            String::from_utf8(bytes).unwrap()
        };
        for bad in [
            "",
            "nmesh1:",
            "nmesh1:UExBVEU=",
            "nmesh2:AAAA",
            "nmesh1:AA=A",
            "nmesh1:\u{e9}AAA",
            &text[..text.len() - 4],
            &flipped,
        ] {
            assert_eq!(decode_inline(bad), None, "{bad}");
        }
    }

    #[derive(Default)]
    struct ContactFixture {
        points: Vec<[i64; 3]>,
        triangles: Vec<u32>,
    }
    impl ContactFixture {
        fn vertex(&mut self, point: [i64; 3]) -> u32 {
            match self.points.iter().position(|p| *p == point) {
                Some(i) => i as u32,
                None => {
                    self.points.push(point);
                    (self.points.len() - 1) as u32
                }
            }
        }
        fn cube(&mut self, min: [i64; 3], max: [i64; 3], crossed: bool, reverse: bool) {
            let [x, y, z] = min;
            let [a, b, c] = max;
            let ids = [
                [x, y, z],
                [a, y, z],
                [a, b, z],
                [x, b, z],
                [x, y, c],
                [a, y, c],
                [a, b, c],
                [x, b, c],
            ]
            .map(|p| self.vertex(p));
            let faces = [
                [0, 3, 2, 1],
                [4, 5, 6, 7],
                [0, 1, 5, 4],
                [1, 2, 6, 5],
                [2, 3, 7, 6],
                [3, 0, 4, 7],
            ];
            for (index, f) in faces.iter().enumerate() {
                let triangles = if !crossed && index == 5 {
                    [[f[0], f[1], f[3]], [f[1], f[2], f[3]]]
                } else {
                    [[f[0], f[1], f[2]], [f[0], f[2], f[3]]]
                };
                for mut triangle in triangles {
                    if reverse {
                        triangle.swap(1, 2);
                    }
                    self.triangles.extend(triangle.map(|i| ids[i]));
                }
            }
        }
        fn pair(min: [i64; 3], max: [i64; 3], crossed: bool) -> Self {
            let mut f = Self::default();
            f.cube([0, 0, 0], [10000, 10000, 5000], false, false);
            f.cube(min, max, crossed, false);
            f
        }
    }
    fn contact_fixtures() -> Vec<(&'static str, ContactFixture, bool)> {
        let edge = || ContactFixture::pair([10000, 10000, 0], [20000, 20000, 5000], false);
        let mut open = ContactFixture::default();
        open.cube([0, 0, 0], [10000, 10000, 5000], false, false);
        let extra = open.vertex([5000, -1000, 0]);
        open.triangles.extend([0, 1, extra]);
        let mut unbalanced = edge();
        let a = unbalanced.vertex([10000, 10000, 0]);
        let b = unbalanced.vertex([10000, 10000, 5000]);
        let triangle = unbalanced.triangles[36..]
            .as_chunks_mut::<3>()
            .0
            .iter_mut()
            .find(|t| t.contains(&a) && t.contains(&b))
            .unwrap();
        triangle.swap(1, 2);
        let mut fin = edge();
        let p = [
            [10000, 10000, 0],
            [10000, 10000, 5000],
            [13000, 7000, 5000],
            [13000, 7000, 0],
        ]
        .map(|v| fin.vertex(v));
        fin.triangles.extend([
            p[0], p[1], p[2], p[0], p[2], p[3], p[0], p[3], p[1], p[1], p[3], p[2],
        ]);
        let mut coincident = ContactFixture::default();
        coincident.cube([0, 0, 0], [1000, 1000, 1000], false, false);
        coincident.cube([0, 0, 0], [1000, 1000, 1000], false, true);
        coincident.cube([2000, 0, 0], [3000, 1000, 1000], false, false);
        vec![
            ("edge", edge(), true),
            (
                "face",
                ContactFixture::pair([10000, 0, 0], [20000, 10000, 5000], false),
                true,
            ),
            (
                "crossed",
                ContactFixture::pair([10000, 0, 0], [20000, 10000, 5000], true),
                true,
            ),
            (
                "separated",
                ContactFixture::pair([12000, 0, 0], [22000, 10000, 5000], false),
                true,
            ),
            ("triangle", open, false),
            ("unbalanced", unbalanced, false),
            (
                "overlap",
                ContactFixture::pair([0, 0, 0], [6000, 6000, 5000], false),
                false,
            ),
            ("fin", fin, false),
            ("coincident", coincident, false),
        ]
    }
    fn encode_text(f: &ContactFixture) -> (String, InlineMesh) {
        fn varint(mut n: u64, out: &mut Vec<u8>) {
            while n >= 128 {
                out.push((n as u8 & 127) | 128);
                n >>= 7;
            }
            out.push(n as u8);
        }
        let mut map = vec![None; f.points.len()];
        let mut points = Vec::new();
        let mut indices = Vec::new();
        let mut codes = Vec::new();
        for &old in &f.triangles {
            let index = match map[old as usize] {
                Some(i) => {
                    codes.push(points.len() as u64 - i as u64);
                    i
                }
                None => {
                    let i = points.len() as u32;
                    points.push(f.points[old as usize]);
                    map[old as usize] = Some(i);
                    codes.push(0);
                    i
                }
            };
            indices.push(index);
        }
        let mut bytes = vec![b'N', b'M', b'S', b'H', 1, 0, 3, 0];
        for n in [
            points.len() as u64,
            (indices.len() / 3) as u64,
            1,
            0,
            (indices.len() / 3) as u64,
        ] {
            varint(n, &mut bytes);
        }
        let mut prev = [0; 3];
        for point in &points {
            for axis in 0..3 {
                let d = point[axis] - prev[axis];
                varint(
                    if d >= 0 {
                        (d * 2) as u64
                    } else {
                        (-d * 2 - 1) as u64
                    },
                    &mut bytes,
                );
                prev[axis] = point[axis];
            }
        }
        for code in codes {
            varint(code, &mut bytes);
        }
        bytes.extend(crc32(&bytes).to_le_bytes());
        let alphabet = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        let mut text = String::from(PREFIX);
        for chunk in bytes.chunks(3) {
            let v = (u32::from(chunk[0]) << 16)
                | (u32::from(*chunk.get(1).unwrap_or(&0)) << 8)
                | u32::from(*chunk.get(2).unwrap_or(&0));
            text.push(alphabet[((v >> 18) & 63) as usize] as char);
            text.push(alphabet[((v >> 12) & 63) as usize] as char);
            text.push(if chunk.len() > 1 {
                alphabet[((v >> 6) & 63) as usize] as char
            } else {
                '='
            });
            text.push(if chunk.len() > 2 {
                alphabet[(v & 63) as usize] as char
            } else {
                '='
            });
        }
        (
            text,
            InlineMesh {
                positions: points
                    .iter()
                    .flatten()
                    .map(|&v| v as f64 / UNITS_PER_MILLIMETRE)
                    .collect(),
                triangles: indices,
            },
        )
    }
    #[test]
    fn contact_encoder_round_trip() {
        for (name, fixture, _) in contact_fixtures() {
            let (text, expected) = encode_text(&fixture);
            assert_eq!(decode_inline(&text), Some(expected), "{name}");
        }
    }
    #[test]
    fn contact_decoder_target_eligibility() {
        for (name, fixture, expected) in contact_fixtures() {
            let (text, mesh) = encode_text(&fixture);
            assert_eq!(decode_inline(&text), Some(mesh), "round trip: {name}");
            let decoded = decode_inline_with(
                &text,
                DecodeOptions {
                    max_vertices: u64::MAX,
                    need_target: true,
                },
            )
            .unwrap();
            assert_eq!(decoded.boolean_target, Some(expected), "{name}");
        }
    }
    #[test]
    fn budgeted_fixture_contract() {
        let fixtures = [
            (
                include_str!("../tests/fixtures/tetrahedron.nmesh.txt"),
                true,
                true,
            ),
            (
                include_str!("../tests/fixtures/tetrahedron-reversed.nmesh.txt"),
                true,
                true,
            ),
            (
                include_str!("../tests/fixtures/tetrahedron-mixed.nmesh.txt"),
                false,
                true,
            ),
            (
                include_str!("../tests/fixtures/triangle.nmesh.txt"),
                false,
                false,
            ),
            (
                include_str!("../tests/fixtures/double-sided-triangle.nmesh.txt"),
                false,
                true,
            ),
            (
                include_str!("../tests/fixtures/coplanar-tetrahedron.nmesh.txt"),
                false,
                true,
            ),
            (
                include_str!("../tests/fixtures/thin-bar.nmesh.txt"),
                true,
                true,
            ),
            (
                include_str!("../tests/fixtures/translated-flat-shell.nmesh.txt"),
                false,
                true,
            ),
            (
                include_str!("../tests/fixtures/translated-thin-bar.nmesh.txt"),
                true,
                true,
            ),
        ];
        for (text, expected, closed) in fixtures {
            let text = text.trim();
            let original = decode_inline(text).unwrap();
            let result = decode_inline_with(
                text,
                DecodeOptions {
                    max_vertices: u64::MAX,
                    need_target: true,
                },
            )
            .unwrap();
            assert_eq!(result.boolean_target, Some(expected));
            assert_eq!(result.geometry.as_ref(), Some(&original));
            let mut lo = [f64::INFINITY; 3];
            let mut hi = [f64::NEG_INFINITY; 3];
            for point in original.positions.as_chunks::<3>().0 {
                for i in 0..3 {
                    lo[i] = lo[i].min(point[i]);
                    hi[i] = hi[i].max(point[i]);
                }
            }
            assert_eq!(result.bounds, Some((lo, hi)));
            let mesh = crate::scene::Mesh {
                positions: original.positions.clone(),
                triangles: original.triangles.clone(),
            };
            assert_eq!(crate::mesh::is_closed(&mesh), closed);
            let (limited, stats) = decode_with_stats(
                text,
                DecodeOptions {
                    max_vertices: u64::from(result.vertex_count) - 1,
                    need_target: true,
                },
            );
            let limited = limited.unwrap();
            assert_eq!(
                (
                    limited.vertex_count,
                    limited.triangle_count,
                    limited.bounds,
                    limited.boolean_target
                ),
                (
                    result.vertex_count,
                    result.triangle_count,
                    result.bounds,
                    result.boolean_target
                )
            );
            assert!(limited.geometry.is_none());
            assert_eq!((stats.positions, stats.triangles), (0, 0));
            assert!(stats.target > 0);
            let packet = result.to_packet();
            assert_eq!(&packet[0..4], &result.vertex_count.to_le_bytes());
            assert_eq!(&packet[4..8], &result.triangle_count.to_le_bytes());
            assert_eq!(
                &packet[8..12],
                &(11u32 | if expected { 4 } else { 0 }).to_le_bytes()
            );
            assert_eq!(&packet[64..72], &original.positions[0].to_le_bytes());
            let index_offset = 64 + 24 * result.vertex_count as usize;
            assert_eq!(
                &packet[index_offset..index_offset + 4],
                &original.triangles[0].to_le_bytes()
            );
        }
    }

    #[test]
    fn budgeted_rejects_corruption_without_geometry_allocation() {
        let text = TETRAHEDRON.trim();
        let mut flipped = text.as_bytes().to_vec();
        flipped[PREFIX.len() + 14] ^= 1;
        let flipped = String::from_utf8(flipped).unwrap();
        for bad in [
            "",
            "nmesh1:",
            "nmesh1:UExBVEU=",
            "nmesh2:AAAA",
            "nmesh1:AA=A",
            "nmesh1:\u{e9}AAA",
            &text[..text.len() - 4],
            &flipped,
        ] {
            let (result, stats) = decode_with_stats(
                bad,
                DecodeOptions {
                    max_vertices: 0,
                    need_target: true,
                },
            );
            assert_eq!(result, None);
            assert_eq!((stats.positions, stats.triangles), (0, 0));
            assert_eq!(decode_inline_with(bad, DecodeOptions::default()), None);
        }
    }
    #[test]
    fn asymmetric_bounds_and_packet() {
        let text = "nmesh1:Tk1TSAEAAwADAQEAAb8+oB/fXbBtr22QywGfH5DLAc+MAQAAAFBZiOA=";
        let result = decode_inline_with(
            text,
            DecodeOptions {
                max_vertices: 3,
                need_target: true,
            },
        )
        .unwrap();
        assert_eq!(result.bounds, Some(([-4., -5., -6.], [3., 8., 7.])));
        let packet = result.to_packet();
        assert_eq!(&packet[8..12], &11u32.to_le_bytes());
        assert_eq!(&packet[64..72], &(-4f64).to_le_bytes());
        assert_eq!(&packet[64 + 24 * 3..64 + 24 * 3 + 4], &0u32.to_le_bytes());
    }
}
