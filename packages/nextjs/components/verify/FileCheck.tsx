"use client";

import { DragEvent, useState } from "react";
import { DocumentArrowUpIcon } from "@heroicons/react/24/outline";

// Only collects files; checking happens in the caller. Nothing is uploaded.
export const FileCheck = ({ onFiles }: { onFiles: (files: File[]) => void }) => {
  const [dragging, setDragging] = useState(false);

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    onFiles(Array.from(event.dataTransfer.files));
  };

  return (
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
      <span className="font-medium">Drop your documents here, or choose files</span>
      <span className="text-sm text-base-content/70">They stay on your device and are never uploaded.</span>
      <input
        id="record-files"
        type="file"
        accept=".json,application/json"
        multiple
        className="sr-only"
        onChange={event => onFiles(Array.from(event.target.files ?? []))}
      />
    </label>
  );
};
