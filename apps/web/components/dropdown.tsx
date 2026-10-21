"use client";
import { useEffect, useId, useRef, useState, type ReactNode, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

export interface DropdownOption {
  value: string;
  label: string;
  leading?: ReactNode;
  detail?: string;
}
export function Dropdown({
  options,
  value,
  onChange,
  name,
  label,
  placeholder = "Select an option",
  searchPlaceholder = "Search options",
  compact = false,
  searchable = true,
  disabled = false,
  invalid = false,
  describedBy,
}: {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  name: string;
  label: string;
  placeholder?: string;
  searchPlaceholder?: string;
  compact?: boolean;
  searchable?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  const id = useId();
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
    dialog: HTMLDialogElement | null;
  } | null>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = options.find((item) => item.value === value);
  const filtered = options.filter((item) =>
    `${item.label} ${item.value} ${item.detail ?? ""}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  function close(restoreFocus = false) {
    setPosition(null);
    if (restoreFocus) triggerRef.current?.focus();
  }
  function select(next: string) {
    close(true);
    onChange(next);
  }
  function open() {
    if (disabled) return;
    if (position) {
      close();
      return;
    }
    const rect = triggerRef.current!.getBoundingClientRect();
    const dialog = triggerRef.current!.closest("dialog");
    const dialogRect = dialog?.getBoundingClientRect();
    const boundaryTop = 8;
    const boundaryBottom = window.innerHeight - 8;
    const boundaryLeft = 8;
    const boundaryRight = window.innerWidth - 8;
    const width = Math.min(Math.max(rect.width, 240), boundaryRight - boundaryLeft - 24);
    const below = boundaryBottom - rect.bottom - 12;
    const above = rect.top - boundaryTop - 12;
    const openBelow = below >= 280 || below >= above;
    const desiredHeight = Math.min(320, options.length * 40 + (searchable ? 64 : 14));
    const height = Math.min(desiredHeight, openBelow ? below : above);
    const screenLeft = Math.max(boundaryLeft + 12, Math.min(rect.left, boundaryRight - width - 12));
    const screenTop = openBelow ? rect.bottom + 8 : rect.top - height - 8;
    setQuery("");
    setActive(
      Math.max(
        0,
        options.findIndex((item) => item.value === value),
      ),
    );
    setPosition({
      left: dialogRect ? screenLeft - dialogRect.left : screenLeft,
      top: dialogRect ? screenTop - dialogRect.top : screenTop,
      width,
      height,
      dialog,
    });
  }
  useEffect(() => {
    if (!position) return;
    if (searchable) searchRef.current?.focus();
    else panelRef.current?.querySelector<HTMLElement>('[role="listbox"]')?.focus();
    function outside(event: PointerEvent) {
      if (
        !panelRef.current?.contains(event.target as Node) &&
        !triggerRef.current?.contains(event.target as Node)
      )
        setPosition(null);
    }
    function resize() {
      setPosition(null);
    }
    function scroll(event: Event) {
      if (!panelRef.current?.contains(event.target as Node)) setPosition(null);
    }
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", scroll, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", scroll, true);
    };
  }, [position, searchable]);
  useEffect(() => {
    if (position)
      document
        .getElementById(`${id}-option-${filtered[active]?.value}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [active, filtered, id, position]);
  function keyboard(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "Tab") close(true);
    else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) =>
        Math.max(0, Math.min(filtered.length - 1, index + (event.key === "ArrowDown" ? 1 : -1))),
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (filtered[active]) select(filtered[active].value);
    }
  }
  return (
    <>
      <button
        ref={triggerRef}
        className={
          compact ? "phone-country-trigger phone-country-display" : "registration-dropdown-trigger"
        }
        data-dropdown-name={name}
        type="button"
        aria-label={`${label}: ${selected?.label ?? placeholder}`}
        aria-haspopup="listbox"
        aria-expanded={Boolean(position)}
        aria-controls={position ? `${id}-options` : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={open}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            if (!position) open();
          }
        }}
      >
        {compact && (
          <span className="phone-country-flag" aria-hidden="true">
            {selected?.leading}
          </span>
        )}
        <span className={!selected ? "dropdown-placeholder" : ""}>
          {selected ? (compact ? selected.detail : selected.label) : placeholder}
        </span>
        <svg
          className={position ? "country-chevron-open" : ""}
          width="10"
          height="10"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path d="m3 4.5 3 3 3-3" />
        </svg>
      </button>
      <input type="hidden" name={name} value={value} disabled={disabled} />
      {position &&
        createPortal(
          <div
            ref={panelRef}
            className={`country-picker-panel${position.dialog ? " country-picker-panel-dialog" : ""}`}
            style={{
              top: position.top,
              left: position.left,
              width: position.width,
              maxHeight: position.height,
            }}
          >
            {searchable && (
              <div className="country-picker-search">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <circle cx="8" cy="8" r="5" />
                  <path d="m12 12 5 5" />
                </svg>
                <input
                  ref={searchRef}
                  type="search"
                  role="combobox"
                  aria-label={`Search ${label.toLowerCase()}`}
                  aria-expanded="true"
                  aria-autocomplete="list"
                  aria-controls={`${id}-options`}
                  aria-activedescendant={
                    filtered[active] ? `${id}-option-${filtered[active].value}` : undefined
                  }
                  value={query}
                  placeholder={searchPlaceholder}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActive(0);
                  }}
                  onKeyDown={keyboard}
                />
              </div>
            )}
            <div
              tabIndex={searchable ? undefined : -1}
              onKeyDown={searchable ? undefined : keyboard}
              aria-activedescendant={
                !searchable && filtered[active]
                  ? `${id}-option-${filtered[active].value}`
                  : undefined
              }
              className="country-picker-options"
              id={`${id}-options`}
              role="listbox"
              aria-label={label}
            >
              {filtered.map((item, index) => (
                <button
                  type="button"
                  role="option"
                  id={`${id}-option-${item.value}`}
                  key={item.value}
                  aria-selected={value === item.value}
                  tabIndex={-1}
                  className={`country-picker-option ${active === index ? "highlighted" : ""}`}
                  onMouseEnter={() => setActive(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => select(item.value)}
                >
                  {item.leading && (
                    <span className="phone-country-flag" aria-hidden="true">
                      {item.leading}
                    </span>
                  )}
                  <span className="country-option-name">{item.label}</span>
                  <span className="country-option-code">{item.detail}</span>
                  {value === item.value && (
                    <span className="country-option-check" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </button>
              ))}
            </div>
            {!filtered.length && (
              <p className="country-picker-empty" role="status">
                No matching options
              </p>
            )}
          </div>,
          position.dialog ?? document.body,
        )}
    </>
  );
}
