use super::*;
use serde_json::{json, Value};

// Engine-independent assertions. Only evaluate() adapts to the interpreter API.
fn evaluate(source: &str, input: Input, directory: Option<std::path::PathBuf>) -> Value {
    let mut ctx = context(input, directory).unwrap();
    let value = ctx
        .eval(Source::from_bytes(&format!("JSON.stringify({source})")))
        .unwrap();
    serde_json::from_str(&value.as_string().unwrap().to_std_string_lossy()).unwrap()
}

#[test]
fn capture_host_operations_resolve_paths_and_report_writes() {
    let folder = tempfile::tempdir().unwrap();
    assert_eq!(
        evaluate(
            r#"(() => {
      const path = native.path('a.png');
      const source = Uint8Array.of(99, 97, 98, 99, 99);
      const bytes = source.subarray(1, 4);
      const other = Uint8Array.of(97, 98, 100);
      return [
        native.writeCapture(path, bytes, false),
        native.writeCapture(path, bytes, false),
        native.writeCapture(path, other, false),
        native.writeCapture(path, other, true),
        native.digest(bytes)
      ];
    })()"#,
            Input::Mcp(None),
            Some(folder.path().into()),
        ),
        json!([
            "written",
            "identical",
            "exists",
            "written",
            "e71fa2190541574b"
        ]),
    );
    let image = folder.path().join("a.png");
    assert_eq!(std::fs::read(&image).unwrap(), b"abd");
    let result = evaluate(
        "[native.captureDir(), native.captureAbsolute('a.png')]",
        Input::Mcp(None),
        Some(folder.path().into()),
    );
    let capture = std::path::Path::new(result[0].as_str().unwrap());
    assert!(capture.is_dir());
    assert!(capture
        .file_name()
        .unwrap()
        .to_string_lossy()
        .starts_with("nodetto-capture"));
    let absolute = std::path::Path::new(result[1].as_str().unwrap());
    assert!(absolute.is_absolute());
    assert_eq!(absolute, image);
}

#[test]
fn capture_absolute_uses_native_parent_traversal() {
    let folder = tempfile::tempdir().unwrap();
    let expected = if cfg!(windows) {
        folder.path().join("a.png")
    } else {
        folder.path().join("nested").join("..").join("a.png")
    };
    assert_eq!(
        evaluate(
            "native.captureAbsolute('nested/.././a.png')",
            Input::Mcp(None),
            Some(folder.path().into()),
        ),
        json!(expected.to_str().unwrap()),
    );
}

#[test]
fn unicode_encoding_and_graphemes_preserve_diagram_labels() {
    assert_eq!(
        evaluate(
            r#"(() => {
        const text = '日本語 e\u0301 👨‍👩‍👧‍👦 𠮷';
        return [new TextDecoder().decode(new TextEncoder().encode(text)),
          [...new Intl.Segmenter().segment('e\u0301👨‍👩‍👧‍👦𠮷')].map(x => x.segment),
          Array.from(new TextEncoder().encode('𠮷'))];
    })()"#,
            Input::Mcp(None),
            None
        ),
        json!([
            "日本語 e\u{301} 👨‍👩‍👧‍👦 𠮷",
            ["e\u{301}", "👨‍👩‍👧‍👦", "𠮷"],
            [240, 160, 174, 183]
        ])
    );
}

#[test]
fn base64_preserves_binary_and_large_attachments() {
    assert_eq!(
        evaluate(
            r#"(() => {
      const bytes = Uint8Array.from({length: 20000}, (_, i) => i % 256);
      const text = Array.from(bytes, b => String.fromCharCode(b)).join('');
      const decoded = atob(btoa(text));
      let invalid = false; try { atob('!invalid!'); } catch { invalid = true; }
      return [decoded.length, Array.from(decoded, c => c.charCodeAt(0)).every((b,i) => b === bytes[i]), invalid];
    })()"#,
            Input::Mcp(None),
            None
        ),
        json!([20000, true, true])
    );
}

