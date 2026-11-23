use crate::engine::{self, CommandResult, Input};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use rmcp::{model::*, service::RequestContext, ErrorData, RoleServer, ServerHandler, ServiceExt};
use serde::Deserialize;
use serde_json::json;
use std::{
    borrow::Cow,
    fs,
    io::{self, Read},
    path::Path,
    sync::Arc,
};

const MCP_INLINE_MAX_BYTES: u64 = 1_048_576;

/// The capture tokens of a tool call and its `--cwd` folder, when the call
/// is a capture. The global options are the ones the engine itself accepts
/// before a command: a leading `--cwd <dir>` and `--quiet` before `--`.
fn capture_call(args: &[String]) -> Option<(Option<&Path>, Vec<&str>)> {
    let (directory, rest) = match args {
        [flag, directory, rest @ ..] if flag == "--cwd" => (Some(Path::new(directory)), rest),
        rest => (None, rest),
    };
    let mut tokens = rest
        .iter()
        .map(String::as_str)
        .take_while(|arg| *arg != "--")
        .filter(|arg| *arg != "--quiet");
    (tokens.next()? == "capture").then(|| (directory, tokens.collect()))
}

fn wants_inline_image(args: &[String]) -> bool {
    capture_call(args).is_some_and(|(_, tokens)| tokens.contains(&"--inline"))
}

fn captured_image(stdout: &str) -> Option<(Cow<'_, str>, &'static str)> {
    let path = if let Some(path) = stdout.lines().next()?.strip_prefix("path: ") {
        Cow::Borrowed(path)
    } else {
        let report: serde_json::Value = serde_json::from_str(stdout).ok()?;
        Cow::Owned(report.get("path")?.as_str()?.to_owned())
    };
    let (_, extension) = path.rsplit_once('.')?;
    let mime_type = if extension.eq_ignore_ascii_case("png") {
        "image/png"
    } else if extension.eq_ignore_ascii_case("jpg") || extension.eq_ignore_ascii_case("jpeg") {
        "image/jpeg"
    } else {
        return None;
    };
    Some((path, mime_type))
}

/// A text path can be truncated by an embedded newline. Check it against
/// the explicit output or the private default directory before opening it.
fn capture_path_matches(path: &Path, args: &[String]) -> io::Result<bool> {
    let Some((directory, tokens)) = capture_call(args) else {
        return Ok(false);
    };
    let mut tokens = tokens.into_iter();
    while let Some(arg) = tokens.next() {
        let explicit = if arg == "--output" {
            tokens.next()
        } else {
            arg.strip_prefix("--output=")
        };
        if let Some(output) = explicit {
            let output = directory.map_or_else(|| output.into(), |folder| folder.join(output));
            return Ok(path == std::path::absolute(output)?);
        }
    }
    let directory = std::path::absolute(crate::files::capture_dir()?)?;
    Ok(path.parent() == Some(directory.as_path()))
}

fn read_inline_image(path: &Path, mime_type: &'static str) -> io::Result<ContentBlock> {
    let entry = path.symlink_metadata()?;
    if !entry.is_file() {
        return Err(io::Error::other("The capture is not a regular file."));
    }
    let mut options = fs::OpenOptions::new();
    options.read(true);
    // O_NOFOLLOW and O_NONBLOCK reject a swapped-in link or avoid a FIFO hang.
    #[cfg(any(target_os = "macos", target_os = "ios"))]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.custom_flags(0x100 | 0x4);
    }
    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.custom_flags(0x20000 | 0x800);
    }
    #[cfg(all(target_os = "linux", target_arch = "aarch64"))]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.custom_flags(0x8000 | 0x800);
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;
        options.custom_flags(0x00200000); // FILE_FLAG_OPEN_REPARSE_POINT
    }
    let mut file = options.open(path)?;
    let opened = file.metadata()?;
    if !opened.is_file() {
        return Err(io::Error::other("The capture is not a regular file."));
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        if opened.dev() != entry.dev() || opened.ino() != entry.ino() {
            return Err(io::Error::other("The capture changed before reading it."));
        }
    }
    let size = opened.len();
    if size > MCP_INLINE_MAX_BYTES {
        return Ok(ContentBlock::text(format!(
            "Image not inlined: {size} bytes exceed {MCP_INLINE_MAX_BYTES}. Open the path instead, or capture with a smaller --size or --format jpg."
        )));
    }
    let mut bytes = Vec::with_capacity(size as usize);
    (&mut file).take(size).read_to_end(&mut bytes)?;
    if bytes.len() as u64 != size || file.metadata()?.len() != size {
        return Err(io::Error::other(
            "The capture size changed while reading it.",
        ));
    }
    Ok(ContentBlock::image(STANDARD.encode(bytes), mime_type))
}

