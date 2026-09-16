import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { PublicEntry } from './screens/PublicEntry'
import { CheckpointScan } from './screens/CheckpointScan'
import { GameScreen } from './screens/GameScreen'
import { FinishScreen } from './screens/FinishScreen'
// Demo routes kept for visual development (Phase 0 prototypes)
import { DemoStart } from './screens/DemoStart'
import { DemoGame } from './screens/DemoGame'
import { DemoWrongCheckpoint } from './screens/DemoWrongCheckpoint'
import { OrganizerView } from './screens/OrganizerView'

/**
 * Application router.
 *
 * Production routes:
 *   /          → PublicEntry     (no session — show instruction)
 *   /q/:token  → CheckpointScan (QR scan handler — all game states)
 *   /game      → GameScreen      (active game — clue + step counter)
 *   /finish    → FinishScreen    (completed game)
 *
 * Demo routes (Phase 0 prototypes — local dev only):
 *   /demo/start            → start QR prototype (static)
 *   /demo/game             → active game prototype (static)
 *   /demo/wrong-checkpoint → wrong checkpoint prototype (static)
 */
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Production */}
        <Route path="/" element={<PublicEntry />} />
        <Route path="/q/:token" element={<CheckpointScan />} />
        <Route path="/game" element={<GameScreen />} />
        <Route path="/finish" element={<FinishScreen />} />

        {/* Phase 0 demo prototypes */}
        <Route path="/demo/start" element={<DemoStart />} />
        <Route path="/demo/game" element={<DemoGame />} />
        <Route path="/demo/wrong-checkpoint" element={<DemoWrongCheckpoint />} />
        
        {/* Organizer */}
        <Route path="/organizer" element={<OrganizerView />} />
      </Routes>
    </BrowserRouter>
  )
}
