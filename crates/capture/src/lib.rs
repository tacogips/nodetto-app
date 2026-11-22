#![forbid(unsafe_code)]

pub mod encode;
mod flatten;
pub mod scene;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ImageFormat {
    Png,
    Jpeg { quality: u8 },
}

#[derive(Debug)]
pub struct CaptureError(pub String);

impl std::fmt::Display for CaptureError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

impl std::error::Error for CaptureError {}

/// Preserve PNG bytes or composite an 8-bit RGB/RGBA PNG onto a background and encode it as JPEG.
pub fn transcode_png(
    png: &[u8],
    format: ImageFormat,
    background: [u8; 3],
) -> Result<Vec<u8>, CaptureError> {
    match format {
        ImageFormat::Png => Ok(png.to_vec()),
        ImageFormat::Jpeg { quality } => {
            let (rgb, width, height) = flatten::png_to_rgb8(png, background)?;
            encode::jpeg_rgb8(&rgb, width, height, quality).map_err(CaptureError)
        }
    }
}
