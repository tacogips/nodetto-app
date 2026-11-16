import { expect, test } from "bun:test";
import { generateInterfaceCode } from "./interface-code.ts";
import { document, element, makeEditor } from "./test-helpers.ts";

test("HTML escapes snippet source and language", () => {
  const frame = element({
    id: "frame",
    type: "frame",
    semantic: { name: "Screen", memberIds: ["code", "markdown"] },
    visual: { x: 0, y: 0, width: 400, height: 400 },
  });
  const code = element({
    id: "code",
    index: "a2",
    type: "text.code",
    semantic: { code: "</pre><script>&", language: 'rust" onload="bad' },
    visual: { x: 0, y: 0, width: 100, height: 100 },
  });
  const markdown = element({
    id: "markdown",
    index: "a3",
    type: "text.markdown",
    semantic: { markdown: "<b>& source" },
    visual: { x: 0, y: 120, width: 100, height: 100 },
  });
  const editor = makeEditor({ document: document([frame, code, markdown]) });
  const html = generateInterfaceCode(editor, "frame")?.html;
  expect(html).toContain(
    '<pre><code class="language-rust&quot; onload=&quot;bad">&lt;/pre&gt;&lt;script&gt;&amp;</code></pre>',
  );
  expect(html).toContain(
    '<div style="white-space:pre-wrap">&lt;b&gt;&amp; source</div>',
  );
});
