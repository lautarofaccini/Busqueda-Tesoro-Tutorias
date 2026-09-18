import { rm } from 'fs/promises';
import { join } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = join(__dirname, '..');
const apiDir = join(repoRoot, 'apps', 'api');
const d1Dir = join(apiDir, '.wrangler', 'state', 'v3', 'd1');

async function main() {
  console.log('🗑️  Deleting local D1 state directory...');
  try {
    await rm(d1Dir, { recursive: true, force: true });
    console.log('✅ Local D1 state deleted.');
  } catch (e) {
    console.log('⚠️  Could not delete (might not exist yet):', e.message);
  }

  console.log('\n🚀 Applying migrations...');
  try {
    execSync('npx wrangler d1 migrations apply busqueda-tesoro-db --local', { 
      cwd: apiDir, 
      stdio: 'inherit' 
    });
    console.log('✅ Migrations applied.');
  } catch (e) {
    console.error('❌ Migrations failed!');
    process.exit(1);
  }

  console.log('\n🌱 Seeding database...');
  try {
    execSync('npx wrangler d1 execute busqueda-tesoro-db --local --file=../../seed/demo.sql', { 
      cwd: apiDir, 
      stdio: 'inherit' 
    });
    console.log('✅ Database seeded.');
  } catch (e) {
    console.error('❌ Seeding failed!');
    process.exit(1);
  }
}

main().catch(console.error);
