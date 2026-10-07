import "server-only";
import { BlobNotFoundError, BlobPreconditionFailedError, get, put } from "@vercel/blob";

// Tiny JSON document store on a *private* Vercel Blob store.
//   users/<username>.json  → login record
//   data/<username>.json   → that user's synced app state

export { BlobPreconditionFailedError };

export const userPath = (u: string) => `users/${u}.json`;
export const dataPath = (u: string) => `data/${u}.json`;

export async function readJson<T>(path: string): Promise<{ data: T; etag: string } | null> {
  try {
    const res = await get(path, { access: "private", useCache: false });
    if (!res || res.statusCode !== 200) return null;
    const text = await new Response(res.stream).text();
    // Compressed responses carry a weak ETag (W/"…"); conditional writes need the strong form.
    return { data: JSON.parse(text) as T, etag: res.blob.etag.replace(/^W\//, "") };
  } catch (err) {
    if (err instanceof BlobNotFoundError) return null;
    throw err;
  }
}

/**
 * Write a document. `ifMatch` makes the write fail if someone else wrote in between;
 * `createOnly` makes it fail if the document already exists.
 */
export async function writeJson(path: string, data: unknown, opts: { ifMatch?: string; createOnly?: boolean } = {}) {
  return put(path, JSON.stringify(data), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: !opts.createOnly,
    contentType: "application/json",
    cacheControlMaxAge: 60,
    ...(opts.ifMatch ? { ifMatch: opts.ifMatch } : {}),
  });
}
