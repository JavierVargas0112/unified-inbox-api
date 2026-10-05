import { DataSourceOptions } from 'typeorm';
import { Customer } from '../customers/customer.entity';
import { Conversation } from '../conversations/conversation.entity';
import { Message } from '../conversations/message.entity';
import { InitialSchema1759600000000 } from './migrations/1759600000000-InitialSchema';

/**
 * Single source of truth for the connection, used by the app and by the TypeORM CLI.
 * The schema is only ever changed by migrations: `synchronize` stays off everywhere.
 */
export function buildDataSourceOptions(env: NodeJS.ProcessEnv = process.env): DataSourceOptions {
  const url = env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }
  return {
    type: 'postgres',
    url,
    ssl: env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    entities: [Customer, Conversation, Message],
    migrations: [InitialSchema1759600000000],
    migrationsRun: env.RUN_MIGRATIONS !== 'false',
    synchronize: false,
  };
}