fn capture_content(args: &[String], output: &CommandResult) -> Option<ContentBlock> {
    if !matches!(output.exit_code, 0 | 1) || !wants_inline_image(args) {
        return None;
    }
    let (path, mime_type) = captured_image(&output.stdout)?;
    let path = Path::new(path.as_ref());
    let block = capture_path_matches(path, args).and_then(|matches| {
        if !matches {
            return Err(io::Error::other(
                "could not read the written path from capture output. Try --json.",
            ));
        }
        read_inline_image(path, mime_type)
    });
    Some(block.unwrap_or_else(|error| ContentBlock::text(format!("Image not inlined: {error}"))))
}

#[derive(Clone)]
struct Server {
    tools: Vec<Tool>,
    gate: Arc<tokio::sync::Mutex<()>>,
}
#[derive(Deserialize)]
struct Arguments {
    args: Vec<String>,
    stdin: Option<String>,
}
fn tool(name: String, description: String) -> Tool {
    serde_json::from_value(json!({
        "name": name, "description": description,
        "inputSchema": { "type": "object", "required": ["args"], "properties": {
            "args": { "type": "array", "items": { "type": "string" }, "description": "CLI argument tokens. Omit the executable and, for a command-specific tool, the command name. All CLI options are supported." },
            "stdin": { "type": "string", "description": "Explicit input text for edit --ops -. Never reads the MCP protocol stream." }
        } },
        "outputSchema": { "type": "object", "required": ["exitCode", "stdout", "stderr"], "properties": { "exitCode": { "type": "integer" }, "stdout": { "type": "string" }, "stderr": { "type": "string" } } }
    })).expect("static tool schema is valid")
}
fn result(value: CommandResult) -> CallToolResult {
    let failed = value.exit_code != 0;
    let value = serde_json::to_value(value).expect("command results serialize");
    if failed {
        CallToolResult::structured_error(value)
    } else {
        CallToolResult::structured(value)
    }
}
impl ServerHandler for Server {
    fn get_info(&self) -> ServerConfig {
        let mut config = ServerConfig::new(ServerCapabilities::builder().enable_tools().build())
            .with_instructions("Nodetto native CLI. All local file commands and options are available. Use nodetto_help with args [] for usage. Relative paths use the server working directory. Export binaries with --output. Tool results preserve exitCode, stdout and stderr; nonzero exit codes set isError. To look at a page, call nodetto_capture: it writes a PNG or JPG and returns its path; add --inline to also receive the image in the result.");
        config.server_info.name = "nodetto-cli".into();
        config.server_info.version = env!("CARGO_PKG_VERSION").into();
        config
    }
    fn get_tool(&self, name: &str) -> Option<Tool> {
        self.tools.iter().find(|tool| tool.name == name).cloned()
    }
    async fn list_tools(
        &self,
        _request: Option<PaginatedRequestParams>,
        _context: RequestContext<RoleServer>,
    ) -> Result<ListToolsResult, ErrorData> {
        Ok(ListToolsResult {
            tools: self.tools.clone(),
            ..Default::default()
        })
    }
    async fn call_tool(
        &self,
        request: CallToolRequestParams,
        _context: RequestContext<RoleServer>,
    ) -> Result<CallToolResponse, ErrorData> {
        if self.get_tool(&request.name).is_none() {
            return Ok(result(CommandResult::error(format!(
                "Unknown tool: {}",
                request.name
            )))
            .into());
        }
        let Arguments { mut args, stdin } = match serde_json::from_value(serde_json::Value::Object(
            request.arguments.unwrap_or_default(),
        )) {
            Ok(input) => input,
            Err(error) => return Ok(result(CommandResult::error(error)).into()),
        };
        if request.name != "nodetto_cli" {
            args.insert(0, request.name.trim_start_matches("nodetto_").into());
        }
        if args.first().is_some_and(|arg| arg == "mcp")
            && !args.iter().any(|arg| arg == "--help" || arg == "-h")
        {
            return Ok(result(CommandResult::error(
                "The MCP server is already running. Use a document command or help mcp.",
            ))
            .into());
        }
        let _guard = self.gate.lock().await;
        if let Some(output) = crate::access::command(&args) {
            return Ok(result(output).into());
        }
        let response = tokio::task::spawn_blocking(move || {
            // Keep the actual argument tokens available for the capture readback.
            let output = engine::run(args.clone(), Input::Mcp(stdin));
            let image = capture_content(&args, &output);
            let mut response = result(output);
            response.content.extend(image);
            response
        })
        .await
        .unwrap_or_else(|error| result(CommandResult::error(error)));
        Ok(response.into())
    }
}

