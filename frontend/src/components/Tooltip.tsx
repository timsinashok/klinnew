import { useState } from "react";

export function Tooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <button
        type="button"
        className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-neutral-200 text-neutral-700 text-[10px] font-semibold hover:bg-neutral-300"
        aria-label="More info"
      >
        ?
      </button>
      {open && (
        <span className="absolute z-20 left-5 top-1/2 -translate-y-1/2 w-64 text-xs bg-neutral-900 text-white rounded p-2 shadow-lg pointer-events-none">
          {text}
        </span>
      )}
    </span>
  );
}
