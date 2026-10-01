// Hashes the bytes exactly as stored. Never parse or normalize first: the file on disk is the artifact.
// Web Crypto behaves the same in Node and in the browser, so the CLI and the verification page share one hash.
export const hashBytes = async (bytes: Uint8Array) => {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
};
