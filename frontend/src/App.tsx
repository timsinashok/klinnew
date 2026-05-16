import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/shell/AppShell";
import { isProtocolUploaded } from "./lib/persistence";
import {
  DEMO_STUDY,
  getCurrentStudyId,
  setCurrentStudy,
} from "./lib/studies";
import { CreateStudy } from "./routes/CreateStudy";
import { Datasets } from "./routes/Datasets";
import { IssueTracker } from "./routes/IssueTracker";
import { Landing } from "./routes/Landing";
import { MagicDemo } from "./routes/MagicDemo";
import { Onboarding } from "./routes/Onboarding";
import { PipelineDemo } from "./routes/PipelineDemo";
import { Protocol } from "./routes/Protocol";
import { Sources } from "./routes/Sources";
import { Studies } from "./routes/Studies";
import { Workspace } from "./routes/Workspace";

function PlatformRouter() {
  const currentStudy = getCurrentStudyId();
  if (!currentStudy) return <Navigate to="/studies" replace />;
  if (currentStudy === DEMO_STUDY.id && !isProtocolUploaded()) {
    return <Onboarding />;
  }
  return <Workspace />;
}

function StudyRoute({ children }: { children: React.ReactNode }) {
  const currentStudy = getCurrentStudyId();
  if (!currentStudy) {
    setCurrentStudy(DEMO_STUDY.id);
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/welcome" element={<Navigate to="/" replace />} />
        <Route path="/studies" element={<Studies />} />
        <Route path="/studies/new" element={<CreateStudy />} />
        <Route path="/setup" element={<Onboarding />} />
        <Route element={<AppShell />}>
          <Route path="/platform" element={<PlatformRouter />} />
          <Route
            path="/platform/protocol"
            element={
              <StudyRoute>
                <Protocol />
              </StudyRoute>
            }
          />
          <Route
            path="/platform/sources"
            element={
              <StudyRoute>
                <Sources />
              </StudyRoute>
            }
          />
          <Route
            path="/platform/visit"
            element={
              <StudyRoute>
                <MagicDemo />
              </StudyRoute>
            }
          />
          <Route
            path="/platform/pipeline"
            element={
              <StudyRoute>
                <PipelineDemo />
              </StudyRoute>
            }
          />
          <Route
            path="/platform/issues"
            element={
              <StudyRoute>
                <IssueTracker />
              </StudyRoute>
            }
          />
          <Route
            path="/platform/datasets"
            element={
              <StudyRoute>
                <Datasets />
              </StudyRoute>
            }
          />
          {/* Legacy / shorter aliases — useful for old bookmarks. */}
          <Route
            path="/protocol"
            element={<Navigate to="/platform/protocol" replace />}
          />
          <Route
            path="/sources"
            element={<Navigate to="/platform/sources" replace />}
          />
          <Route
            path="/magic"
            element={<Navigate to="/platform/visit" replace />}
          />
          <Route
            path="/pipeline"
            element={<Navigate to="/platform/pipeline" replace />}
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
