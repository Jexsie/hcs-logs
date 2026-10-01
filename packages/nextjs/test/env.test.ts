import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ENV_FILE, loadEnvFile } from "~~/lib/client";

describe("loadEnvFile", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "hcs-logs-env-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("looks for .env at the repository root, where the CLI writes .env.example", () => {
    const root = path.dirname(ENV_FILE);

    expect(path.basename(ENV_FILE)).toBe(".env");
    expect(JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).workspaces.packages).toContain(
      "packages/nextjs",
    );
    expect(fs.existsSync(path.join(root, ".env.example"))).toBe(true);
  });

  it("loads variables from the file into the target environment", () => {
    const file = path.join(dir, ".env");
    fs.writeFileSync(file, "OPERATOR_ID=0.0.1234\nHEDERA_NETWORK=testnet\n");
    const target: Record<string, string | undefined> = {};

    loadEnvFile(file, target);

    expect(target).toEqual({ OPERATOR_ID: "0.0.1234", HEDERA_NETWORK: "testnet" });
  });

  it("keeps variables that are already set", () => {
    const file = path.join(dir, ".env");
    fs.writeFileSync(file, "HEDERA_NETWORK=testnet\n");
    const target: Record<string, string | undefined> = { HEDERA_NETWORK: "previewnet" };

    loadEnvFile(file, target);

    expect(target.HEDERA_NETWORK).toBe("previewnet");
  });

  it("ignores a missing file but not an unreadable one", () => {
    expect(() => loadEnvFile(path.join(dir, "missing.env"), {})).not.toThrow();
    expect(() => loadEnvFile(dir, {})).toThrow(`Could not read ${dir}`);
  });
});
