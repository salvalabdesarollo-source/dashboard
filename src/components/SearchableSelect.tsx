"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Option = {
  value: string;
  label: string;
};

type SearchableSelectProps = {
  options: Option[];
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
  disabled?: boolean;
  emptyLabel?: string;
};

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Buscar...",
  disabled = false,
  emptyLabel = "Selecciona una opcion",
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selectedLabel = useMemo(() => {
    if (!value) return "";
    return options.find((option) => option.value === value)?.label ?? "";
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    if (!query) return options;
    const lowered = query.toLowerCase();
    return options.filter((option) =>
      option.label.toLowerCase().includes(lowered),
    );
  }, [options, query]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) setQuery("");
  }, [isOpen]);


  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-left text-sm text-slate-900 focus:border-sky-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={disabled}
      >
        <span className={selectedLabel ? "" : "text-slate-400"}>
          {selectedLabel || emptyLabel}
        </span>
        <span className="text-slate-400">▾</span>
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-20 mt-2 w-full rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 p-2">
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none"
              placeholder={placeholder}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-500">
                Sin resultados
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    onChange(option.value);
                    setIsOpen(false);
                    setQuery("");
                  }}
                >
                  {option.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
