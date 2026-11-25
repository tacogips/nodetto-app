use crate::{files, render};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use boa_engine::{
    builtins::promise::PromiseState,
    context::HostHooks,
    js_string,
    object::builtins::{JsArray, JsPromise, JsUint8Array},
    Context, JsArgs, JsNativeError, JsResult, JsValue, NativeFunction, Source,
};
use nodetto_capture::{render_parsed, scene::parse_scene, transcode_png, ImageFormat};
use serde::{Deserialize, Serialize};
use std::{
    cell::{Cell, RefCell},
    io::Read,
    path::PathBuf,
    rc::Rc,
};

pub(crate) const MCP_INLINE_MAX_BYTES: usize = 1_048_576;
pub struct CaptureWrite {
    pub path: PathBuf,
    pub len: u64,
    pub bytes: Option<Vec<u8>>,
}
use unicode_segmentation::UnicodeSegmentation;
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandResult {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
}
impl CommandResult {
    pub fn error(message: impl std::fmt::Display) -> Self {
        Self {
            exit_code: 2,
            stdout: String::new(),
            stderr: format!("nodetto-cli: {message}\n"),
        }
    }
}

pub enum Input {
    Terminal,
    Mcp(Option<String>),
}

struct HostState {
    input: Input,
    directory: PathBuf,
    retain_capture: Cell<bool>,
    capture: RefCell<Option<CaptureWrite>>,
}

fn host_error(error: impl std::fmt::Display) -> boa_engine::JsError {
    let message = error.to_string();
    let hint =
        if message.contains("Operation not permitted") || message.contains("Permission denied") {
            " Run nodetto-cli authorize <project-folder> to grant Store CLI access."
        } else {
            ""
        };
    JsNativeError::error()
        .with_message(format!("{message}{hint}"))
        .into()
}

fn string(args: &[JsValue], index: usize, ctx: &mut Context) -> JsResult<String> {
    Ok(args
        .get_or_undefined(index)
        .to_string(ctx)?
        .to_std_string_lossy())
}
fn optional_string(args: &[JsValue], index: usize, ctx: &mut Context) -> JsResult<Option<String>> {
    if args.get_or_undefined(index).is_undefined() {
        Ok(None)
    } else {
        string(args, index, ctx).map(Some)
    }
}
fn bytes(value: &JsValue, ctx: &mut Context) -> JsResult<Vec<u8>> {
    let object = value
        .as_object()
        .ok_or_else(|| JsNativeError::typ().with_message("Expected Uint8Array"))?;
    JsUint8Array::from_object(object)?.to_vec(ctx)
}
fn byte_value(bytes: Vec<u8>, ctx: &mut Context) -> JsResult<JsValue> {
    Ok(JsUint8Array::from_iter(bytes, ctx)?.into())
}

fn capture_format(args: &[JsValue], ctx: &mut Context) -> JsResult<ImageFormat> {
    match string(args, 1, ctx)?.as_str() {
        "png" => Ok(ImageFormat::Png),
        "jpg" => {
            let quality = args.get_or_undefined(2).to_number(ctx)?;
            if !(1.0..=100.0).contains(&quality) || quality.fract() != 0.0 {
                return Err(host_error("JPG quality must be an integer from 1 to 100."));
            }
            Ok(ImageFormat::Jpeg {
                quality: quality as u8,
            })
        }
        _ => Err(host_error("Capture format must be png or jpg.")),
    }
}

