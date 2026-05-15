import { NavLink } from "react-router-dom";

const ITEMS: { to: string; label: string; end?: boolean }[] = [
  { to: "/", label: "Workspace", end: true },
  { to: "/magic", label: "Magic Demo" },
  { to: "/pipeline", label: "Pipeline" },
];

export function Nav() {
  return (
    <nav className="w-48 border-r border-slate-200 bg-white shrink-0 flex flex-col">
      <ul className="py-2">
        {ITEMS.map((i) => (
          <li key={i.to}>
            <NavLink
              to={i.to}
              end={i.end}
              className={({ isActive }) =>
                `block text-sm px-3 py-1.5 mx-2 rounded ${
                  isActive
                    ? "bg-accent-50 text-accent-700 font-medium"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`
              }
            >
              {i.label}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="mt-auto p-3 text-2xs text-slate-400 leading-relaxed border-t border-slate-100">
        <div className="kicker mb-1">Reference</div>
        <a
          href="/api/data"
          className="block text-slate-500 hover:text-accent-700"
          target="_blank"
          rel="noreferrer"
        >
          Synthetic CSVs
        </a>
        <a
          href="https://github.com/anthropics/claude-code/issues"
          className="block text-slate-500 hover:text-accent-700"
          target="_blank"
          rel="noreferrer"
        >
          Docs
        </a>
      </div>
    </nav>
  );
}
