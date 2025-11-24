"use client";

import { useState, useRef, useEffect } from "react";
import { Location } from "@/lib/services/locations";

type Props = {
  value: string;
  onChange: (value: string) => void;
  locations: Location[];
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

export function LocationSelect({
  value,
  onChange,
  locations,
  disabled = false,
  placeholder = "Selecciona una ubicación",
  className = "",
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredLocations = locations.filter((location) =>
    location.codigo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedLocation = locations.find((loc) => loc.codigo === value);
  const displayValue = selectedLocation?.codigo || "";

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && filteredLocations.length > 0) {
      setHighlightedIndex(0);
    }
  }, [searchTerm, isOpen, filteredLocations.length]);

  const handleSelect = (location: Location) => {
    onChange(location.codigo);
    setIsOpen(false);
    setSearchTerm("");
    inputRef.current?.blur();
  };

  const handleClear = () => {
    onChange("");
    setSearchTerm("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setHighlightedIndex((prev) =>
            prev < filteredLocations.length - 1 ? prev + 1 : prev
          );
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        if (isOpen) {
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        }
        break;
      case "Enter":
        e.preventDefault();
        if (isOpen && filteredLocations[highlightedIndex]) {
          handleSelect(filteredLocations[highlightedIndex]);
        } else {
          setIsOpen(true);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setSearchTerm("");
        break;
      case "Tab":
        setIsOpen(false);
        setSearchTerm("");
        break;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  const handleInputFocus = () => {
    if (!disabled) {
      setIsOpen(true);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? searchTerm : displayValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          className="w-full rounded-md border border-[var(--primary-muted)] bg-white px-4 py-2 pr-20 text-sm text-[var(--primary-dark)] focus:border-[var(--primary)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          autoComplete="off"
        />
        <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-2">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="rounded p-1 text-[var(--primary)] hover:bg-[var(--primary-soft)] focus:outline-none"
              tabIndex={-1}
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            className="rounded p-1 text-[var(--primary)] hover:bg-[var(--primary-soft)] focus:outline-none disabled:cursor-not-allowed"
            disabled={disabled}
            tabIndex={-1}
          >
            <svg
              className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-[var(--primary-muted)] bg-white shadow-lg">
          {filteredLocations.length === 0 ? (
            <div className="px-4 py-3 text-sm text-[var(--primary)]">
              No se encontraron ubicaciones
            </div>
          ) : (
            <ul className="py-1">
              {filteredLocations.map((location, index) => (
                <li key={location.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(location)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`w-full px-4 py-2 text-left text-sm transition ${
                      index === highlightedIndex
                        ? "bg-[var(--primary)] text-white"
                        : value === location.codigo
                        ? "bg-[var(--primary-soft)] text-[var(--primary-dark)]"
                        : "text-[var(--primary-dark)] hover:bg-[var(--primary-soft)]"
                    }`}
                  >
                    {location.codigo}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