#[test]
fn binary_views_write_only_the_selected_bytes_and_attachments_stay_confined() {
    let folder = tempfile::tempdir().unwrap();
    std::fs::write(folder.path().join("doc.jsonl"), "diagram").unwrap();
    assert_eq!(
        evaluate(
            r#"(() => {
      const bytes = new Uint8Array([99,0,128,255,88]);
      native.writeBytes(native.path('image.bin'), bytes.subarray(1,4));
      const data = native.attachment(native.path('doc.jsonl'), 'image.bin');
      let blocked = false;
      try { native.attachment(native.path('doc.jsonl'), '../outside'); } catch { blocked = true; }
      return [Array.from(data), blocked, native.exists(native.path('image.bin')),
        native.readText(native.path('doc.jsonl')),
        Array.from(native.readBytes(native.path('image.bin')))];
    })()"#,
            Input::Mcp(None),
            Some(folder.path().into())
        ),
        json!([[0, 128, 255], true, true, "diagram", [0, 128, 255]])
    );
    assert_eq!(
        std::fs::read(folder.path().join("image.bin")).unwrap(),
        [0, 128, 255]
    );
}

#[test]
fn mcp_input_is_explicit_and_does_not_consume_transport_stdin() {
    assert_eq!(
        evaluate(
            "native.readStdin()",
            Input::Mcp(Some("ops\n日本語".into())),
            None
        ),
        json!("ops\n日本語")
    );
    let missing = evaluate(
        "(() => { try { native.readStdin(); } catch(e) { return e.message; } })()",
        Input::Mcp(None),
        None,
    );
    assert!(missing
        .as_str()
        .unwrap()
        .contains("Supply the MCP tool's stdin field"));
}

#[test]
fn random_values_clone_and_json_preserve_editor_data() {
    assert_eq!(
        evaluate(
            r#"(() => {
      const bytes = new Uint8Array(32); const same = crypto.getRandomValues(bytes) === bytes;
      const original = { label: '日本語', visual: { x: 3 }, list: [null, true, 1.25] };
      const copy = structuredClone(original); copy.visual.x = 9;
      return [same, bytes.length, bytes.some(b => b !== 0), original.visual.x, copy];
    })()"#,
            Input::Mcp(None),
            None
        ),
        json!([true,32,true,3,{"label":"日本語","visual":{"x":9},"list":[null,true,1.25]}])
    );
}

#[test]
fn host_failures_are_catchable_and_do_not_poison_the_context() {
    assert_eq!(
        evaluate(
            r#"(() => {
      let error = ''; try { native.readText('/nodetto-missing-contract-test/doc'); } catch(e) { error = e.message; }
      return [error.length > 0, new TextDecoder().decode(native.utf8('still works'))];
    })()"#,
            Input::Mcp(None),
            None
        ),
        json!([true, "still works"])
    );
}

#[test]
fn fresh_invocations_do_not_share_global_state_and_help_is_valid() {
    assert_eq!(
        evaluate("(globalThis.__contractState = 42)", Input::Mcp(None), None),
        json!(42)
    );
    assert_eq!(
        evaluate("typeof globalThis.__contractState", Input::Mcp(None), None),
        json!("undefined")
    );
    let info = help().unwrap();
    assert!(info["commands"].get("edit").is_some());
    let result = run(vec!["--version".into()], Input::Mcp(None));
    assert_eq!(result.exit_code, 0);
    assert!(result.stdout.contains(env!("CARGO_PKG_VERSION")));
    assert!(result.stderr.is_empty());
}

#[test]
fn command_jobs_settle_nested_promises_and_report_rejection_or_pending() {
    let mut ctx = context(Input::Mcp(None), None).unwrap();
    ctx.eval(Source::from_bytes(
        r#"
      nodettoRun = async () => { await Promise.resolve(); await Promise.resolve();
        return JSON.stringify({exitCode: 0, stdout: 'nested async result', stderr: ''}); };
    "#,
    ))
    .unwrap();
    assert_eq!(
        execute(&mut ctx, vec![]).unwrap().stdout,
        "nested async result"
    );
    ctx.eval(Source::from_bytes("nodettoRun = async () => { await Promise.resolve(); throw Error('async contract failure'); }; ")).unwrap();
    assert!(execute(&mut ctx, vec![])
        .unwrap_err()
        .contains("async contract failure"));
    ctx.eval(Source::from_bytes(
        "nodettoRun = () => new Promise(() => {});",
    ))
    .unwrap();
    assert!(execute(&mut ctx, vec![])
        .unwrap_err()
        .contains("did not settle"));
}

