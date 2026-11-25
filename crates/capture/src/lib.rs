#![forbid(unsafe_code)]

pub mod census;
pub mod encode;
mod flatten;
pub mod interference;
pub mod interval;
pub mod lattice;
pub mod mesh;
mod mesh_contact;
pub mod nmesh;
pub mod overlay;
pub mod prism;
mod raster;
pub mod report;
pub mod scene;
mod shade;
pub mod tiles;
pub mod tool_view;
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
    render_parsed(&scene::parse_scene(scene)?, format, threads)
}

/// Render and encode a parsed scene. A caller that owns the NCS1 bytes can
/// free them first: a mesh-heavy scene is tens of megabytes.
pub fn render_parsed(
    scene: &scene::Scene,
    format: ImageFormat,
    threads: usize,
) -> Result<CaptureOutput, CaptureError> {
    let (rgb, report) = render_rgb(scene, threads)?;
    let (width, height) = (report.width, report.height);
    let image = match format {
        ImageFormat::Png => encode::png_rgb8(&rgb, width, height),
        ImageFormat::Jpeg { quality } => encode::jpeg_rgb8(&rgb, width, height, quality),
    }
    .map_err(CaptureError)?;
    let json = if scene.hidden.is_empty() {
        report.to_json()
    } else {
        let budget = if scene.analyse {
            u64::from(scene.budget_million_rays) * 1_000_000
        } else {
            24_000_000
        };
        let solid = tool_view::classify(scene);
        let hidden =
            census::resolve_hidden(scene, &report.bodies, scene.target_cell, budget, &solid);
        report.to_json_with_hidden(&hidden)
    };
    Ok(CaptureOutput {
        image,
        report: json,
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
