use std::io::Cursor;

use png::{BitDepth, ColorType, Decoder, DecodingError};

use crate::{encode::MAX_SIDE, CaptureError};

const MAX_PIXELS: u32 = 32_000_000;

fn decode_error(error: DecodingError) -> CaptureError {
    CaptureError(format!("Cannot decode capture PNG: {error}"))
}

pub(crate) fn png_to_rgb8(
    png: &[u8],
    background: [u8; 3],
) -> Result<(Vec<u8>, u32, u32), CaptureError> {
    let mut decoder = Decoder::new(Cursor::new(png));
    let header = decoder.read_header_info().map_err(decode_error)?;
    let (width, height) = (header.width, header.height);
    if !(1..=MAX_SIDE).contains(&width)
        || !(1..=MAX_SIDE).contains(&height)
        || width * height > MAX_PIXELS
    {
        return Err(CaptureError(format!(
            "Capture PNG exceeds the {MAX_SIDE} pixel side or 32 megapixel limit."
        )));
    }
    if header.bit_depth != BitDepth::Eight
        || !matches!(header.color_type, ColorType::Rgb | ColorType::Rgba)
    {
        return Err(CaptureError(
            "Capture PNG must contain 8-bit RGB or RGBA pixels.".into(),
        ));
    }
    let mut reader = decoder.read_info().map_err(decode_error)?;
    if reader.info().animation_control.is_some() {
        return Err(CaptureError("Capture PNG must be a still image.".into()));
    }
    let size = reader
        .output_buffer_size()
        .ok_or_else(|| CaptureError("Cannot allocate a buffer for the capture PNG.".into()))?;
    let mut pixels = vec![0; size];
    let frame = reader.next_frame(&mut pixels).map_err(decode_error)?;
    reader.finish().map_err(decode_error)?;

    if frame.color_type == ColorType::Rgba {
        let count = (width * height) as usize;
        let background = background.map(u16::from);
        // Compact towards the front. Each destination channel is at or before its source.
        for pixel in 0..count {
            let alpha = u16::from(pixels[pixel * 4 + 3]);
            for (channel, bg) in background.iter().enumerate() {
                let color = u16::from(pixels[pixel * 4 + channel]);
                pixels[pixel * 3 + channel] =
                    ((color * alpha + bg * (255 - alpha) + 127) / 255) as u8;
            }
        }
        pixels.truncate(count * 3);
    }
    Ok((pixels, width, height))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn alpha_compositing_rounds_before_encoding() {
        let mut png = Vec::new();
        let mut encoder = png::Encoder::new(&mut png, 1, 1);
        encoder.set_color(ColorType::Rgba);
        let mut writer = encoder.write_header().unwrap();
        writer.write_image_data(&[200, 100, 20, 128]).unwrap();
        writer.finish().unwrap();
        assert_eq!(
            png_to_rgb8(&png, [10, 30, 90]).unwrap(),
            (vec![105, 65, 55], 1, 1)
        );
    }
}
