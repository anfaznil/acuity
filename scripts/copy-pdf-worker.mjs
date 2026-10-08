import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

// The *legacy* pdf.js build polyfills newer JS (Map.getOrInsertComputed, Math.sumPrecise, …)
// that Safari and older browsers lack. The modern build only runs on the very latest browsers.
const src = "node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs";
if (existsSync(src)) {
  mkdirSync("public", { recursive: true });
  copyFileSync(src, "public/pdf.worker.min.mjs");
  // Worker entry: install the async-iterable ReadableStream polyfill, then load pdf.js.
  // (Module imports evaluate in order, so the polyfill runs first.)
  writeFileSync("public/pdf-stream-polyfill.mjs", readFileSync("lib/stream-polyfill.js", "utf8"));
  writeFileSync("public/pdf-worker.mjs", 'import "./pdf-stream-polyfill.mjs";\nimport "./pdf.worker.min.mjs";\n');
  console.log("Copied pdf.js worker (legacy build + stream polyfill) to public/");
}
