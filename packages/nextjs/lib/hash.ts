import { createHash } from "crypto";

// Hashes the bytes exactly as stored. Never parse or normalize first: the file on disk is the artifact.
export const hashBytes = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
