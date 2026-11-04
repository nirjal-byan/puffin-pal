import { useEffect, useRef, useState } from "react";
export function DebouncedSearch({
  value,
  onChange,
  placeholder,
  label = "Search records",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}) {
  const [draft, setDraft] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const change = useRef(onChange);
  useEffect(() => {
    change.current = onChange;
  }, [onChange]);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) setDraft(value);
    });
    return () => {
      active = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value]);
  return (
    <input
      aria-label={label}
      maxLength={160}
      type="search"
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          if (timer.current) clearTimeout(timer.current);
          change.current(draft);
        }
      }}
      placeholder={placeholder}
      value={draft}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => change.current(next), 250);
      }}
    />
  );
}
