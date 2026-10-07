export async function up(knex) {
  await knex.schema.alterTable("indexer_cursor", (table) => {
    table.bigInteger("last_slot");
    table.integer("consecutive_failures").notNullable().defaultTo(0);
    table.text("last_error");
  });
}

export async function down(knex) {
  await knex.schema.alterTable("indexer_cursor", (table) => {
    table.dropColumn("last_error");
    table.dropColumn("consecutive_failures");
    table.dropColumn("last_slot");
  });
}