#[test]
fn oversized_buffers_and_runaway_execution_fail_without_aborting_host() {
    assert_eq!(
        evaluate(
            r#"(() => {
      let buffer = false, random = false;
      try { new ArrayBuffer(512 * 1024 * 1024 + 1); } catch { buffer = true; }
      try { crypto.getRandomValues(new Uint8Array(65537)); } catch { random = true; }
      return [buffer, random];
    })()"#,
            Input::Mcp(None),
            None
        ),
        json!([true, true])
    );
    let mut ctx = context(Input::Mcp(None), None).unwrap();
    ctx.runtime_limits_mut().set_loop_iteration_limit(100);
    assert!(ctx.eval(Source::from_bytes("while (true) {};")).is_err());
    assert_eq!(
        ctx.eval(Source::from_bytes("1 + 1")).unwrap().as_number(),
        Some(2.0)
    );
}

#[test]
fn list_dir_returns_sorted_file_names_only() {
    let folder = tempfile::tempdir().unwrap();
    std::fs::write(folder.path().join("z.png"), []).unwrap();
    std::fs::write(folder.path().join("a.png"), []).unwrap();
    std::fs::create_dir(folder.path().join("nested")).unwrap();
    assert_eq!(
        evaluate(
            "JSON.parse(native.listDir(native.path('.')))",
            Input::Mcp(None),
            Some(folder.path().into())
        ),
        json!(["a.png", "z.png"])
    );
}

#[test]
fn pdf_pages_host_returns_pdf_bytes() {
    let result = evaluate(
        r#"(() => {
        const png = native.png('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>', 1, undefined, false);
        const spec = {pages:[{pngLength:png.length,layout:{pageWidth:1,pageHeight:1,x:0,y:0,width:1,height:1},fontNames:[],content:''}],fonts:[]};
        const output = native.pdfPages(png, JSON.stringify(spec));
        return [output instanceof Uint8Array, Array.from(output.slice(0,5))];
    })()"#,
        Input::Mcp(None),
        None,
    );
    assert_eq!(result, json!([true, [37, 80, 68, 70, 45]]));
}

#[test]
fn ensure_dir_creates_nested_directories_idempotently() {
    let folder = tempfile::tempdir().unwrap();
    evaluate(
        "(() => { native.ensureDir(native.path('a/b/c')); native.ensureDir(native.path('a/b/c')); return true; })()",
        Input::Mcp(None),
        Some(folder.path().into()),
    );
    assert!(folder.path().join("a/b/c").is_dir());
}

#[test]
fn capture_command_renders_a_png_and_reports_its_path() {
    let folder = tempfile::tempdir().unwrap();
    std::fs::write(
        folder.path().join("drawing.jsonl"),
        concat!(
            "{\"kind\":\"document\",\"schemaVersion\":1,\"id\":\"doc\",\"title\":\"Drawing\"}\n",
            "{\"kind\":\"page\",\"id\":\"p1\",\"name\":\"Draft\",\"pageKind\":\"freeform\"}\n",
            "{\"kind\":\"element\",\"id\":\"rect\",\"page\":\"p1\",\"type\":\"shape.geo\",\"index\":\"a0\",\"semantic\":{\"geo\":\"rect\",\"label\":\"\"},\"visual\":{\"x\":0,\"y\":0,\"width\":100,\"height\":100}}\n",
        ),
    )
    .unwrap();
    let result = run(
        [
            "--cwd",
            folder.path().to_str().unwrap(),
            "capture",
            "drawing.jsonl",
            "--output",
            "drawing.png",
            "--padding",
            "0",
            "--scale",
            "1.1",
        ]
        .map(str::to_owned)
        .to_vec(),
        Input::Mcp(None),
    );
    assert_eq!(result.exit_code, 0, "{}", result.stderr);
    let output = folder.path().join("drawing.png");
    assert_eq!(
        result.stdout.lines().next(),
        Some(format!("path: {}", output.display()).as_str()),
    );
    let png = std::fs::read(output).unwrap();
    assert!(png.starts_with(b"\x89PNG\r\n\x1a\n"));
    assert!(result.stdout.lines().any(|line| line == "size: 110x110"));
    assert_eq!(&png[16..24], &[0, 0, 0, 110, 0, 0, 0, 110]);
}

