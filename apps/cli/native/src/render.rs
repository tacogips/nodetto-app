use base64::Engine;
use pdf_writer::{Content, Filter, Finish, Name, Pdf, Rect, Ref};
use resvg::{tiny_skia, usvg};
use serde::Deserialize;
use skrifa::MetadataProvider;
use std::collections::BTreeSet;
use std::{io::Cursor, path::Path, sync::Arc};

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

type CaptureAsset = (String, Arc<Vec<u8>>);

fn capture_assets(svg: &str) -> Result<Vec<CaptureAsset>, String> {
    const PREFIX: &str = "<image id=\"nodetto-capture-asset-";
    let invalid = || "Invalid raster attachment.".to_string();
    let mut rest = svg;
    let mut assets = Vec::new();
    while let Some(start) = rest.find(PREFIX) {
        rest = &rest[start + PREFIX.len()..];
        let (index, tail) = rest
            .split_once("\" href=\"data:image/")
            .ok_or_else(invalid)?;
        if index != assets.len().to_string() {
            return Err(invalid());
        }
        let (subtype, tail) = tail.split_once(";base64,").ok_or_else(invalid)?;
        if !matches!(subtype, "png" | "jpeg" | "gif" | "webp") {
            return Err(invalid());
        }
        let (payload, tail) = tail.split_once("\"/>").ok_or_else(invalid)?;
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(payload)
            .map_err(|_| invalid())?;
        assets.push((format!("image/{subtype}"), Arc::new(bytes)));
        rest = tail;
    }
    Ok(assets)
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
        "DejaVu Sans"
    } else {
        "Arial"
    };
    fonts.set_sans_serif_family(sans);
    fonts.set_monospace_family(if files.iter().any(|p| p.contains("Menlo")) {
        "Menlo"
    } else if files.iter().any(|p| p.contains("DejaVuSansMono")) {
        "DejaVu Sans Mono"
    } else {
        "Consolas"
    });
    options.font_family = sans.into();
    let assets = capture_assets(&svg)?;
    if !assets.is_empty() {
        options.image_href_resolver = usvg::ImageHrefResolver {
            resolve_data: usvg::ImageHrefResolver::default_data_resolver(),
            resolve_string: Box::new(move |href, opts| {
                if let Some(index) = href.strip_prefix("https://nodetto.invalid/capture-asset/") {
                    return index
                        .parse::<usize>()
                        .ok()
                        .and_then(|index| assets.get(index))
                        .and_then(|(mime, bytes)| {
                            (usvg::ImageHrefResolver::default_data_resolver())(
                                mime,
                                Arc::clone(bytes),
                                opts,
                            )
                        });
                }
                (usvg::ImageHrefResolver::default_string_resolver())(href, opts)
            }),
        };
    }
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
struct PdfImage {
    width: u32,
    height: u32,
    rgb: Vec<u8>,
    alpha: Vec<u8>,
}

fn decode_pdf_image(png: &[u8]) -> Result<PdfImage, String> {
    let decoder = png::Decoder::new(Cursor::new(png));
    let mut reader = decoder.read_info().map_err(|e| e.to_string())?;
    let profile: RenderProfile = serde_json::from_str(include_str!(concat!(
        env!("OUT_DIR"),
        "/render-profile.json"
    )))
    .map_err(|e| e.to_string())?;
    let (width, height) = (reader.info().width, reader.info().height);
    if width == 0
        || height == 0
        || width > profile.limits.max_side
        || height > profile.limits.max_side
        || u64::from(width) * u64::from(height) > profile.limits.max_pixels
    {
        return Err("Raster dimensions exceed the pixel limit".into());
    }
    let mut buffer = vec![0; reader.output_buffer_size().ok_or("Invalid PNG size")?];
    let image = reader.next_frame(&mut buffer).map_err(|e| e.to_string())?;
    if image.color_type != png::ColorType::Rgba {
        return Err("Expected RGBA PNG from native renderer".into());
    }
    let mut rgb = Vec::with_capacity(width as usize * height as usize * 3);
    let mut alpha = Vec::with_capacity(width as usize * height as usize);
    for pixel in buffer[..image.buffer_size()].as_chunks::<4>().0 {
        rgb.extend_from_slice(&pixel[..3]);
        alpha.push(pixel[3]);
    }
    Ok(PdfImage {
        width,
        height,
        rgb: miniz_oxide::deflate::compress_to_vec_zlib(&rgb, 6),
        alpha: miniz_oxide::deflate::compress_to_vec_zlib(&alpha, 6),
    })
}

