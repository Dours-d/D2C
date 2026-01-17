const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const migrationsDir = __dirname;

const loadSqlFiles = () => {
  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => ({
      file,
      sql: fs.readFileSync(path.join(migrationsDir, file), 'utf8')
    }));
};

const runMigrations = async () => {
  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true'
  });

  await client.connect();

  try {
    const migrations = loadSqlFiles();
    for (const migration of migrations) {
      if (!migration.sql.trim()) {
        continue;
      }

      console.log(`Running migration: ${migration.file}`);
      await client.query(migration.sql);
    }
  } finally {
    await client.end();
  }
};

runMigrations().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
