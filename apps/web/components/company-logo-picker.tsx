"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { prepareCompanyLogo } from "../lib/company-logo";
import { errorMessage } from "../lib/api";

export function CompanyLogoPicker({
  value,
  onChange,
  onBusyChange,
  disabled = false,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  onBusyChange: (busy: boolean) => void;
  disabled?: boolean;
}) {
  const request = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(
    () => () => {
      request.current++;
      onBusyChange(false);
    },
    [onBusyChange],
  );
  return (
    <div className="company-logo-picker">
      <div className="company-logo-label">
        Company logo <span className="optional">Optional</span>
      </div>
      <div className="company-logo-upload">
        <div className="company-logo-preview">
          {value ? (
            <Image
              src={value}
              alt="Company logo preview"
              width={64}
              height={64}
              unoptimized
            />
          ) : (
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="18" height="18" rx="4" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m3 16 5-5 4 4 4-4 5 5" />
            </svg>
          )}
        </div>
        <div className="company-logo-controls">
          <div className="company-logo-buttons">
            <button
              type="button"
              className="button secondary compact"
              disabled={disabled || busy}
              onClick={() => fileInput.current?.click()}
            >
              {busy ? "Preparing…" : value ? "Change logo" : "Upload logo"}
            </button>
            {value && (
              <button
                type="button"
                className="text-button"
                disabled={disabled || busy}
                onClick={() => {
                  setError("");
                  onChange(null);
                }}
              >
                Remove
              </button>
            )}
          </div>
          <p className="field-hint">PNG, JPEG or WebP · Up to 5 MB</p>
          <p className="field-hint">
            Resized automatically to fit your workspace.
          </p>
        </div>
      </div>
      <input
        ref={fileInput}
        className="company-logo-file-input"
        aria-label="Choose company logo"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        disabled={disabled || busy}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          const current = ++request.current;
          setError("");
          setBusy(true);
          onBusyChange(true);
          try {
            const logo = await prepareCompanyLogo(file);
            if (current === request.current) onChange(logo);
          } catch (failure) {
            if (current === request.current) setError(errorMessage(failure));
          } finally {
            if (current === request.current) {
              setBusy(false);
              onBusyChange(false);
            }
          }
        }}
      />
      {busy && <p role="status">Preparing logo…</p>}
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
