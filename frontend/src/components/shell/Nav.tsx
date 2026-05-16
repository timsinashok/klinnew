import { Link, NavLink, useParams } from "react-router-dom";
import { getStudy, studyPath } from "../../lib/studies";

const ITEMS: { suffix: string; label: string; end?: boolean; icon: React.ReactNode }[] = [
  { suffix: "", label: "Home", end: true, icon: <HomeIcon /> },
  { suffix: "/issues", label: "Issue tracker", icon: <IssueIcon /> },
  { suffix: "/datasets", label: "Datasets", icon: <DatasetIcon /> },
];

export function Nav() {
  const { studyId = "" } = useParams<{ studyId: string }>();
  const study = getStudy(studyId);
  return (
    <nav className="w-52 border-r border-stone-200 bg-white shrink-0 flex flex-col">
      <Link
        to="/platform"
        className="flex items-center gap-2 px-3 py-2.5 mx-2 mt-3 mb-1 text-2xs text-slate-500 hover:text-accent-700 hover:bg-stone-50 rounded transition group"
        title="Back to all studies"
      >
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="uppercase tracking-wider font-semibold">
          All studies
        </span>
      </Link>
      {study && (
        <div className="mx-4 mb-2 pb-3 border-b border-stone-100">
          <div className="mono text-2xs text-slate-400 truncate" title={study.id}>
            {study.id}
          </div>
          <div className="text-xs font-medium text-slate-900 leading-snug mt-0.5 line-clamp-2">
            {study.name}
          </div>
        </div>
      )}
      <ul className="pb-3">
        {ITEMS.map((i) => (
          <li key={i.suffix || "home"}>
            <NavLink
              to={studyPath(studyId, i.suffix)}
              end={i.end}
              className={({ isActive }) =>
                `flex items-center gap-2 text-sm px-3 py-2 mx-2 rounded transition ${
                  isActive
                    ? "bg-accent-50 text-accent-700 font-medium"
                    : "text-slate-600 hover:bg-stone-50 hover:text-slate-900"
                }`
              }
            >
              {i.icon}
              {i.label}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="mt-auto p-3 text-2xs text-slate-400 leading-relaxed border-t border-stone-100">
        <div className="kicker mb-1.5">Reference</div>
        <a
          href="http://127.0.0.1:8000/docs"
          className="block text-slate-500 hover:text-accent-700"
          target="_blank"
          rel="noreferrer"
        >
          API reference
        </a>
      </div>
    </nav>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-7H10v7H5a1 1 0 01-1-1v-9z" strokeLinejoin="round" />
    </svg>
  );
}

function IssueIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5M12 16h.01" strokeLinecap="round" />
    </svg>
  );
}

function DatasetIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <ellipse cx="12" cy="6" rx="8" ry="3" />
      <path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
    </svg>
  );
}
