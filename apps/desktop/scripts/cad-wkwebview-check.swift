// Runs the production-CSP CAD fixture in system WebKit. The Bun parent owns the server.
import AppKit
import WebKit

struct CheckError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

@MainActor
func execute(_ script: String, in view: WKWebView, awaitPromise: Bool = false) throws -> Any {
    var result: Result<Any, Error>?
    if awaitPromise {
        view.callAsyncJavaScript("return await (\(script));", arguments: [:], in: nil, in: .page) {
            result = $0
        }
    } else {
        view.evaluateJavaScript(script) { value, error in
            result = error.map { .failure($0) } ?? .success(value ?? NSNull())
        }
    }
    let deadline = Date().addingTimeInterval(15)
    while result == nil && Date() < deadline {
        RunLoop.current.run(until: Date().addingTimeInterval(0.02))
    }
    guard let result else { throw CheckError(message: "WebKit JavaScript timed out") }
    return try result.get()
}

@MainActor
func verify(_ url: URL) throws -> [String: Any] {
    let app = NSApplication.shared
    app.setActivationPolicy(.accessory)
    let configuration = WKWebViewConfiguration()
    configuration.websiteDataStore = .nonPersistent()
    configuration.userContentController.addUserScript(WKUserScript(source: """
        window.cadErrors = [];
        window.addEventListener("error", event => window.cadErrors.push(event.message));
        window.addEventListener("unhandledrejection", event => window.cadErrors.push(String(event.reason)));
        // An off-screen view has no compositor ticks. Drive the same callbacks
        // with a timer so they draw into the real WebGL framebuffer for readback.
        window.requestAnimationFrame = callback => setTimeout(() => callback(performance.now()), 16);
        window.cancelAnimationFrame = clearTimeout;
        """, injectionTime: .atDocumentStart, forMainFrameOnly: true))

    let frame = NSRect(x: -10000, y: -10000, width: 1000, height: 800)
    let window = NSWindow(contentRect: frame, styleMask: [.borderless], backing: .buffered, defer: false)
    let view = WKWebView(frame: NSRect(origin: .zero, size: frame.size), configuration: configuration)
    window.contentView = view
    window.orderBack(nil)
    defer { window.orderOut(nil) }
    view.load(URLRequest(url: url))

    let deadline = Date().addingTimeInterval(25)
    var ready = false
    var diagnostic = ""
    while Date() < deadline {
        let state = try execute("""
            ({ ready: Boolean(window.__cadCheck?.ready),
            failure: window.__cadCheck?.engineResult?.failure ??
              document.querySelector(".nodetto-cad-status")?.textContent ?? "",
            errors: window.cadErrors ?? [],
            diagnostic: JSON.stringify({
              url: location.href, visibility: document.visibilityState,
              readyState: document.readyState, viewport: !!document.querySelector("canvas"),
              engineResult: window.__cadCheck?.engineResult, width: innerWidth, height: innerHeight
            }) })
            """, in: view) as? [String: Any] ?? [:]
        if let error = state["failure"] as? String, !error.isEmpty {
            throw CheckError(message: error)
        }
        if let errors = state["errors"] as? [String], !errors.isEmpty {
            throw CheckError(message: errors.joined(separator: "\n"))
        }
        if state["ready"] as? Bool == true {
            ready = true
            break
        }
        diagnostic = state["diagnostic"] as? String ?? ""
        RunLoop.current.run(until: Date().addingTimeInterval(0.08))
    }
    guard ready else {
        throw CheckError(message: "The CAD worker did not display a body: \(diagnostic)")
    }

    let readings = try execute("""
        (async () => {
          const check = window.__cadCheck;
          const { width, height } = check.size;
          const centre = [Math.floor(width / 2), Math.floor(height / 2)];
          const different = (a, b) => a.slice(0, 3).some((c, i) => c !== b[i]);
          const light = check.readPixels(...centre);
          const lightBackground = check.background;
          const lightCorner = check.readPixels(0, 0);
          await check.setCanvasMode("dark");
          const dark = check.readPixels(...centre);
          const darkBackground = check.background;
          const darkCorner = check.readPixels(0, 0);
          const holePixel = check.firstHolePixel();
          const before = check.readPixels(...holePixel);
          const editToDisplayMs = await check.editRadius(1.25);
          const after = check.readPixels(...holePixel);
          const { bodyCount, triangles } = check.engineResult;
          const picker = await check.checkBoardPicker();
          return {
            diagnostics: check.diagnostics, timings: check.timings,
            pixels: { light, lightBackground, dark, darkBackground, before, after },
            errors: window.cadErrors, policyViolations: check.policyViolations,
            assertions: {
              workerReturnedPlate: bodyCount === 1 && triangles > 0,
              programsLinked: check.diagnostics.programsLinked,
              lightCentreShowsBody: different(light, lightBackground),
              darkCentreShowsBody: different(dark, darkBackground),
              canvasModeChangesCentre: different(light, dark),
              backgroundTokensReachFramebuffer: !different(lightCorner, lightBackground) &&
                !different(darkCorner, darkBackground),
              radiusEditChangesHolePixel: different(before, after),
              editDisplayed: editToDisplayMs > 0,
              noCspViolations: check.policyViolations.length === 0,
              noPageErrors: window.cadErrors.length === 0,
              ...picker
            }
          };
        })()
        """, in: view, awaitPromise: true)
    guard let readings = readings as? [String: Any] else {
        throw CheckError(message: "WebKit returned an unexpected report")
    }
    return readings
}

let arguments = CommandLine.arguments
guard arguments.count == 3, let url = URL(string: arguments[1]),
      url.scheme == "http", url.host == "127.0.0.1" else {
    fputs("Usage: swift cad-wkwebview-check.swift <loopback URL> <report path>\n", stderr)
    exit(2)
}

let webKit = Bundle(for: WKWebView.self)
let system = ProcessInfo.processInfo
var report: [String: Any] = [
    "macOS": system.operatingSystemVersionString,
    "webkit": webKit.object(forInfoDictionaryKey: "CFBundleShortVersionString") ?? "unknown",
    "webkitBuild": webKit.object(forInfoDictionaryKey: "CFBundleVersion") ?? "unknown",
    "frameScheduler": "off-screen timer",
    "url": url.absoluteString,
]
var success = false
do {
    report.merge(try MainActor.assumeIsolated { try verify(url) }) { _, new in new }
    if let assertions = report["assertions"] as? [String: Bool] {
        success = !assertions.isEmpty && assertions.values.allSatisfy { $0 }
    }
} catch {
    report["failure"] = error.localizedDescription
    fputs("\(error.localizedDescription)\n", stderr)
}

do {
    let data = try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys])
    try data.write(to: URL(fileURLWithPath: arguments[2]))
    print("CAD WKWebView report: \(arguments[2])")
} catch {
    fputs("\(error.localizedDescription)\n", stderr)
    exit(1)
}
exit(success ? 0 : 1)
