import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/shell/AppShell";
import { isProtocolUploaded } from "./lib/persistence";
import {
  DEMO_STUDY,
  getCurrentStudyId,
  hasVisitedApp,
  setCurrentStudy,
} from "./lib/studies";
import { CreateStudy } from "./routes/CreateStudy";
import { Landing } from "./routes/Landing";
import { MagicDemo } from "./routes/MagicDemo";
import { Onboarding } from "./routes/Onboarding";
import { PipelineDemo } from "./routes/PipelineDemo";
import { Protocol } from "./routes/Protocol";
import { Sources } from "./routes/Sources";
import { Studies } from "./routes/Studies";
import { Workspace } from "./routes/Workspace";

function RootRouter() {
  const visited = hasVisitedApp();
  const currentStudy = getCurrentStudyId();

  // First-ever visit → landing page.
  if (!visited) return <Landing />;

  // Inside the app but no study selected → studies dashboard.
  if (!currentStudy) return <Navigate to="/studies" replace />;

  // Demo study needs the protocol "uploaded" once (carries over from
  // earlier sessions). Other studies auto-skip the gate because the
  // create-study flow already simulated the extraction.
  if (currentStudy === DEMO_STUDY.id && !isProtocolUploaded()) {
    return <Onboarding />;
  }

  return <Workspace />;
}

function StudyRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  // Sub-routes that operate on the "current study". If none, send to picker.
  const currentStudy = getCurrentStudyId();
  if (!hasVisitedApp()) {
    // Initialise the first-ever visit so /magic deep links still work.
    return <Navigate to="/welcome" replace />;
  }
  if (!currentStudy) {
    setCurrentStudy(DEMO_STUDY.id); // safe default
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/welcome" element={<Landing />} />
        <Route path="/studies" element={<Studies />} />
        <Route path="/studies/new" element={<CreateStudy />} />
        <Route path="/setup" element={<Onboarding />} />
        <Route element={<AppShell />}>
          <Route path="/" element={<RootRouter />} />
          <Route
            path="/protocol"
            element={
              <StudyRoute>
                <Protocol />
              </StudyRoute>
            }
          />
          <Route
            path="/sources"
            element={
              <StudyRoute>
                <Sources />
              </StudyRoute>
            }
          />
          <Route
            path="/magic"
            element={
              <StudyRoute>
                <MagicDemo />
              </StudyRoute>
            }
          />
          <Route
            path="/pipeline"
            element={
              <StudyRoute>
                <PipelineDemo />
              </StudyRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
