import { useState } from "react";

export function Tooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-flex align-middle ml-1"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <button
        type="button"
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-slate-300 text-slate-500 text-[9px] font-semibold leading-none hover:border-slate-500 hover:text-slate-700"
        aria-label="More info"
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-30 left-5 top-1/2 -translate-y-1/2 w-64 text-2xs leading-snug bg-slate-900 text-slate-100 rounded p-2 shadow-lg pointer-events-none"
        >
          {text}
        </span>
      )}
    </span>
  );
}