// Context-owned Rust data avoids unsafe native closures or global mutable state.
// No JavaScript object is retained outside Boa's garbage-collected handles.
fn host(_this: &JsValue, args: &[JsValue], ctx: &mut Context) -> JsResult<JsValue> {
    let operation = string(args, 0, ctx)?;
    let args = args.get(1..).unwrap_or_default();
    match operation.as_str() {
        "path" | "captureAbsolute" => {
            let path = string(args, 0, ctx)?;
            let directory = &ctx
                .get_data::<HostState>()
                .expect("host state installed")
                .directory;
            let path = directory.join(path);
            let path = if operation == "captureAbsolute" {
                std::path::absolute(path).map_err(host_error)?
            } else {
                path
            };
            Ok(js_string!(path.to_string_lossy().as_ref()).into())
        }
        "readText" => Ok(js_string!(
            std::fs::read_to_string(string(args, 0, ctx)?).map_err(host_error)?
        )
        .into()),
        "readBytes" => byte_value(
            std::fs::read(string(args, 0, ctx)?).map_err(host_error)?,
            ctx,
        ),
        "listDir" => {
            let names = files::list_dir(&string(args, 0, ctx)?).map_err(host_error)?;
            Ok(js_string!(serde_json::to_string(&names).map_err(host_error)?).into())
        }
        "exists" => Ok(std::path::Path::new(&string(args, 0, ctx)?).exists().into()),
        "writeBytes" => {
            let path = string(args, 0, ctx)?;
            let data = bytes(args.get_or_undefined(1), ctx)?;
            files::write_atomic(&path, &data).map_err(host_error)?;
            Ok(JsValue::undefined())
        }
        "captureDir" => Ok(js_string!(files::capture_dir()
            .map_err(host_error)?
            .to_string_lossy()
            .as_ref())
        .into()),
        "writeCapture" => {
            let path = string(args, 0, ctx)?;
            let data = bytes(args.get_or_undefined(1), ctx)?;
            let replace = args.get_or_undefined(2).to_boolean();
            let state = ctx.get_data::<HostState>().expect("host state installed");
            let absolute = if state.retain_capture.get() {
                Some(std::path::absolute(&path).map_err(host_error)?)
            } else {
                None
            };
            let outcome = files::write_capture(&path, &data, replace).map_err(host_error)?;
            if let Some(path) = absolute.filter(|_| matches!(outcome, "written" | "identical")) {
                let len = data.len() as u64;
                *state.capture.borrow_mut() = Some(CaptureWrite {
                    path,
                    len,
                    bytes: (data.len() <= MCP_INLINE_MAX_BYTES).then_some(data),
                });
            }
            Ok(js_string!(outcome).into())
        }
        "nmeshDecode" => byte_value(
            nodetto_capture::nmesh::decode_inline(&string(args, 0, ctx)?)
                .ok_or_else(|| host_error("Invalid mesh data."))?
                .to_packet(),
            ctx,
        ),
        "nmeshCapture" => {
            let limit = args.get_or_undefined(1).to_number(ctx)?;
            let max_vertices = if !limit.is_finite() || limit >= 9_007_199_254_740_992.0 {
                u64::MAX
            } else {
                limit as u64
            };
            let options = nodetto_capture::nmesh::DecodeOptions {
                max_vertices,
                need_target: args.get_or_undefined(2).to_boolean(),
            };
            let mesh = nodetto_capture::nmesh::decode_inline_with(&string(args, 0, ctx)?, options)
                .ok_or_else(|| host_error("Invalid mesh data."))?;
            byte_value(mesh.to_packet(), ctx)
        }
        "nmeshBounds" => {
            let options = nodetto_capture::nmesh::DecodeOptions {
                max_vertices: 0,
                need_target: false,
            };
            let bounds =
                nodetto_capture::nmesh::decode_inline_with(&string(args, 0, ctx)?, options)
                    .and_then(|mesh| mesh.bounds);
            match bounds {
                Some((min, max)) => byte_value(
                    min.into_iter()
                        .chain(max)
                        .flat_map(f64::to_le_bytes)
                        .collect(),
                    ctx,
                ),
                None => Ok(JsValue::null()),
            }
        }
        "digest" => Ok(js_string!(files::digest(&bytes(args.get_or_undefined(0), ctx)?)).into()),
        "captureSolid" | "captureEncode" => {
            let format = capture_format(args, ctx)?;
            let input = bytes(args.get_or_undefined(0), ctx)?;
            if operation == "captureSolid" {
                let scene = parse_scene(&input).map_err(host_error)?;
                drop(input);
                // The renderer needs its memory now: give back what the
                // script side no longer uses of the parsed document.
                boa_engine::gc::force_collect();
                let nodetto_capture::CaptureOutput { image, report } =
                    render_parsed(&scene, format, 0).map_err(host_error)?;
                let length = u32::try_from(report.len()).map_err(host_error)?;
                let mut packet = Vec::with_capacity(4 + report.len() + image.len());
                packet.extend_from_slice(&length.to_le_bytes());
                packet.extend_from_slice(report.as_bytes());
                packet.extend(image);
                return byte_value(packet, ctx);
            }

            let background = string(args, 3, ctx)?;
            let rgb = background
                .strip_prefix('#')
                .filter(|hex| hex.len() == 6 && hex.bytes().all(|b| b.is_ascii_hexdigit()))
                .and_then(|hex| u32::from_str_radix(hex, 16).ok())
                .ok_or_else(|| host_error("Capture background must be a six-digit hex color."))?;
            let [_, red, green, blue] = rgb.to_be_bytes();
            byte_value(
                transcode_png(&input, format, [red, green, blue]).map_err(host_error)?,
                ctx,
            )
        }
        "ensureDir" => {
            std::fs::create_dir_all(string(args, 0, ctx)?).map_err(host_error)?;
            Ok(JsValue::undefined())
        }
        "attachmentDataUrl" => {
            let document = string(args, 0, ctx)?;
            let path = string(args, 1, ctx)?;
            Ok(js_string!(files::raster_data_url(&document, &path).map_err(host_error)?).into())
        }
        "attachment" => {
            let document = string(args, 0, ctx)?;
            let path = string(args, 1, ctx)?;
            byte_value(
                files::attachment(&document, &path).map_err(host_error)?,
                ctx,
            )
        }
        "open" => {
            let path = string(args, 0, ctx)?;
            let app = optional_string(args, 1, ctx)?;
            let link = optional_string(args, 2, ctx)?;
            files::open_document(&path, app, link).map_err(host_error)?;
            Ok(JsValue::undefined())
        }
        "png" => {
            let svg = string(args, 0, ctx)?;
            let scale = args.get_or_undefined(1).to_number(ctx)? as f32;
            let fonts = optional_string(args, 2, ctx)?;
            byte_value(
                render::png(svg, scale, fonts, args.get_or_undefined(3).to_boolean())
                    .map_err(host_error)?,
                ctx,
            )
        }
        "fontCoverage" => {
            let text = string(args, 0, ctx)?;
            let fonts = optional_string(args, 1, ctx)?;
            Ok(js_string!(render::font_coverage(&text, fonts).map_err(host_error)?).into())
        }
        "pdf" => {
            let png = bytes(args.get_or_undefined(0), ctx)?;
            let layout = string(args, 1, ctx)?;
            byte_value(render::pdf(png, layout).map_err(host_error)?, ctx)
        }
        "pdfPages" => {
            let pngs = bytes(args.get_or_undefined(0), ctx)?;
            let spec = string(args, 1, ctx)?;
            byte_value(render::pdf_pages(pngs, spec).map_err(host_error)?, ctx)
        }
        "readStdin" => {
            let text = match &ctx
                .get_data::<HostState>()
                .expect("host state installed")
                .input
            {
                Input::Mcp(Some(text)) => text.clone(),
                Input::Mcp(None) => {
                    return Err(host_error(
                        "Supply the MCP tool's stdin field when using --ops -.",
                    ))
                }
                Input::Terminal => {
                    let mut text = String::new();
                    std::io::stdin()
                        .read_to_string(&mut text)
                        .map_err(host_error)?;
                    text
                }
            };
            Ok(js_string!(text).into())
        }
        "graphemes" => {
            let text = string(args, 0, ctx)?;
            Ok(JsArray::from_iter(
                text.graphemes(true).map(|s| JsValue::from(js_string!(s))),
                ctx,
            )
            .into())
        }
        "utf8" => byte_value(string(args, 0, ctx)?.into_bytes(), ctx),
        "decodeUtf8" => Ok(js_string!(String::from_utf8_lossy(&bytes(
            args.get_or_undefined(0),
            ctx
        )?)
        .as_ref())
        .into()),
        "base64" => Ok(js_string!(STANDARD.encode(bytes(args.get_or_undefined(0), ctx)?)).into()),
        "unbase64" => byte_value(
            STANDARD.decode(string(args, 0, ctx)?).map_err(host_error)?,
            ctx,
        ),
        "random" => {
            let length = args.get_or_undefined(0).to_index(ctx)?;
            if length > 65536 {
                return Err(JsNativeError::range()
                    .with_message("Random request exceeds 65536 bytes")
                    .into());
            }
            byte_value((0..length).map(|_| rand::random::<u8>()).collect(), ctx)
        }
        _ => Err(host_error("Unknown native operation")),
    }
}

