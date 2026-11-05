use pdf_writer::{Content, Filter, Finish, Name, Pdf, Rect, Ref};
use resvg::{tiny_skia, usvg};
use serde::Deserialize;
use skrifa::MetadataProvider;
use std::collections::BTreeSet;
use std::{io::Cursor, path::Path};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RenderProfile {
    fonts: Vec<String>,
    fallback_fonts: Vec<String>,
    limits: RasterLimits,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RasterLimits {
    max_side: u32,
    max_pixels: u64,
}

fn load_fonts(
    db: &mut usvg::fontdb::Database,
    files: &[&String],
    font_dir: Option<&str>,
    fallback: &[String],
) -> Result<(), String> {
    for file in files {
        db.load_font_file(file).map_err(|e| e.to_string())?;
    }
    if let Some(dir) = font_dir {
        db.load_fonts_dir(dir);
    }
    for path in fallback.iter().filter(|p| Path::new(p).is_file()) {
        let _ = db.load_font_file(path);
    }
    Ok(())
}

pub fn png(
    svg: String,
    scale: f32,
    font_dir: Option<String>,
    fallback: bool,
) -> Result<Vec<u8>, String> {
    let profile: RenderProfile = serde_json::from_str(include_str!(concat!(
        env!("OUT_DIR"),
        "/render-profile.json"
    )))
    .map_err(|error| format!("Invalid embedded render profile: {error}"))?;
    let mut options = usvg::Options::default();
    let fonts = options.fontdb_mut();
    let files: Vec<_> = profile
        .fonts
        .iter()
        .filter(|p| Path::new(p).is_file())
        .collect();
    let fallback_files = if fallback && !(files.is_empty() && font_dir.is_none()) {
        profile.fallback_fonts.as_slice()
    } else {
        &[]
    };
    load_fonts(fonts, &files, font_dir.as_deref(), fallback_files)?;
    if files.is_empty() && font_dir.is_none() {
        fonts.load_system_fonts();
    }
    let sans = if files.iter().any(|p| p.contains("Helvetica")) {
        "Helvetica"
    } else if files.iter().any(|p| p.contains("DejaVuSans")) {
        "DejaVuSans"
    } else {
        "Arial"
    };
    fonts.set_sans_serif_family(sans);
    fonts.set_monospace_family(if files.iter().any(|p| p.contains("Menlo")) {
        "Menlo"
    } else if files.iter().any(|p| p.contains("DejaVuSansMono")) {
        "DejaVuSansMono"
    } else {
        "Consolas"
    });
    options.font_family = sans.into();
    let tree = usvg::Tree::from_str(&svg, &options).map_err(|e| e.to_string())?;
    let width = (tree.size().width() * scale).ceil() as u32;
    let height = (tree.size().height() * scale).ceil() as u32;
    if width == 0
        || height == 0
        || width > profile.limits.max_side
        || height > profile.limits.max_side
        || u64::from(width) * u64::from(height) > profile.limits.max_pixels
    {
        return Err("Raster dimensions exceed the pixel limit".into());
    }
    let mut pixels =
        tiny_skia::Pixmap::new(width, height).ok_or("Cannot allocate render surface")?;
    resvg::render(
        &tree,
        tiny_skia::Transform::from_scale(scale, scale),
        &mut pixels.as_mut(),
    );
    pixels.encode_png().map_err(|e| e.to_string())
}

fn ignored(cp: u32) -> bool {
    cp <= 0x7f
        || (0x200b..=0x200f).contains(&cp)
        || (0x2028..=0x202e).contains(&cp)
        || (0x2060..=0x206f).contains(&cp)
        || (0xfe00..=0xfe0f).contains(&cp)
        || cp == 0xfeff
        || (0xe0100..=0xe01ef).contains(&cp)
}

fn remove_covered(db: &usvg::fontdb::Database, missing: &mut BTreeSet<u32>) {
    for face in db.faces() {
        db.with_face_data(face.id, |data, index| {
            if let Ok(font) = skrifa::FontRef::from_index(data, index) {
                let charmap = font.charmap();
                missing.retain(|cp| charmap.map(*cp).is_none());
            }
        });
        if missing.is_empty() {
            break;
        }
    }
}

pub fn font_coverage(text: &str, font_dir: Option<String>) -> Result<String, String> {
    let mut missing: BTreeSet<u32> = text
        .chars()
        .map(u32::from)
        .filter(|cp| !ignored(*cp))
        .collect();
    if missing.is_empty() {
        return Ok(r#"{"needsFallback":false,"missing":[]}"#.into());
    }
    let profile: RenderProfile = serde_json::from_str(include_str!(concat!(
        env!("OUT_DIR"),
        "/render-profile.json"
    )))
    .map_err(|e| e.to_string())?;
    let files: Vec<_> = profile
        .fonts
        .iter()
        .filter(|p| Path::new(p).is_file())
        .collect();
    if files.is_empty() && font_dir.is_none() {
        return Ok("null".into());
    }
    let mut db = usvg::fontdb::Database::new();
    load_fonts(&mut db, &files, font_dir.as_deref(), &[])?;
    remove_covered(&db, &mut missing);
    let needs_fallback = !missing.is_empty();
    if needs_fallback {
        let mut db = usvg::fontdb::Database::new();
        load_fonts(&mut db, &[], None, &profile.fallback_fonts)?;
        remove_covered(&db, &mut missing);
    }
    serde_json::to_string(&serde_json::json!({"needsFallback": needs_fallback, "missing": missing}))
        .map_err(|e| e.to_string())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Layout {
    page_width: f32,
    page_height: f32,
    x: f32,
    y: f32,
    width: f32,
    height: f32,
}
pub fn pdf(png: Vec<u8>, layout: String) -> Result<Vec<u8>, String> {
    let layout: Layout = serde_json::from_str(&layout).map_err(|e| e.to_string())?;
    let decoder = png::Decoder::new(Cursor::new(png));
    let mut reader = decoder.read_info().map_err(|e| e.to_string())?;
    let mut buffer = vec![0; reader.output_buffer_size().ok_or("Invalid PNG size")?];
    let image = reader.next_frame(&mut buffer).map_err(|e| e.to_string())?;
    if image.color_type != png::ColorType::Rgba {
        return Err("Expected RGBA PNG from native renderer".into());
    }
    let mut rgb = Vec::with_capacity(image.width as usize * image.height as usize * 3);
    let mut alpha = Vec::with_capacity(image.width as usize * image.height as usize);
    for pixel in buffer[..image.buffer_size()].as_chunks::<4>().0 {
        rgb.extend_from_slice(&pixel[..3]);
        alpha.push(pixel[3]);
    }
    let rgb = miniz_oxide::deflate::compress_to_vec_zlib(&rgb, 6);
    let alpha = miniz_oxide::deflate::compress_to_vec_zlib(&alpha, 6);
    let mut pdf = Pdf::new();
    pdf.catalog(Ref::new(1)).pages(Ref::new(2));
    pdf.pages(Ref::new(2)).kids([Ref::new(3)]).count(1);
    let mut page = pdf.page(Ref::new(3));
    page.parent(Ref::new(2))
        .media_box(Rect::new(0., 0., layout.page_width, layout.page_height))
        .contents(Ref::new(6));
    page.resources()
        .x_objects()
        .pair(Name(b"Image"), Ref::new(4));
    page.finish();
    let mut image_obj = pdf.image_xobject(Ref::new(4), &rgb);
    image_obj.filter(Filter::FlateDecode);
    image_obj
        .width(image.width as i32)
        .height(image.height as i32)
        .bits_per_component(8)
        .s_mask(Ref::new(5));
    image_obj.color_space().device_rgb();
    image_obj.finish();
    let mut mask = pdf.image_xobject(Ref::new(5), &alpha);
    mask.filter(Filter::FlateDecode);
    mask.width(image.width as i32)
        .height(image.height as i32)
        .bits_per_component(8);
    mask.color_space().device_gray();
    mask.finish();
    let mut content = Content::new();
    content
        .save_state()
        .transform([layout.width, 0., 0., layout.height, layout.x, layout.y])
        .x_object(Name(b"Image"))
        .restore_state();
    pdf.stream(Ref::new(6), &content.finish());
    pdf.document_info(Ref::new(7))
        .creator(pdf_writer::TextStr("Nodetto"));
    Ok(pdf.finish())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_fallback_gate() {
        fn image(text: &str, fallback: bool) -> Vec<u8> {
            let profile: RenderProfile = serde_json::from_str(include_str!(concat!(
                env!("OUT_DIR"),
                "/render-profile.json"
            )))
            .unwrap();
            let mut options = usvg::Options::default();
            let db = options.fontdb_mut();
            for path in profile.fonts.iter().filter(|p| Path::new(p).is_file()) {
                db.load_font_file(path).unwrap();
            }
            if fallback {
                for path in [
                    "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc",
                    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
                    "/System/Library/Fonts/Apple Symbols.ttf",
                ] {
                    db.load_font_file(path).unwrap();
                }
            }
            db.set_sans_serif_family("Helvetica");
            options.font_family = "Helvetica".into();
            let svg = format!(
                r#"<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><text x="5" y="35" font-family="Helvetica" font-size="30">{text}</text></svg>"#
            );
            let tree = usvg::Tree::from_str(&svg, &options).unwrap();
            let mut pixmap = tiny_skia::Pixmap::new(100, 50).unwrap();
            resvg::render(
                &tree,
                tiny_skia::Transform::identity(),
                &mut pixmap.as_mut(),
            );
            pixmap.encode_png().unwrap()
        }
        assert_ne!(image("⑪", true), image("⑫", true));
        assert_eq!(image("A中", false), image("A中", true));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_text_run_characterization() {
        let render = |body: &str, fallback| {
            png(format!(r#"<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50" viewBox="0 0 100 50">{body}</svg>"#), 1.0, None, fallback).unwrap()
        };
        let text = |value: &str, x: i32, y: i32| {
            format!(
                r#"<text x="{x}" y="{y}" font-family="Helvetica" font-size="30">{value}</text>"#
            )
        };
        let separate = format!("{}{}", text("A", 5, 35), text("⑪", 150, 35));
        assert_eq!(render(&separate, false), render(&separate, true));
        assert_eq!(
            render(&text("A中", 5, 35), false),
            render(&text("A中", 5, 35), true)
        );
        assert_ne!(
            render(&text("A⑪", 5, 35), true),
            render(&text("A⑫", 5, 35), true)
        );
        let lines = |second| format!("{}{}", text("Idle", 5, 35), text(second, 5, 90));
        assert_eq!(render(&lines("⑪"), true), render(&lines("X"), true));
        let cropped = |value: &str| {
            png(format!(r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="50" viewBox="0 0 24 50">{}</svg>"#, text(value, 5, 35)), 1.0, None, true).unwrap()
        };
        println!(
            "native mixed run differs from plain A: {}",
            cropped("A⑪") != cropped("A")
        );
    }

    #[test]
    fn font_coverage_handles_missing_and_ignored_characters() {
        let dir = tempfile::tempdir().unwrap();
        let value: serde_json::Value = serde_json::from_str(
            &font_coverage("\u{f0000}", Some(dir.path().to_string_lossy().into_owned())).unwrap(),
        )
        .unwrap();
        assert_eq!(value["needsFallback"], true);
        assert_eq!(value["missing"], serde_json::json!([0xf0000]));
        for text in ["ASCII", "\u{200b}"] {
            let value: serde_json::Value =
                serde_json::from_str(&font_coverage(text, None).unwrap()).unwrap();
            assert_eq!(
                value,
                serde_json::json!({"needsFallback": false, "missing": []})
            );
        }
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_png_fallback_renders_distinct_glyphs() {
        let svg = |text| {
            format!(
                r#"<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><text x="5" y="35" font-family="Helvetica" font-size="30">{text}</text></svg>"#
            )
        };
        assert_ne!(
            png(svg("⑪"), 1.0, None, true).unwrap(),
            png(svg("⑫"), 1.0, None, true).unwrap()
        );
        let text: String = (0x2460..=0x2473)
            .chain([0x301c, 0xff5e])
            .filter_map(char::from_u32)
            .collect();
        let coverage: serde_json::Value =
            serde_json::from_str(&font_coverage(&text, None).unwrap()).unwrap();
        assert_eq!(coverage["missing"], serde_json::json!([]));
    }

    #[test]
    fn native_raster_limits_reject_oversized_surfaces_before_allocation() {
        // Exercise native guards directly: the shared TS command layer normally
        // rejects these dimensions before calling the renderer.
        for (width, height) in [(8193, 1), (1, 8193), (6000, 6000)] {
            let svg = format!(
                r#"<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}"/>"#
            );
            assert_eq!(
                png(svg, 1.0, None, false).unwrap_err(),
                "Raster dimensions exceed the pixel limit"
            );
        }
    }
}
