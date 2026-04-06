import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createMigrationClient } from './index.js';

async function runMigrations() {
  console.log('Running migrations...');
  
  const db = createMigrationClient();
  
  await migrate(db, { migrationsFolder: './drizzle' });
  
  console.log('Migrations completed!');
  process.exit(0);
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