// Boa exposes buffer and execution limits, but no QuickJS-style total heap quota.
// Bound individual binary allocations as well as recursion and loop execution.
#[derive(Debug)]
struct EngineHooks;
impl HostHooks for EngineHooks {
    fn max_buffer_size(&self, _context: &mut Context) -> u64 {
        512 * 1024 * 1024
    }
}

pub fn context(input: Input, directory: Option<PathBuf>) -> Result<Context, String> {
    let mut ctx = Context::builder()
        .host_hooks(Rc::new(EngineHooks))
        .build()
        .map_err(|e| e.to_string())?;
    ctx.runtime_limits_mut().set_recursion_limit(512);
    ctx.runtime_limits_mut()
        .set_loop_iteration_limit(100_000_000);
    ctx.insert_data(HostState {
        input,
        retain_capture: Cell::new(false),
        capture: RefCell::new(None),
        directory: directory
            .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| ".".into())),
    });
    ctx.register_global_builtin_callable(
        js_string!("__nodettoHost"),
        1,
        NativeFunction::from_fn_ptr(host),
    )
    .map_err(|e| e.to_string())?;
    ctx.eval(Source::from_bytes(r#"
        globalThis.native = Object.fromEntries([
          'path','readText','readBytes','listDir','exists','writeBytes','ensureDir','attachment','attachmentDataUrl','open','png','pdf','pdfPages','fontCoverage',
          'readStdin','graphemes','utf8','decodeUtf8','base64','unbase64','random',
          'captureDir','captureAbsolute','writeCapture','digest','captureEncode','captureSolid','nmeshDecode','nmeshCapture','nmeshBounds'
        ].map(name => [name, (...args) => __nodettoHost(name, ...args)]));
        globalThis.TextEncoder = class { encode(text = "") { return native.utf8(String(text)); } };
        globalThis.TextDecoder = class { decode(bytes = []) { return native.decodeUtf8(new Uint8Array(bytes)); } };
        globalThis.btoa = text => native.base64(Uint8Array.from(text, c => c.charCodeAt(0)));
        globalThis.atob = text => { const bytes = native.unbase64(text); const chunks = []; for (let i = 0; i < bytes.length; i += 8192) chunks.push(String.fromCharCode(...bytes.slice(i, i + 8192))); return chunks.join(""); };
        globalThis.Intl = { Segmenter: class { segment(text) { return native.graphemes(text).map(segment => ({ segment })); } } };
        globalThis.crypto = { getRandomValues: bytes => { bytes.set(native.random(bytes.byteLength)); return bytes; } };
        globalThis.structuredClone = value => JSON.parse(JSON.stringify(value));
    "#)).map_err(|e| e.to_string())?;
    ctx.eval(Source::from_bytes(include_str!(concat!(
        env!("OUT_DIR"),
        "/diagram.js"
    ))))
    .map_err(|e| e.to_string())?;
    Ok(ctx)
}

pub(crate) fn inline_context(input: Input, directory: Option<PathBuf>) -> Result<Context, String> {
    let ctx = context(input, directory)?;
    ctx.get_data::<HostState>()
        .expect("host state installed")
        .retain_capture
        .set(true);
    Ok(ctx)
}
pub(crate) fn take_capture_write(ctx: &Context) -> Option<CaptureWrite> {
    ctx.get_data::<HostState>()
        .expect("host state installed")
        .capture
        .borrow_mut()
        .take()
}
pub fn run(args: Vec<String>, input: Input) -> CommandResult {
    run_impl(args, input, false).0
}
pub fn run_inline(args: Vec<String>, input: Input) -> (CommandResult, Option<CaptureWrite>) {
    run_impl(args, input, true)
}
fn run_impl(
    mut args: Vec<String>,
    input: Input,
    retain: bool,
) -> (CommandResult, Option<CaptureWrite>) {
    let directory = if args.first().is_some_and(|arg| arg == "--cwd") {
        if args.len() < 3 {
            return (
                CommandResult::error("--cwd requires a project directory and a command"),
                None,
            );
        }
        let folder = PathBuf::from(args.remove(1));
        args.remove(0);
        Some(folder)
    } else {
        None
    };
    let result = if retain {
        inline_context(input, directory)
    } else {
        context(input, directory)
    };
    let mut ctx = match result {
        Ok(ctx) => ctx,
        Err(error) => return (CommandResult::error(error), None),
    };
    let output = execute(&mut ctx, args).unwrap_or_else(CommandResult::error);
    (output, take_capture_write(&ctx))
}

fn execute(ctx: &mut Context, args: Vec<String>) -> Result<CommandResult, String> {
    let call = ctx
        .global_object()
        .get(js_string!("nodettoRun"), ctx)
        .map_err(|e| e.to_string())?
        .as_callable()
        .ok_or("Missing diagram entrypoint")?;
    let value = call
        .call(
            &JsValue::undefined(),
            &[
                js_string!(serde_json::to_string(&args).unwrap()).into(),
                js_string!(env!("CARGO_PKG_VERSION")).into(),
            ],
            ctx,
        )
        .map_err(|e| e.to_string())?;
    let promise = JsPromise::from_object(value.as_object().ok_or("Expected command promise")?)
        .map_err(|e| e.to_string())?;
    ctx.run_jobs().map_err(|e| e.to_string())?;
    match promise.state() {
        PromiseState::Fulfilled(value) => {
            let text = value
                .as_string()
                .ok_or("Expected command result JSON")?
                .to_std_string_lossy();
            serde_json::from_str(&text).map_err(|e| e.to_string())
        }
        PromiseState::Rejected(error) => Err(error
            .to_string(ctx)
            .map_err(|e| e.to_string())?
            .to_std_string_lossy()),
        PromiseState::Pending => Err("Command promise did not settle".into()),
    }
}

pub fn help() -> Result<serde_json::Value, String> {
    let mut ctx = context(Input::Mcp(None), None)?;
    let value = ctx
        .global_object()
        .get(js_string!("nodettoHelp"), &mut ctx)
        .map_err(|e| e.to_string())?;
    let text = value
        .as_string()
        .ok_or("Missing diagram help")?
        .to_std_string_lossy();
    serde_json::from_str(&text).map_err(|e| e.to_string())
}

#[cfg(test)]
#[path = "engine_tests.rs"]
mod tests;
