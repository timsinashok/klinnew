import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/shell/AppShell";
import { MagicDemo } from "./routes/MagicDemo";
import { PipelineDemo } from "./routes/PipelineDemo";
import { Workspace } from "./routes/Workspace";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Workspace />} />
          <Route path="/magic" element={<MagicDemo />} />
          <Route path="/pipeline" element={<PipelineDemo />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
