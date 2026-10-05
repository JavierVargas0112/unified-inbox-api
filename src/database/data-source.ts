import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './typeorm.config';

// Entry point for the TypeORM CLI (`npm run migration:run`).
export default new DataSource(buildDataSourceOptions());
