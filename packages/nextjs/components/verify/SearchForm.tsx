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

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSearch(value);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 w-full" role="search">
      <label htmlFor="parcel-id" className="sr-only">
        Parcel ID
      </label>
      <input
        id="parcel-id"
        className="input input-bordered w-full font-mono uppercase"
        placeholder="Parcel ID, e.g. IND-2026-0041"
        value={value}
        onChange={event => setValue(event.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
      <button type="submit" className="btn btn-primary sm:w-36" disabled={busy || !value.trim()}>
        {busy ? <span className="loading loading-spinner loading-sm" /> : <MagnifyingGlassIcon className="h-5 w-5" />}
        Search
      </button>
    </form>
  );
};
