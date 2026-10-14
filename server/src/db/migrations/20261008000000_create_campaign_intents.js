export async function up(knex) {
  await knex.schema.createTable("campaign_intents", (table) => {
    table.bigInteger("campaign_id").primary();
    table
      .text("creator_wallet")
      .notNullable()
      .references("wallet")
      .inTable("users")
      .onDelete("CASCADE");
    table.text("onchain_campaign").notNullable().unique();
    table.text("terms_file_path").notNullable();
    table.string("terms_hash", 64).notNullable();
    table.jsonb("campaign_data").notNullable();
    table.string("status").notNullable().defaultTo("AWAITING_SIGNATURE");
    table.text("tx_signature").unique();
    table.timestamp("expires_at", { useTz: true }).notNullable();
    table
      .timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table
      .timestamp("updated_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table.index(["creator_wallet", "status"]);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("campaign_intents");
}
