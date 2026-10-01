import * as fs from "fs";
import * as path from "path";
import { Anchor } from "~~/lib/types";

const DEFAULT_DATA_DIR = "data";

export const PARCEL_FILE = "parcel.json";
const PARCEL_ID_CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-";

// Parcel ids become folder names, so only A-Z, 0-9 and "-" are allowed. That also rules out separators and "..".
export const assertParcelId = (parcelId: string) => {
  if (!parcelId) {
    throw new Error("Parcel id is empty");
  }
  const invalid = [...parcelId].find(character => !PARCEL_ID_CHARACTERS.includes(character));
  if (invalid !== undefined) {
    throw new Error(`Parcel id "${parcelId}" contains "${invalid}". Use A-Z, 0-9 and "-", such as IND-2026-0041.`);
  }
};

const assertFileName = (fileName: string) => {
  if (path.basename(fileName) !== fileName) {
    throw new Error(`Record file name "${fileName}" must not contain a path`);
  }
  if (!fileName.endsWith(".json")) {
    throw new Error(`Record file name "${fileName}" must end in .json`);
  }
};

const parcelDir = (parcelId: string, dataDir = DEFAULT_DATA_DIR) => {
  assertParcelId(parcelId);
  return path.join(dataDir, parcelId);
};

export const parcelExists = (parcelId: string, dataDir = DEFAULT_DATA_DIR) =>
  fs.existsSync(parcelDir(parcelId, dataDir));

export const recordPath = (parcelId: string, fileName: string, dataDir = DEFAULT_DATA_DIR) => {
  assertFileName(fileName);
  return path.join(parcelDir(parcelId, dataDir), fileName);
};

export const recordExists = (parcelId: string, fileName: string, dataDir = DEFAULT_DATA_DIR) =>
  fs.existsSync(recordPath(parcelId, fileName, dataDir));

// Events are numbered in the order they were anchored: event-0001.json, event-0002.json, ...
export const nextEventFileName = (parcelId: string, dataDir = DEFAULT_DATA_DIR) => {
  const events = listRecordFiles(parcelId, dataDir).filter(fileName => fileName.startsWith("event-"));
  return `event-${String(events.length + 1).padStart(4, "0")}.json`;
};

// Never overwrites: every file on disk has exactly one anchor behind it.
export const writeRecord = (parcelId: string, fileName: string, bytes: Uint8Array, dataDir = DEFAULT_DATA_DIR) => {
  const filePath = recordPath(parcelId, fileName, dataDir);
  if (fs.existsSync(filePath)) {
    throw new Error(`Record "${filePath}" already exists and will not be overwritten`);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, bytes, { flag: "wx" });
  return filePath;
};

export const listRecordFiles = (parcelId: string, dataDir = DEFAULT_DATA_DIR) => {
  const dir = parcelDir(parcelId, dataDir);
  if (!fs.existsSync(dir)) {
    throw new Error(`No records for parcel "${parcelId}": ${dir} does not exist`);
  }
  return fs
    .readdirSync(dir)
    .filter(fileName => fileName.endsWith(".json"))
    .sort();
};

export const readRecords = (parcelId: string, dataDir = DEFAULT_DATA_DIR) =>
  listRecordFiles(parcelId, dataDir).map(fileName => ({
    fileName,
    kind: (fileName === PARCEL_FILE ? "parcel" : "event") as Anchor["kind"],
    bytes: fs.readFileSync(recordPath(parcelId, fileName, dataDir)),
  }));
