import { expect, test } from "bun:test";
import tauri from "../../src-tauri/tauri.conf.json";

function directives(policy: string): Record<string, string> {
  return Object.fromEntries(
    policy.split("; ").map((directive) => {
      const firstSpace = directive.indexOf(" ");
      return [directive.slice(0, firstSpace), directive.slice(firstSpace + 1)];
    }),
  );
}

test("the production CSP allows WASM compilation and preserves unrelated directives", () => {
  const { ["script-src"]: script, ...rest } = directives(
    tauri.app.security.csp,
  );
  expect(script).toBe("'self' 'wasm-unsafe-eval'");
  expect(tauri.app.security.csp.split(/[\s;]+/)).not.toContain("'unsafe-eval'");
  expect(rest).toEqual({
    "default-src": "'self'",
    "style-src": "'self' 'unsafe-inline'",
    "img-src": "'self' data: blob:",
    "connect-src":
      "'self' ipc: http://ipc.localhost https: wss: http://localhost:* ws://localhost:* http://127.0.0.1:* ws://127.0.0.1:*",
    "object-src": "'none'",
    "base-uri": "'self'",
    "frame-src": "'self'",
  });
});

test("the development CSP keeps its previous sources and adds WASM compilation", () => {
  const { ["script-src"]: script, ...rest } = directives(
    tauri.app.security.devCsp,
  );
  expect(script).toBe(
    "'self' 'unsafe-inline' http://localhost:1420 'wasm-unsafe-eval'",
  );
  expect(tauri.app.security.devCsp.split(/[\s;]+/)).not.toContain(
    "'unsafe-eval'",
  );
  expect(rest).toEqual({
    "default-src": "'self' http://localhost:1420",
    "style-src": "'self' 'unsafe-inline' http://localhost:1420",
    "img-src": "'self' data: blob: http://localhost:1420",
    "connect-src":
      "'self' ipc: http://ipc.localhost http://localhost:1420 ws://localhost:1420 https: wss: http://localhost:* ws://localhost:* http://127.0.0.1:* ws://127.0.0.1:*",
    "object-src": "'none'",
  });
});
