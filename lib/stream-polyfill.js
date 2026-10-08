// pdf.js reads streams with `for await (const chunk of stream)`, which needs
// ReadableStream to be async-iterable. Safari (iOS/macOS) doesn't support that yet,
// so PDF uploads failed there with "undefined is not a function (near '...t of e...')".
// This file runs on the page (imported by lib/pdf.ts) and inside the pdf.js worker
// (inlined into public/pdf-worker.mjs by scripts/copy-pdf-worker.mjs).
if (typeof ReadableStream !== "undefined" && !ReadableStream.prototype[Symbol.asyncIterator]) {
  const values = async function* ({ preventCancel = false } = {}) {
    const reader = this.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) return;
        yield value;
      }
    } finally {
      if (!preventCancel) reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  };
  Object.defineProperty(ReadableStream.prototype, "values", { value: values, writable: true, configurable: true });
  Object.defineProperty(ReadableStream.prototype, Symbol.asyncIterator, { value: values, writable: true, configurable: true });
}
