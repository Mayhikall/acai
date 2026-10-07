export async function up(knex) {
  await knex.schema.createTable("indexer_dead_letters", (table) => {
    table.text("tx_signature").notNullable();
    table.integer("event_index").notNullable();
    table.text("event_name").notNullable();
    table.jsonb("payload").notNullable();
    table.text("error_code").notNullable();
    table.text("error_message").notNullable();
    table.integer("attempts").notNullable().defaultTo(1);
    table.timestamp("first_seen_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("last_seen_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("resolved_at", { useTz: true });
    table.primary(["tx_signature", "event_index"]);
    table.index(["resolved_at", "last_seen_at"]);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("indexer_dead_letters");
}
