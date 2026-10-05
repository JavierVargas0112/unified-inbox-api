import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1759600000000 implements MigrationInterface {
  name = 'InitialSchema1759600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "channel" AS ENUM ('email', 'sms', 'whatsapp')`);
    await queryRunner.query(`CREATE TYPE "direction" AS ENUM ('inbound', 'outbound')`);
    await queryRunner.query(`CREATE TYPE "conversation_status" AS ENUM ('open', 'closed')`);

    await queryRunner.query(`
      CREATE TABLE "customers" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" text,
        "email" text UNIQUE,
        "phone" text UNIQUE,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )`);

    await queryRunner.query(`
      CREATE TABLE "conversations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
        "channel" "channel" NOT NULL,
        "status" "conversation_status" NOT NULL DEFAULT 'open',
        "subject" text,
        "last_message_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(
      `CREATE INDEX "idx_conversations_customer_channel_status"
         ON "conversations" ("customer_id", "channel", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_conversations_last_message_at" ON "conversations" ("last_message_at" DESC)`,
    );

    await queryRunner.query(`
      CREATE TABLE "messages" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "conversation_id" uuid NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
        "channel" "channel" NOT NULL,
        "direction" "direction" NOT NULL,
        "body" text NOT NULL,
        "external_id" text,
        "sent_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_messages_channel_external_id" ON "messages" ("channel", "external_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_messages_conversation_sent_at" ON "messages" ("conversation_id", "sent_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "messages"`);
    await queryRunner.query(`DROP TABLE "conversations"`);
    await queryRunner.query(`DROP TABLE "customers"`);
    await queryRunner.query(`DROP TYPE "conversation_status"`);
    await queryRunner.query(`DROP TYPE "direction"`);
    await queryRunner.query(`DROP TYPE "channel"`);
  }
}
