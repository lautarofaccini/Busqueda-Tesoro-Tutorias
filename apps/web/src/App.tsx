import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { PublicEntry } from './screens/PublicEntry'
import { DemoStart } from './screens/DemoStart'
import { DemoGame } from './screens/DemoGame'
import { DemoWrongCheckpoint } from './screens/DemoWrongCheckpoint'

/**
 * Application router.
 *
 * Production routes:
 *   /          → PublicEntry
 *   /q/:token  → checkpoint handler (not yet implemented)
 *
 * Demo routes (Phase 0 — development only):
 *   /demo/start            → start QR prototype
 *   /demo/game             → active game prototype
 *   /demo/wrong-checkpoint → wrong checkpoint prototype
 */
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicEntry />} />
        <Route path="/demo/start" element={<DemoStart />} />
        <Route path="/demo/game" element={<DemoGame />} />
        <Route path="/demo/wrong-checkpoint" element={<DemoWrongCheckpoint />} />
      </Routes>
    </BrowserRouter>
  )
}
