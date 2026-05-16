import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useParams,
} from "react-router-dom";
import { AppShell } from "./components/shell/AppShell";
import { isProtocolUploaded } from "./lib/persistence";
import {
  DEMO_STUDY,
  getStudy,
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

function StudyGuard({ children }: { children: React.ReactNode }) {
  const { studyId = "" } = useParams<{ studyId: string }>();
  const study = getStudy(studyId);
  if (!study) return <Navigate to="/platform" replace />;
  // Side-effect: keep localStorage current_study in sync with the URL so
  // sub-components that still read it (UtilityBar, persistence helpers,
  // SourceUploadModal etc.) operate on the right study.
  if (typeof window !== "undefined") setCurrentStudy(study.id);
  if (study.is_demo && !isProtocolUploaded()) {
    return <Onboarding />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/welcome" element={<Navigate to="/" replace />} />

        {/* Studies dashboard lives at /platform; no app shell here. */}
        <Route path="/platform" element={<Studies />} />
        <Route path="/platform/new" element={<CreateStudy />} />

        {/* Per-study shell. studyId is part of the URL. */}
        <Route element={<AppShell />}>
          <Route
            path="/platform/:studyId"
            element={
              <StudyGuard>
                <Workspace />
              </StudyGuard>
            }
          />
          <Route
            path="/platform/:studyId/protocol"
            element={
              <StudyGuard>
                <Protocol />
              </StudyGuard>
            }
          />
          <Route
            path="/platform/:studyId/sources"
            element={
              <StudyGuard>
                <Sources />
              </StudyGuard>
            }
          />
          <Route
            path="/platform/:studyId/visit"
            element={
              <StudyGuard>
                <MagicDemo />
              </StudyGuard>
            }
          />
          <Route
            path="/platform/:studyId/pipeline"
            element={
              <StudyGuard>
                <PipelineDemo />
              </StudyGuard>
            }
          />
          <Route
            path="/platform/:studyId/issues"
            element={
              <StudyGuard>
                <IssueTracker />
              </StudyGuard>
            }
          />
          <Route
            path="/platform/:studyId/datasets"
            element={
              <StudyGuard>
                <Datasets />
              </StudyGuard>
            }
          />
        </Route>

        {/* Legacy aliases — preserve old bookmarks. */}
        <Route path="/studies" element={<Navigate to="/platform" replace />} />
        <Route
          path="/studies/new"
          element={<Navigate to="/platform/new" replace />}
        />
        <Route path="/setup" element={<Onboarding />} />
        <Route
          path="/protocol"
          element={
            <Navigate
              to={`/platform/${DEMO_STUDY.id}/protocol`}
              replace
            />
          }
        />
        <Route
          path="/sources"
          element={
            <Navigate to={`/platform/${DEMO_STUDY.id}/sources`} replace />
          }
        />
        <Route
          path="/magic"
          element={<Navigate to={`/platform/${DEMO_STUDY.id}/visit`} replace />}
        />
        <Route
          path="/pipeline"
          element={
            <Navigate to={`/platform/${DEMO_STUDY.id}/pipeline`} replace />
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
