export async function up(knex) {
  if (await knex.schema.hasColumn("notifications", "emailed_at")) {
    await knex.schema.alterTable("notifications", (table) => {
      table.dropColumn("emailed_at");
    });
  }
  if (await knex.schema.hasColumn("users", "email")) {
    await knex.schema.alterTable("users", (table) => {
      table.dropColumn("email");
    });
  }
}

export async function down(knex) {
  if (!(await knex.schema.hasColumn("users", "email"))) {
    await knex.schema.alterTable("users", (table) => {
      table.text("email");
    });
  }
  if (!(await knex.schema.hasColumn("notifications", "emailed_at"))) {
    await knex.schema.alterTable("notifications", (table) => {
      table.timestamp("emailed_at", { useTz: true });
    });
  }
}
