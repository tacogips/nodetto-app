use nodetto_capture::{render_scene, ImageFormat};

#[derive(serde::Serialize)]
pub struct CaptureReply {
    pub image: Vec<u8>,
    pub report: String,
}

pub fn capture_solid_blocking(
    scene: &[u8],
    format: &str,
    quality: u8,
) -> Result<CaptureReply, String> {
    if !(1..=100).contains(&quality) {
        return Err("quality must be between 1 and 100".to_owned());
    }
    let format = match format {
        "png" => ImageFormat::Png,
        "jpg" => ImageFormat::Jpeg { quality },
        _ => return Err("format must be png or jpg".to_owned()),
    };
    let result = render_scene(scene, format, 0).map_err(|error| error.to_string())?;
    Ok(CaptureReply {
        image: result.image,
        report: result.report,
    })
}

#[tauri::command]
pub async fn capture_solid(
    scene: Vec<u8>,
    format: String,
    quality: u8,
) -> Result<CaptureReply, String> {
    tauri::async_runtime::spawn_blocking(move || capture_solid_blocking(&scene, &format, quality))
        .await
        .map_err(|error| error.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    const SCENE: &[u8] = include_bytes!("../../../../crates/capture/tests/fixtures/plate-iso.ncs1");

    #[test]
    fn capture_matches_direct_render() {
        let actual = capture_solid_blocking(SCENE, "png", 90).unwrap();
        let expected = render_scene(SCENE, ImageFormat::Png, 0).unwrap();
        assert_eq!(actual.image, expected.image);
        assert_eq!(actual.report, expected.report);
        assert_eq!(&actual.image[..8], b"\x89PNG\r\n\x1a\n");
        assert_eq!(&actual.image[16..24], &[0, 0, 4, 0, 0, 0, 3, 0]);
        assert!(!actual.report.is_empty());
    }

    #[test]
    fn capture_rejects_invalid_inputs() {
        assert!(capture_solid_blocking(SCENE, "gif", 90).is_err());
        assert!(capture_solid_blocking(SCENE, "png", 0).is_err());
        assert!(capture_solid_blocking(SCENE, "jpg", 101).is_err());
        assert!(capture_solid_blocking(&SCENE[..8], "png", 90).is_err());
    }
}
