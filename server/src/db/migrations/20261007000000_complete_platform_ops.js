export async function up(knex) {
  await knex.raw("CREATE SEQUENCE IF NOT EXISTS campaign_id_seq");
  await knex.raw(`
    SELECT setval(
      'campaign_id_seq',
      GREATEST(COALESCE((SELECT MAX(id) FROM campaigns), 0) + 1, 1),
      false
    )
  `);
  await knex.raw(
    "ALTER TABLE campaigns ALTER COLUMN id SET DEFAULT nextval('campaign_id_seq')"
  );

  await knex.schema.alterTable("notifications", (table) => {
    table.text("dedupe_key");
  });
  await knex.raw(
    "CREATE UNIQUE INDEX notifications_dedupe_key_unique ON notifications (dedupe_key)"
  );

  await knex.schema.alterTable("oracle_reports", (table) => {
    table.timestamp("next_attempt_at", { useTz: true });
    table.text("last_error");
  });

  await knex.schema.createTable("faucet_claims", (table) => {
    table
      .text("wallet")
      .primary()
      .references("wallet")
      .inTable("users")
      .onDelete("CASCADE");
    table.timestamp("last_claimed_at", { useTz: true }).notNullable();
    table.text("tx_output");
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("faucet_claims");
  await knex.schema.alterTable("oracle_reports", (table) => {
    table.dropColumn("last_error");
    table.dropColumn("next_attempt_at");
  });
  await knex.raw("DROP INDEX IF EXISTS notifications_dedupe_key_unique");
  await knex.schema.alterTable("notifications", (table) => {
    table.dropColumn("dedupe_key");
  });
  await knex.raw("ALTER TABLE campaigns ALTER COLUMN id DROP DEFAULT");
  await knex.raw("DROP SEQUENCE IF EXISTS campaign_id_seq");
}
