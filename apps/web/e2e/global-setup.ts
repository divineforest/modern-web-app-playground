import { execSync } from 'node:child_process';

const BACKEND_URL = 'http://localhost:3000';

export default async function globalSetup() {
  // Check if products already exist — avoid seeding (and failing on FK constraints)
  // when the DB already has data from a previous run.
  try {
    const res = await fetch(`${BACKEND_URL}/api/products?limit=1`);
    if (res.ok) {
      const body = (await res.json()) as { pagination?: { total?: number } };
      if ((body.pagination?.total ?? 0) > 0) {
        console.log('[e2e global-setup] Products already exist, skipping seed.');
        return;
      }
    }
  } catch {
    // Backend not reachable yet — fall through to seed
  }

  try {
    execSync('pnpm db:seed:products', {
      cwd: '../../',
      stdio: 'inherit',
      env: { ...process.env },
    });
  } catch {
    console.warn('[e2e global-setup] Product seeding failed. Continuing...');
  }
}