#[test]
fn capture_encode_transcodes_the_native_png_and_checks_options() {
    let result = evaluate(
        r##"(() => {
        const png = native.png('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="3"/>', 1, undefined, false);
        const jpg = native.captureEncode(png, "jpg", 90, "#ffffff");
        const invalid = [["svg", 90, "#ffffff"], ["jpg", 90.5, "#ffffff"], ["jpg", 256, "#ffffff"], ["jpg", 90, "#+12345"]];
        return [jpg instanceof Uint8Array, Array.from(jpg.slice(0, 2)), Array.from(jpg.slice(-2)),
            invalid.every(options => {
                try { native.captureEncode(png, ...options); return false; }
                catch (error) { return error instanceof Error; }
            })];
    })()"##,
        Input::Mcp(None),
        None,
    );
    assert_eq!(result, json!([true, [255, 216], [255, 217], true]));
}

#[test]
fn solid_capture_runs_through_boa_and_matches_bun_scene_bytes() {
    const SCENE: &[u8] = include_bytes!("../../src/__fixtures__/capture-plate-default.ncs1");
    let folder = tempfile::tempdir().unwrap();
    let fixture = folder.path().join("capture-plate.jsonl");
    std::fs::write(
        &fixture,
        include_str!("../../src/__fixtures__/capture-plate.jsonl"),
    )
    .unwrap();
    let mut ctx = context(Input::Mcp(None), Some(folder.path().into())).unwrap();
    ctx.eval(Source::from_bytes(
        r#"{
            const captureSolid = native.captureSolid;
            native.captureSolid = (scene, format, quality) => {
                globalThis.observedCaptureScene = scene;
                return captureSolid(scene, format, quality);
            };
        }"#,
    ))
    .unwrap();
    let result = execute(
        &mut ctx,
        ["capture", "capture-plate.jsonl", "--output", "plate.png"]
            .map(str::to_owned)
            .to_vec(),
    )
    .unwrap();
    assert_eq!(result.exit_code, 0, "{}", result.stderr);
    assert!(result.stdout.contains("\nbodies: 3 (Plate, Block, Puck)\n"));
    assert!(result.stdout.contains("\nsize: 1024x768\n"));

    let observed = ctx
        .global_object()
        .get(js_string!("observedCaptureScene"), &mut ctx)
        .unwrap();
    assert!(bytes(&observed, &mut ctx).unwrap() == SCENE);

    let image = std::fs::read(folder.path().join("plate.png")).unwrap();
    let expected = nodetto_capture::render_scene(SCENE, ImageFormat::Png, 0).unwrap();
    assert_eq!(image, expected.image);
    assert_eq!(&image[..8], b"\x89PNG\r\n\x1a\n");
    assert_eq!(&image[12..26], b"IHDR\0\0\x04\0\0\0\x03\0\x08\x02");

    let jpg = execute(
        &mut ctx,
        ["capture", "capture-plate.jsonl", "--output", "plate.jpg"]
            .map(str::to_owned)
            .to_vec(),
    )
    .unwrap();
    assert_eq!(jpg.exit_code, 0, "{}", jpg.stderr);
    assert!(std::fs::read(folder.path().join("plate.jpg"))
        .unwrap()
        .starts_with(&[0xff, 0xd8]));
}

#[test]
fn capture_encode_preserves_png_and_composites_the_host_rgb_in_order() {
    let result = evaluate(
        r##"(() => {
        const png = native.png('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="3"/>', 1, undefined, false);
        return [
            Array.from(png),
            Array.from(native.captureEncode(png, "png", 90, "#a1b2c3")),
            Array.from(native.captureEncode(png, "jpg", 90, "#a1b2c3"))
        ];
    })()"##,
        Input::Mcp(None),
        None,
    );
    let row = |index: usize| serde_json::from_value::<Vec<u8>>(result[index].clone()).unwrap();
    let png = row(0);
    assert_eq!(row(1), png);
    let format = ImageFormat::Jpeg { quality: 90 };
    assert_eq!(
        row(2),
        transcode_png(&png, format, [0xa1, 0xb2, 0xc3]).unwrap()
    );
    assert_ne!(
        row(2),
        transcode_png(&png, format, [0xc3, 0xb2, 0xa1]).unwrap()
    );
}