fn write_pdf_image(pdf: &mut Pdf, image: &PdfImage, image_ref: Ref, mask_ref: Ref) {
    let mut image_obj = pdf.image_xobject(image_ref, &image.rgb);
    image_obj.filter(Filter::FlateDecode);
    image_obj
        .width(image.width as i32)
        .height(image.height as i32)
        .bits_per_component(8)
        .s_mask(mask_ref);
    image_obj.color_space().device_rgb();
    image_obj.finish();
    let mut mask = pdf.image_xobject(mask_ref, &image.alpha);
    mask.filter(Filter::FlateDecode);
    mask.width(image.width as i32)
        .height(image.height as i32)
        .bits_per_component(8);
    mask.color_space().device_gray();
    mask.finish();
}

pub fn pdf(png: Vec<u8>, layout: String) -> Result<Vec<u8>, String> {
    let layout: Layout = serde_json::from_str(&layout).map_err(|e| e.to_string())?;
    let image = decode_pdf_image(&png)?;
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
    write_pdf_image(&mut pdf, &image, Ref::new(4), Ref::new(5));
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

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PdfSpec {
    pages: Vec<PdfPage>,
    fonts: Vec<PdfFont>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PdfPage {
    png_length: usize,
    layout: Layout,
    font_names: Vec<String>,
    content: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PdfFont {
    name: String,
    first_char: i32,
    last_char: i32,
    widths: Vec<f32>,
    glyph_procs: Vec<PdfGlyph>,
    differences: Vec<String>,
    to_unicode: String,
}
#[derive(Deserialize)]
struct PdfGlyph {
    glyph: String,
    content: String,
}

pub fn pdf_pages(pngs: Vec<u8>, spec_json: String) -> Result<Vec<u8>, String> {
    let spec: PdfSpec = serde_json::from_str(&spec_json).map_err(|e| e.to_string())?;
    if spec.pages.is_empty() || spec.pages.len() > 500 {
        return Err("Invalid PDF page count".into());
    }
    let total = spec
        .pages
        .iter()
        .try_fold(0usize, |n, p| n.checked_add(p.png_length))
        .ok_or("Invalid PNG lengths")?;
    if total != pngs.len() {
        return Err("PNG lengths do not match input".into());
    }
    let mut fonts = std::collections::BTreeMap::new();
    let mut next = 3i32 + 4 * spec.pages.len() as i32;
    for font in &spec.fonts {
        if font.name.is_empty()
            || font.first_char != 1
            || !(1..=255).contains(&font.last_char)
            || font.widths.len() != font.last_char as usize
            || font.differences.len() != font.widths.len()
            || font.glyph_procs.len() != font.widths.len()
            || fonts.contains_key(&font.name)
        {
            return Err("Invalid PDF font".into());
        }
        fonts.insert(font.name.clone(), Ref::new(next));
        next += 2 + font.glyph_procs.len() as i32;
    }
    for page in &spec.pages {
        if page.font_names.iter().any(|name| !fonts.contains_key(name)) {
            return Err("Unknown PDF font".into());
        }
        let l = &page.layout;
        if ![l.page_width, l.page_height, l.x, l.y, l.width, l.height]
            .iter()
            .all(|v| v.is_finite())
            || l.page_width <= 0.
            || l.page_height <= 0.
            || l.width <= 0.
            || l.height <= 0.
        {
            return Err("Invalid PDF layout".into());
        }
    }
    let mut pdf = Pdf::new();
    pdf.catalog(Ref::new(1)).pages(Ref::new(2));
    pdf.pages(Ref::new(2))
        .kids((0..spec.pages.len()).map(|i| Ref::new(3 + 4 * i as i32)))
        .count(spec.pages.len() as i32);
    let mut offset = 0;
    for (i, page) in spec.pages.iter().enumerate() {
        let base = 3 + 4 * i as i32;
        let image = decode_pdf_image(&pngs[offset..offset + page.png_length])?;
        offset += page.png_length;
        let mut obj = pdf.page(Ref::new(base));
        obj.parent(Ref::new(2))
            .media_box(Rect::new(
                0.,
                0.,
                page.layout.page_width,
                page.layout.page_height,
            ))
            .contents(Ref::new(base + 3));
        let mut resources = obj.resources();
        resources
            .x_objects()
            .pair(Name(b"Image"), Ref::new(base + 1));
        {
            let mut font_dict = resources.fonts();
            for name in &page.font_names {
                font_dict.pair(Name(name.as_bytes()), fonts[name]);
            }
        }
        resources.finish();
        obj.finish();
        write_pdf_image(&mut pdf, &image, Ref::new(base + 1), Ref::new(base + 2));
        let mut content = Content::new();
        content
            .save_state()
            .transform([
                page.layout.width,
                0.,
                0.,
                page.layout.height,
                page.layout.x,
                page.layout.y,
            ])
            .x_object(Name(b"Image"))
            .restore_state();
        let mut stream = content.finish().to_vec();
        stream.push(b'\n');
        stream.extend_from_slice(page.content.as_bytes());
        pdf.stream(Ref::new(base + 3), &stream);
    }
    for font in &spec.fonts {
        let base = fonts[&font.name].get();
        let mut dict = pdf.indirect(Ref::new(base)).dict();
        dict.pair(Name(b"Type"), Name(b"Font"))
            .pair(Name(b"Subtype"), Name(b"Type3"));
        dict.insert(Name(b"FontMatrix"))
            .array()
            .items([0.001f32, 0., 0., 0.001, 0., 0.]);
        dict.insert(Name(b"FontBBox")).array().items([0, 0, 0, 0]);
        dict.pair(Name(b"FirstChar"), font.first_char)
            .pair(Name(b"LastChar"), font.last_char);
        dict.insert(Name(b"Widths"))
            .array()
            .items(font.widths.iter().copied());
        {
            let mut encoding = dict.insert(Name(b"Encoding")).dict();
            encoding.pair(Name(b"Type"), Name(b"Encoding"));
            let mut differences = encoding.insert(Name(b"Differences")).array();
            differences.item(1);
            for glyph in &font.differences {
                differences.item(Name(glyph.as_bytes()));
            }
        }
        {
            let mut procs = dict.insert(Name(b"CharProcs")).dict();
            for (i, glyph) in font.glyph_procs.iter().enumerate() {
                procs.pair(Name(glyph.glyph.as_bytes()), Ref::new(base + 2 + i as i32));
            }
        }
        dict.pair(Name(b"ToUnicode"), Ref::new(base + 1));
        dict.finish();
        pdf.stream(Ref::new(base + 1), font.to_unicode.as_bytes());
        for (i, glyph) in font.glyph_procs.iter().enumerate() {
            pdf.stream(Ref::new(base + 2 + i as i32), glyph.content.as_bytes());
        }
    }
    Ok(pdf.finish())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn capture_carrier_validation() {
        let carrier = r#"<image id="nodetto-capture-asset-0" href="data:image/png;base64,AQ=="/>"#;
        let svg = format!(
            "{carrier}{}",
            r#"<image href="https://nodetto.invalid/capture-asset/0"/>"#.repeat(32)
        );
        assert_eq!(capture_assets(&svg).unwrap().len(), 1);
        for invalid in [
            carrier.replace("asset-0", "asset-1"),
            carrier.replace("image/png", "image/svg"),
            carrier.replace("AQ==", "!!!!"),
            carrier.replace("/>", "> "),
        ] {
            assert_eq!(
                capture_assets(&invalid).unwrap_err(),
                "Invalid raster attachment."
            );
        }
        assert!(capture_assets("<svg/>").unwrap().is_empty());
    }

    #[test]
    fn capture_carrier_matches_inline_images() {
        let jpeg = nodetto_capture::encode::jpeg_rgb8(
            &[255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 0],
            2,
            2,
            90,
        )
        .unwrap();
        let cases = [
            ("png", base64::engine::general_purpose::STANDARD.encode(test_png())),
            ("jpeg", base64::engine::general_purpose::STANDARD.encode(jpeg)),
            ("gif", "R0lGODlhAgACAIAAAAAAAP///yH5BAAAAAAALAAAAAACAAIAAAIDhI9WADs=".to_string()),
            ("webp", "UklGRtYEAABXRUJQVlA4TMkEAAAvH8AHEE2oaduA6ThT/ozLIaL/WXDe3kIgkORPO8EcCtq2YbyLYPxRDoDSNpKcudB/jYfzo8f9D4976ZCk1zz6fN75FvlkgIeO+3+KZOe/9MjMzEyRI4aY7dwOmRkiZjgAXcEHYGZmZmaG0U5XBb1mH+DfcjbzS82tf+yWVaHhl271ShXPu8E7gEeqfCQ4tq0de+59f9tJOlutnQmkNqdgO+NIm86lVTq1bft7H6i2bStb1jrfjzukf5BJ/Ikv8qg8Ddkdold3uxtqtm3LlvP5seTW3TONDlOQXTLdZQGmcB3BkrtEZ4GPZwIEhP5AXg/KN9tqlW+Hp0JXeVjK1zzPVrOS+vKb1rBP5QvuRYIrcoK17VP5tHfFemeL+XnVX247tFUI+P9KF25etVy/dLlyiXd02vmvPif401EeTUF5okD520GOIToKhCMcMKbCsS4nyc4yvwtrAn6+7D2D1s8xGP7EoO8zKTAPZHpGgHlEZm4z8xghprqcjzYq4GKmFU2+CCu67CjB3GaGXx0C9mtDNsiYgFcrKIcE/JYEfIyb62RCQhCq4VfzQGhHzG1rHDFzBKEmmHkBC6XzrmpuoYl7z6J/9S2EXw201tBMo1kvo7x313z0IDoF/jqm6vrajLsBAamq98p+1bRBV9M0lhc6Y924CK1ZZdm60GF9547oO3Tk6I6FoS+5tSA6fTdMUqaqKhjqSjC3I57SHeee/Tuw9V8VsoVgHWD9tAdXTIx8/K5tiu6FAAbBttJqzsd0EqPGzDaIDdGxW1Gzf3XTBua2mmR55HDefm0HCvuPB9ZXWUV46Kmf2SjpyGzUVF4Q4+6V/3YsguUQrP/04oZHFnofbW36+HEaCDolQa/08uOrLtF4hrU2y8gjG37tXNCYZebVQjqgcMXeudOYQE+1r/8TpU54mKIba5ocYrx1u/PJB+KR9X92yQ+YhRgjQLCvZcGVAhhZbozxuTOdlDPuk6+IR9b92jVPoTIyJiKB72qitPbdVLZsWkOMfPlMx+dM+uQT8ajqslUyDIwRJAgtP+1dU0BWWTYvIu3lG502FaKBU62d9U3FUyCAVCF9DKK03tlZFizZQrDBgBYfOykXzolLAeckawOT4AF6JQKsBSg/Glj3Y2BuK/7ThsoJrtvXhRpYWppzErEBgFnUZJ0/JVHa0LOXwsZyMBsMnCibJwbXG3GRBpeS2F435JAgoeV7T3oFFcyqUBjqaq0VEpnAa0UXqAFiFp4Ca8QvQJQ2dZMFiiMCbLccvfOE23exXbIIcCiC64ArVSE5JMg5nRE0C7VqjUQ41Rn+c6nqXKUKHmQBEpg6IEpSitYcZfnqfdxxpJWiOxdMwwMghxj+c4l5zMFXk86wjhvSE4TOJ1naFRSF8m6urUjUvZpIFMSAXpB6FEokhBCRU3laKoaykoAUqZMlFYiEfgJr9lLkoM/e4t44IVJbOuM7Ua6OMfdzRAJSnzWpkQP2kjB6SwpTPXUtHMwk4H3a6uQkuf+fNVH3kBCVMcX+QMcpR58mwYZ+qYCTj4M1Mq7a5iTy4GCnpbqfKnKWDiVSRIt/csKRONnRryjg+fo0xj5wjg1OBah234Y6EKoehKoTQlW+1QF+WWAnx79Sr19dQCHgT7+3AA==".to_string()),
        ];
        for (mime, payload) in cases {
            let data = format!("data:image/{mime};base64,{payload}");
            let carrier =
                format!(r#"<defs><image id="nodetto-capture-asset-0" href="{data}"/></defs>"#);
            for mode in ["xMidYMid meet", "xMidYMid slice", "none", "crop"] {
                let placement = |href: &str| {
                    if mode == "crop" {
                        format!(
                            r#"<svg x="3" y="2" width="11" height="8" viewBox="1 1 5 4" overflow="hidden"><image width="12" height="10" href="{href}"/></svg>"#
                        )
                    } else {
                        format!(
                            r#"<image x="1" y="2" width="12" height="9" preserveAspectRatio="{mode}" href="{href}"/><image x="15" y="1" width="7" height="14" preserveAspectRatio="{mode}" href="{href}"/>"#
                        )
                    }
                };
                let wrap = |body: String| {
                    format!(
                        r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="18">{body}</svg>"#
                    )
                };
                let inline = wrap(placement(&data));
                let shared = wrap(format!(
                    "{carrier}{}",
                    placement("https://nodetto.invalid/capture-asset/0")
                ));
                for scale in [1.0, 2.37] {
                    let expected = png(inline.clone(), scale, None, false).unwrap();
                    let actual = png(shared.clone(), scale, None, false).unwrap();
                    assert_eq!(actual, expected, "{mime} {mode} {scale}");
                    let transcode = |bytes| {
                        nodetto_capture::transcode_png(
                            bytes,
                            nodetto_capture::ImageFormat::Jpeg { quality: 90 },
                            [255, 255, 255],
                        )
                        .unwrap()
                    };
                    assert_eq!(transcode(&actual), transcode(&expected));
                }
            }
        }
    }

    fn test_png() -> Vec<u8> {
        let mut bytes = Vec::new();
        {
            let mut encoder = png::Encoder::new(&mut bytes, 1, 1);
            encoder.set_color(png::ColorType::Rgba);
            encoder.set_depth(png::BitDepth::Eight);
            let mut writer = encoder.write_header().unwrap();
            writer.write_image_data(&[12, 34, 56, 128]).unwrap();
        }
        bytes
    }
    fn test_spec(length: usize) -> String {
        serde_json::json!({"pages": (0..2).map(|_| serde_json::json!({"pngLength":length,"layout":{"pageWidth":100,"pageHeight":200,"x":0,"y":0,"width":100,"height":200},"fontNames":["NTm1"],"content":"BT /NTm1 12 Tf <01> Tj ET"})).collect::<Vec<_>>(), "fonts":[{"name":"NTm1","firstChar":1,"lastChar":1,"widths":[600],"glyphProcs":[{"glyph":"g1","content":"600 0 d0"}],"differences":["g1"],"toUnicode":"<01> <65E5>"}]}).to_string()
    }
    #[test]
    fn pdf_pages_produces_unicode_text_and_rejects_invalid_input() {
        let png = test_png();
        let mut both = png.clone();
        both.extend_from_slice(&png);
        let output = pdf_pages(both.clone(), test_spec(png.len())).unwrap();
        assert!(output.starts_with(b"%PDF-"));
        let text = String::from_utf8_lossy(&output);
        for expected in ["/Count 2", "/Type3", "/ToUnicode", "<01> <65E5>", "Tj"] {
            assert!(text.contains(expected), "missing {expected}");
        }
        assert_eq!(text.matches("/MediaBox").count(), 2);
        assert!(pdf_pages(both.clone(), test_spec(png.len() + 1)).is_err());
        assert!(pdf_pages(both.clone(), "{}".into()).is_err());
        assert!(pdf_pages(vec![], r#"{"pages":[],"fonts":[]}"#.into()).is_err());
        assert!(pdf_pages(
            both,
            test_spec(png.len()).replace("NTm1\"],", "missing\"],")
        )
        .is_err());
    }
    #[test]
    fn pdf_single_page_remains_byte_identical() {
        let layout = r#"{"pageWidth":100,"pageHeight":200,"x":0,"y":0,"width":100,"height":200}"#;
        assert_eq!(
            pdf(test_png(), layout.into()).unwrap(),
            legacy_pdf(test_png(), layout.into()).unwrap()
        );
    }
    fn legacy_pdf(png: Vec<u8>, layout: String) -> Result<Vec<u8>, String> {
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
