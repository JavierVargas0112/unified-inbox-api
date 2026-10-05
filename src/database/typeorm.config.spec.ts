import { buildDataSourceOptions } from './typeorm.config';

describe('buildDataSourceOptions', () => {
  const url = 'postgres://u:p@localhost:5432/db';

  it('requires DATABASE_URL', () => {
    expect(() => buildDataSourceOptions({})).toThrow('DATABASE_URL is not set');
  });

  it('never synchronises the schema and runs migrations by default', () => {
    expect(buildDataSourceOptions({ DATABASE_URL: url })).toMatchObject({
      url,
      ssl: false,
      synchronize: false,
      migrationsRun: true,
    });
  });

  it('enables TLS and disables startup migrations on request', () => {
    expect(
      buildDataSourceOptions({ DATABASE_URL: url, DATABASE_SSL: 'true', RUN_MIGRATIONS: 'false' }),
    ).toMatchObject({ ssl: { rejectUnauthorized: false }, migrationsRun: false });
  });
});
