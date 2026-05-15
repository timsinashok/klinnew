import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Home } from "./routes/Home";
import { MagicDemo } from "./routes/MagicDemo";
import { PipelineDemo } from "./routes/PipelineDemo";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/magic" element={<MagicDemo />} />
        <Route path="/pipeline" element={<PipelineDemo />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
