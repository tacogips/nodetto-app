mod jpeg;
mod png;

pub use self::{jpeg::jpeg_rgb8, png::png_rgb8};

pub(crate) const MAX_SIDE: u32 = 8192;

fn validate_rgb8(rgb: &[u8], width: u32, height: u32) -> Result<(), String> {
    if !(1..=MAX_SIDE).contains(&width) || !(1..=MAX_SIDE).contains(&height) {
        return Err(format!(
            "Image dimensions must be between 1 and {MAX_SIDE} pixels per side."
        ));
    }
    if rgb.len() != (width * height * 3) as usize {
        return Err("RGB buffer length must be three bytes per pixel.".into());
    }
    Ok(())
}
