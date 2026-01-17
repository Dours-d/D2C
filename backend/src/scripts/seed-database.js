const path = require('path');
const { execSync } = require('child_process');

const schemaPath = path.resolve(__dirname, '../../../core.sql');

try {
  execSync(`psql -d ${process.env.DB_NAME} -f "${schemaPath}"`, {
    stdio: 'inherit'
  });
} catch (error) {
  console.error('Database seed failed:', error.message);
  process.exit(1);
}
