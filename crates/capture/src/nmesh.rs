//! Decoder for inline `nmesh1:` mesh payloads.
//!
//! The format is defined by `packages/nmesh` (TypeScript), which stays the
//! reference: this decoder accepts and rejects exactly the same payloads.
//! It exists because the native CLI interprets the TypeScript engine, where
//! the per-byte loops below take most of a second per megabyte.

const PREFIX: &str = "nmesh1:";
const MAX_CHARS: usize = 1_048_576;
const COORDINATE_LIMIT: i64 = 10_000_000;
const UNITS_PER_MILLIMETRE: f64 = 1_000.0;

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
}
