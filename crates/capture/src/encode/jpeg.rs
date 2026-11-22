use jpeg_encoder::{ColorType, Encoder, SamplingFactor};

use super::validate_rgb8;

pub fn jpeg_rgb8(rgb: &[u8], width: u32, height: u32, quality: u8) -> Result<Vec<u8>, String> {
    validate_rgb8(rgb, width, height)?;
    if !(1..=100).contains(&quality) {
        return Err("JPG quality must be an integer from 1 to 100.".into());
    }

    let mut output = Vec::new();
    let mut encoder = Encoder::new(&mut output, quality);
    encoder.set_sampling_factor(SamplingFactor::R_4_4_4);
    encoder
        .encode(rgb, width as u16, height as u16, ColorType::Rgb)
        .map_err(|error| error.to_string())?;
    Ok(output)
}
