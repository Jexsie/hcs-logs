"use client";

import { FormEvent, useEffect, useState } from "react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";

export const SearchForm = ({
  initialValue,
  busy,
  onSearch,
}: {
  initialValue: string;
  busy: boolean;
  onSearch: (parcelId: string) => void;
}) => {
  const [value, setValue] = useState(initialValue);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setMissing(!value.trim());
    if (value.trim()) {
      onSearch(value);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 w-full" role="search">
      <label htmlFor="parcel-id" className="font-medium">
        Parcel ID
      </label>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          id="parcel-id"
          className="input input-bordered input-lg w-full font-mono uppercase"
          placeholder="e.g. IND-2026-0041"
          value={value}
          onChange={event => setValue(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={missing}
          aria-describedby={missing ? "parcel-id-hint" : undefined}
        />
        <button type="submit" className="btn btn-primary btn-lg sm:w-40" disabled={busy}>
          {busy ? <span className="loading loading-spinner loading-sm" /> : <MagnifyingGlassIcon className="h-5 w-5" />}
          Search
        </button>
      </div>
      {missing && (
        <p id="parcel-id-hint" className="m-0 text-sm text-error">
          Enter the parcel ID you were given to search.
        </p>
      )}
    </form>
  );
};
