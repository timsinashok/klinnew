import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/shell/AppShell";
import { isProtocolUploaded } from "./lib/persistence";
import { MagicDemo } from "./routes/MagicDemo";
import { Onboarding } from "./routes/Onboarding";
import { PipelineDemo } from "./routes/PipelineDemo";
import { Protocol } from "./routes/Protocol";
import { Sources } from "./routes/Sources";
import { Workspace } from "./routes/Workspace";

function WorkspaceOrOnboarding() {
  if (!isProtocolUploaded()) return <Onboarding />;
  return <Workspace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/setup" element={<Onboarding />} />
        <Route element={<AppShell />}>
          <Route path="/" element={<WorkspaceOrOnboarding />} />
          <Route path="/protocol" element={<Protocol />} />
          <Route path="/sources" element={<Sources />} />
          <Route path="/magic" element={<MagicDemo />} />
          <Route path="/pipeline" element={<PipelineDemo />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