pub async fn serve() -> Result<(), Box<dyn std::error::Error>> {
    let help = engine::help()?;
    let mut tools = vec![
        tool(
            "nodetto_cli".into(),
            format!(
                "Run any CLI command, including help and --version.\n{}",
                help["overview"].as_str().unwrap_or_default()
            ),
        ),
        tool(
            "nodetto_help".into(),
            "Get usage. Pass args [] for the overview or [\"edit\"] for command help.".into(),
        ),
    ];
    for (name, description) in help["commands"].as_object().ok_or("Missing command help")? {
        if name != "mcp" {
            tools.push(tool(
                format!("nodetto_{name}"),
                description.as_str().unwrap_or_default().into(),
            ));
        }
    }
    let server = Server {
        tools,
        gate: Arc::new(tokio::sync::Mutex::new(())),
    };
    server
        .serve(rmcp::transport::stdio())
        .await?
        .waiting()
        .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tokens(args: &[&str]) -> Vec<String> {
        args.iter().map(|arg| (*arg).to_owned()).collect()
    }

    #[test]
    fn inline_flag_is_specific_to_capture_options() {
        for args in [
            &["capture", "drawing.jsonl", "--inline"][..],
            &["capture", "--inline", "--json", "drawing.jsonl"],
            &["--quiet", "capture", "drawing.jsonl", "--inline"],
            &["--cwd", "project", "capture", "drawing.jsonl", "--inline"],
            &["--cwd", "project", "--quiet", "capture", "--inline"],
        ] {
            assert!(wants_inline_image(&tokens(args)));
        }
        for args in [
            &[][..],
            &["export", "--inline"],
            &["capture", "drawing.jsonl"],
            &["capture", "--inline=true"],
            &["capture", "--", "--inline"],
            &["--cwd", "capture", "--inline"],
            &["--quiet", "export", "--inline"],
        ] {
            assert!(!wants_inline_image(&tokens(args)));
        }
    }

    #[test]
    fn explicit_output_is_matched_inside_the_cwd_folder() {
        let folder = std::path::absolute("project").unwrap();
        let call = tokens(&[
            "--cwd", "project", "--quiet", "capture", "--output", "a.png",
        ]);
        assert!(capture_path_matches(&folder.join("a.png"), &call).unwrap());
        assert!(!capture_path_matches(&folder.join("b.png"), &call).unwrap());
        let plain = tokens(&["capture", "--output=a.png"]);
        assert!(capture_path_matches(&std::path::absolute("a.png").unwrap(), &plain).unwrap());
        assert!(!capture_path_matches(&folder.join("a.png"), &plain).unwrap());
    }

    #[test]
    fn capture_reports_identify_png_and_jpeg_in_text_and_json() {
        for (stdout, path, mime_type) in [
            (
                "path: /mock/plan view.png\nformat: png\n",
                "/mock/plan view.png",
                "image/png",
            ),
            (
                "{\"path\":\"/mock/front.jpg\"}\n",
                "/mock/front.jpg",
                "image/jpeg",
            ),
            ("path: /mock/side.JPEG\r\n", "/mock/side.JPEG", "image/jpeg"),
            (
                "{\"path\":\"/mock/side\\nview.png\"}",
                "/mock/side\nview.png",
                "image/png",
            ),
        ] {
            assert_eq!(
                captured_image(stdout),
                Some((Cow::Borrowed(path), mime_type))
            );
        }
        for stdout in [
            "",
            "size: 80x60\npath: /mock/plan.png\n",
            "path: /mock/plan.svg",
            "{}",
            "{\"path\":17}",
            "[\"/mock/plan.png\"]",
        ] {
            assert!(captured_image(stdout).is_none());
        }
    }

    #[test]
    fn inline_capture_preserves_exit_one_and_checks_file_size_and_path() {
        let folder = tempfile::tempdir().unwrap();
        let path = folder.path().join("test capture.jpg");
        let path = path.to_str().unwrap();
        let args = tokens(&["capture", "drawing.jsonl", "--inline", "--output", path]);
        let mut output = CommandResult {
            exit_code: 1,
            stdout: format!("path: {path}\n"),
            stderr: String::new(),
        };
        let image = vec![91; MCP_INLINE_MAX_BYTES as usize];
        fs::write(path, &image).unwrap();
        let block = serde_json::to_value(capture_content(&args, &output).unwrap()).unwrap();
        assert_eq!(block["type"], "image");
        assert_eq!(block["mimeType"], "image/jpeg");
        assert_eq!(
            STANDARD.decode(block["data"].as_str().unwrap()).unwrap(),
            image
        );

        fs::OpenOptions::new()
            .write(true)
            .open(path)
            .unwrap()
            .set_len(MCP_INLINE_MAX_BYTES + 1)
            .unwrap();
        let block = serde_json::to_value(capture_content(&args, &output).unwrap()).unwrap();
        assert_eq!(block["type"], "text");
        assert!(block["text"]
            .as_str()
            .unwrap()
            .contains("1048577 bytes exceed 1048576"));

        let different_path = format!("{path}\nother.jpg");
        let args = tokens(&[
            "capture",
            "drawing.jsonl",
            "--inline",
            "--output",
            &different_path,
        ]);
        let block = serde_json::to_value(capture_content(&args, &output).unwrap()).unwrap();
        assert!(block["text"].as_str().unwrap().contains("Try --json"));
        output.exit_code = 2;
        assert!(capture_content(&args, &output).is_none());
    }
}
