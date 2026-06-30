import { execSync } from 'node:child_process'
import path from 'node:path'

// Guarantee the verified demo user exists before the suite runs, in whatever DB
// the backend is using. The seed is idempotent and only needs Postgres (not the
// API), so it is safe to run here before the web servers start.
export default function globalSetup(): void {
  // Playwright runs from the frontend dir, so the backend is a sibling.
  const backendDir = path.resolve(process.cwd(), '..', 'backend')
  execSync('npm run seed', { cwd: backendDir, stdio: 'inherit' })
}
