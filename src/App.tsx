import { Canvas2D } from "./ui/Canvas2D";
import {
  ContainerPanel,
  ExportPanel,
  PocketPanel,
  ProjectBar,
  ToolLibraryPanel,
  VerifyPanel,
} from "./ui/panels";

export default function App() {
  return (
    <div className="app">
      <ProjectBar />
      <div className="body">
        <aside className="col left">
          <ContainerPanel />
          <ToolLibraryPanel />
        </aside>
        <main className="col center">
          <Canvas2D />
        </main>
        <aside className="col right">
          <PocketPanel />
          <VerifyPanel />
          <ExportPanel />
        </aside>
      </div>
      <footer className="app-foot">
        PACKOUT Organizer Designer · runs entirely in your browser · nothing is uploaded
      </footer>
    </div>
  );
}
