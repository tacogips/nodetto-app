use std::io::Cursor;

use nodetto_capture::{
    encode::{jpeg_rgb8, png_rgb8},
    transcode_png, ImageFormat,
};
use png::{BitDepth, ColorType};

#[test]
fn png_round_trips_rgb_pixels_and_is_deterministic() {
    let pixels = [1, 20, 200, 27, 190, 0, 61, 4, 27, 200, 255, 0];
    let png = png_rgb8(&pixels, 2, 2).unwrap();
    assert_eq!(png, png_rgb8(&pixels, 2, 2).unwrap());
    let mut reader = png::Decoder::new(Cursor::new(&png)).read_info().unwrap();
    let mut decoded = [0; 12];
    let frame = reader.next_frame(&mut decoded).unwrap();
    assert_eq!((frame.width, frame.height), (2, 2));
    assert_eq!(
        (frame.color_type, frame.bit_depth),
        (ColorType::Rgb, BitDepth::Eight)
    );
    assert_eq!(decoded, pixels);
    assert_eq!(transcode_png(&png, ImageFormat::Png, [0; 3]).unwrap(), png);
}

#[test]
fn jpeg_round_trips_a_small_gradient_with_lines_and_is_deterministic() {
    let (width, height) = (64, 48);
    let mut pixels = Vec::new();
    for y in 0..height {
        for x in 0..width {
            let rgb = if x == 17 || y == 28 {
                [220, 64, 142]
            } else {
                [25 + x * 3, 30 + y * 4, 80 + x + y]
            };
            pixels.extend(rgb.map(|channel| channel as u8));
        }
    }
    let jpg = jpeg_rgb8(&pixels, width, height, 90).unwrap();
    assert!(jpg.starts_with(&[0xff, 0xd8]));
    assert!(jpg.ends_with(&[0xff, 0xd9]));
    assert_eq!(jpg, jpeg_rgb8(&pixels, width, height, 90).unwrap());

    // The dependency defaults to subsampling below quality 90. Check the three
    // sampling bytes in the baseline frame header at a lower quality.
    let lower_quality = jpeg_rgb8(&pixels, width, height, 85).unwrap();
    let frame = lower_quality
        .windows(19)
        .find(|segment| segment.starts_with(&[0xff, 0xc0, 0, 17]))
        .unwrap();
    assert_eq!([frame[11], frame[14], frame[17]], [0x11; 3]);

    let mut decoder = jpeg_decoder::Decoder::new(Cursor::new(jpg));
    let decoded = decoder.decode().unwrap();
    let info = decoder.info().unwrap();
    assert_eq!(
        (u32::from(info.width), u32::from(info.height)),
        (width, height)
    );
    assert_eq!(info.pixel_format, jpeg_decoder::PixelFormat::RGB24);
    assert_eq!(
        info.coding_process,
        jpeg_decoder::CodingProcess::DctSequential
    );
    assert_eq!(decoded.len(), pixels.len());
    let error: usize = decoded
        .iter()
        .zip(&pixels)
        .map(|(&actual, &expected)| usize::from(actual.abs_diff(expected)))
        .sum();
    assert!(
        error < 3 * pixels.len(),
        "mean channel error: {}",
        error as f64 / pixels.len() as f64
    );
}

#[test]
fn raw_encoders_reject_bad_dimensions_and_buffer_lengths() {
    for (width, height) in [(0, 1), (1, 0), (8193, 1), (1, 8193), (1, 1)] {
        assert!(png_rgb8(&[], width, height).is_err());
        assert!(jpeg_rgb8(&[], width, height, 90).is_err());
    }
    for quality in [0, 101] {
        assert!(jpeg_rgb8(&[0; 3], 1, 1, quality).is_err());
    }
    for quality in [1, 100] {
        assert!(jpeg_rgb8(&[0; 3], 1, 1, quality).is_ok());
    }
}

#[test]
fn png_transcode_composites_alpha_and_passes_rgb_through() {
    let (width, height) = (3, 1);
    let background = [10, 30, 90];
    let format = ImageFormat::Jpeg { quality: 100 };
    let rgba = [200, 100, 20, 128, 0, 0, 0, 0, 19, 72, 230, 255];
    let rgb = [105, 65, 55, 10, 30, 90, 19, 72, 230];
    let mut png = Vec::new();
    let mut encoder = png::Encoder::new(&mut png, width, height);
    encoder.set_color(ColorType::Rgba);
    let mut writer = encoder.write_header().unwrap();
    writer.write_image_data(&rgba).unwrap();
    writer.finish().unwrap();
    let expected = jpeg_rgb8(&rgb, width, height, 100).unwrap();
    assert_eq!(transcode_png(&png, format, background).unwrap(), expected);
    let opaque = png_rgb8(&rgb, width, height).unwrap();
    assert_eq!(
        transcode_png(&opaque, format, background).unwrap(),
        expected
    );
}

#[test]
fn png_transcode_rejects_truncation_unsupported_color_and_oversize() {
    let format = ImageFormat::Jpeg { quality: 90 };
    let png = png_rgb8(&[10, 20, 30], 1, 1).unwrap();
    for end in [0, 8, png.len() / 2, png.len() - 1] {
        assert!(transcode_png(&png[..end], format, [0; 3]).is_err());
    }
    // IHDR alone is sufficient to reject unsupported images before allocating pixels.
    for (width, height, color, message) in [
        (8193, 1, ColorType::Rgb, "32 megapixel limit"),
        (6000, 6000, ColorType::Rgba, "32 megapixel limit"),
        (1, 1, ColorType::Grayscale, "8-bit RGB or RGBA"),
    ] {
        let mut png = Vec::new();
        let mut encoder = png::Encoder::new(&mut png, width, height);
        encoder.set_color(color);
        drop(encoder.write_header().unwrap());
        let error = transcode_png(&png, format, [0; 3]).unwrap_err();
        assert!(error.to_string().contains(message), "{error}");
    }
}
