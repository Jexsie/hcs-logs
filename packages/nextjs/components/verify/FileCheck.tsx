"use client";

import { DragEvent, useState } from "react";
import { CheckCircleIcon, DocumentArrowUpIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { AnchoredMessage, compareRecord } from "~~/lib/verify";

type Result = Awaited<ReturnType<typeof compareRecord>>;

const readBytes = async (file: File) => new Uint8Array(await file.arrayBuffer());

// Files are hashed in the browser with Web Crypto and never leave the device: records hold business detail that is
// deliberately kept off the ledger.
export const FileCheck = ({ parcelId, anchors }: { parcelId: string; anchors: AnchoredMessage[] }) => {
  const [results, setResults] = useState<Result[]>([]);
  const [dragging, setDragging] = useState(false);

  const check = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }
    const checked = await Promise.all(
      Array.from(files, async file =>
        compareRecord(parcelId, { fileName: file.name, bytes: await readBytes(file) }, anchors),
      ),
    );
    setResults(checked);
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    void check(event.dataTransfer.files);
  };

  return (
    <div className="flex flex-col gap-4">
      <label
        htmlFor="record-files"
        onDragOver={event => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-box p-6 flex flex-col items-center gap-2 text-center cursor-pointer transition-colors ${
          dragging ? "border-primary bg-primary/5" : "border-base-300 hover:border-primary/60"
        }`}
      >
        <DocumentArrowUpIcon className="h-8 w-8 text-primary" />
        <span className="font-medium">Drop this parcel&apos;s JSON files here, or choose them</span>
        <span className="text-sm text-base-content/70">
          Files are checked in your browser and never uploaded anywhere.
        </span>
        <input
          id="record-files"
          type="file"
          accept=".json,application/json"
          multiple
          className="sr-only"
          onChange={event => void check(event.target.files)}
        />
      </label>

      {results.length > 0 && (
        <ul className="flex flex-col gap-2 list-none p-0 m-0" aria-live="polite">
          {results.map(({ fileName, hash, status, anchor }) => (
            <li
              key={`${fileName}-${hash}`}
              className={`alert ${status === "verified" ? "alert-success" : "alert-error"} items-start`}
            >
              {status === "verified" ? (
                <CheckCircleIcon className="h-6 w-6 shrink-0" />
              ) : (
                <XCircleIcon className="h-6 w-6 shrink-0" />
              )}
              <div className="flex flex-col gap-1 min-w-0">
                <span className="font-semibold break-all">
                  {fileName}: {status === "verified" ? "verified" : "does not match"}
                </span>
                <span className="text-sm">
                  {status === "verified"
                    ? `Matches the ${anchor?.kind} record anchored as message #${anchor?.sequenceNumber}. This file is exactly as it was when anchored.`
                    : `No anchor for ${parcelId} carries this file's fingerprint. It was changed after it was anchored, or it is not one of this parcel's records.`}
                </span>
                <code className="text-xs break-all opacity-80">sha256 {hash}</code>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
