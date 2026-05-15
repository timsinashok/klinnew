import { Outlet } from "react-router-dom";
import { Nav } from "./Nav";
import { UtilityBar } from "./UtilityBar";

export function AppShell() {
  return (
    <div className="h-screen flex flex-col bg-slate-50">
      <UtilityBar llmOn={true} />
      <div className="flex-1 flex min-h-0">
        <Nav />
        <main className="flex-1 min-w-0 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
