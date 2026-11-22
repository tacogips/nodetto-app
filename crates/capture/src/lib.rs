#![forbid(unsafe_code)]

pub mod encode;
mod flatten;
pub mod interval;
pub mod prism;
mod raster;
pub mod report;
pub mod scene;
mod shade;
pub mod view;

pub use raster::render_rgb;

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

pub struct CaptureOutput {
    pub image: Vec<u8>,
    pub report: String,
}

/// Render and encode NCS1. Zero threads uses available parallelism, capped at eight.
pub fn render_scene(
    scene: &[u8],
    format: ImageFormat,
    threads: usize,
) -> Result<CaptureOutput, CaptureError> {
    let scene = scene::parse_scene(scene)?;
    let (rgb, report) = render_rgb(&scene, threads)?;
    let (width, height) = (report.width, report.height);
    let image = match format {
        ImageFormat::Png => encode::png_rgb8(&rgb, width, height),
        ImageFormat::Jpeg { quality } => encode::jpeg_rgb8(&rgb, width, height, quality),
    }
    .map_err(CaptureError)?;
    Ok(CaptureOutput {
        image,
        report: report.to_json(),
    })
}

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
