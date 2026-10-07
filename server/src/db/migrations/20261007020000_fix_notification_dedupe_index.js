export async function up(knex) {
  await knex.raw("DROP INDEX IF EXISTS notifications_dedupe_key_unique");
  await knex.raw(
    "CREATE UNIQUE INDEX notifications_dedupe_key_unique ON notifications (dedupe_key)"
  );
}

export async function down(knex) {
  await knex.raw("DROP INDEX IF EXISTS notifications_dedupe_key_unique");
  await knex.raw(
    "CREATE UNIQUE INDEX notifications_dedupe_key_unique ON notifications (dedupe_key) WHERE dedupe_key IS NOT NULL"
  );
}
