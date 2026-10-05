// Fails when the entities and the migrated database disagree, i.e. when someone
// changed an entity without writing the matching migration.
// Run after `npm run build` and `npm run migration:run`.
const dataSource = require('../dist/database/data-source').default;

async function main() {
  await dataSource.initialize();
  try {
    const sql = await dataSource.driver.createSchemaBuilder().log();
    if (sql.upQueries.length > 0) {
      console.error('Schema drift detected. Missing migration for:');
      for (const query of sql.upQueries) console.error(`  ${query.query};`);
      process.exitCode = 1;
    } else {
      console.log('Schema is in sync with the migrations.');
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
