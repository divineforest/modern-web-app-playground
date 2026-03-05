import { execSync } from 'node:child_process';

export default function globalSetup() {
  try {
    execSync('pnpm db:seed:products', {
      cwd: '../../',
      stdio: 'inherit',
      env: { ...process.env },
    });
  } catch {
    console.warn(
      '[e2e global-setup] Product seeding failed (likely products already exist). Continuing...'
    );
  }
}
