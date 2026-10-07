export async function up(knex) {
  await knex.schema.createTable("users", (table) => {
    table.text("wallet").primary();
    table.text("nonce");
    table.timestamp("nonce_expires_at", { useTz: true });
    table.text("nonce_domain");
    table.text("nonce_uri");
    table.timestamp("nonce_issued_at", { useTz: true });
    table
      .timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("auth_sessions", (table) => {
    table.uuid("id").primary();
    table
      .text("wallet")
      .notNullable()
      .references("wallet")
      .inTable("users")
      .onDelete("CASCADE");
    table.timestamp("expires_at", { useTz: true }).notNullable();
    table.timestamp("revoked_at", { useTz: true });
    table
      .timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("oauth_states", (table) => {
    table.uuid("id").primary();
    table
      .text("wallet")
      .notNullable()
      .references("wallet")
      .inTable("users")
      .onDelete("CASCADE");
    table.timestamp("expires_at", { useTz: true }).notNullable();
    table.timestamp("consumed_at", { useTz: true });
    table
      .timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("youtube_channels", (table) => {
    table.increments("id").primary();
    table
      .text("wallet")
      .notNullable()
      .references("wallet")
      .inTable("users")
      .onDelete("CASCADE");
    table.text("channel_id").notNullable().unique();
    table.text("title").notNullable();
    table.bigInteger("subscriber_count").notNullable().defaultTo(0);
    table.timestamp("channel_created_at", { useTz: true });
    table.text("uploads_playlist_id");
    table.text("refresh_token_encrypted").notNullable();
    table.timestamp("revoked_at", { useTz: true });
    table
      .timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("campaigns", (table) => {
    table.bigInteger("id").primary();
    table.text("creator_wallet").notNullable();
    table.text("title").notNullable();
    table.text("brief").notNullable();
    table.text("source_video").notNullable();
    table.text("required_mention").notNullable();
    table.text("payment_mint").notNullable();
    table.text("terms_file_path").notNullable();
    table.string("terms_hash", 64).notNullable();
    table.bigInteger("cpm").notNullable();
    table.bigInteger("max_payout_per_video").notNullable();
    table.bigInteger("budget").notNullable();
    table.bigInteger("total_funded").notNullable().defaultTo(0);
    table.bigInteger("total_paid").notNullable().defaultTo(0);
    table.bigInteger("start_time").notNullable();
    table.bigInteger("end_time").notNullable();
    table.integer("review_period").notNullable();
    table.integer("appeal_window").notNullable();
    table.integer("appeal_timeout").notNullable();
    table.integer("settlement_period").notNullable();
    table.integer("max_report_age").notNullable();
    table.integer("final_snapshot_tolerance").notNullable();
    table.integer("clock_skew_tolerance").notNullable();
    table.integer("max_videos_per_clipper").notNullable().defaultTo(5);
    table.integer("min_subscribers");
    table.integer("min_channel_age_days");
    table.string("status").notNullable().defaultTo("PENDING_FUNDING");
    table.text("onchain_campaign");
    table
      .timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("submission_intents", (table) => {
    table.uuid("id").primary();
    table
      .bigInteger("campaign_id")
      .notNullable()
      .references("id")
      .inTable("campaigns")
      .onDelete("CASCADE");
    table.text("clipper_wallet").notNullable();
    table.string("youtube_video_id", 11).notNullable();
    table.text("channel_id").notNullable();
    table.text("title").notNullable();
    table.timestamp("published_at", { useTz: true }).notNullable();
    table.string("terms_hash", 64).notNullable();
    table.timestamp("expires_at", { useTz: true }).notNullable();
    table
      .timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table.unique(["campaign_id", "youtube_video_id"]);
  });
  await knex.schema.createTable("submissions", (table) => {
    table.increments("id").primary();
    table
      .bigInteger("campaign_id")
      .notNullable()
      .references("id")
      .inTable("campaigns")
      .onDelete("CASCADE");
    table.text("clipper_wallet").notNullable();
    table.string("youtube_video_id", 11).notNullable();
    table.text("channel_id").notNullable();
    table.text("title").notNullable();
    table.timestamp("published_at", { useTz: true }).notNullable();
    table.string("status").notNullable().defaultTo("PENDING_REVIEW");
    table.text("onchain_submission");
    table.timestamp("submitted_at", { useTz: true }).notNullable();
    table.timestamp("review_deadline", { useTz: true }).notNullable();
    table.timestamp("rejected_at", { useTz: true });
    table.timestamp("appealed_at", { useTz: true });
    table.timestamp("accepted_at", { useTz: true });
    table.text("reason_hash");
    table.bigInteger("baseline_views");
    table.bigInteger("total_paid").notNullable().defaultTo(0);
    table.string("terms_hash", 64).notNullable();
    table.text("register_tx");
    table
      .timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table.unique(["campaign_id", "youtube_video_id"]);
  });

  await knex.schema.createTable("clipper_stats", (table) => {
    table
      .bigInteger("campaign_id")
      .notNullable()
      .references("id")
      .inTable("campaigns")
      .onDelete("CASCADE");
    table.text("clipper_wallet").notNullable();
    table.integer("active_count").notNullable().defaultTo(0);
    table.integer("total_submitted").notNullable().defaultTo(0);
    table.primary(["campaign_id", "clipper_wallet"]);
  });

  await knex.schema.createTable("review_actions", (table) => {
    table.increments("id").primary();
    table
      .integer("submission_id")
      .notNullable()
      .references("id")
      .inTable("submissions")
      .onDelete("CASCADE");
    table.text("actor_wallet").notNullable();
    table.string("action").notNullable();
    table.text("reason");
    table.text("reason_hash");
    table.text("tx_signature");
    table
      .timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("view_snapshots", (table) => {
    table.increments("id").primary();
    table
      .integer("submission_id")
      .notNullable()
      .references("id")
      .inTable("submissions")
      .onDelete("CASCADE");
    table.bigInteger("view_count").notNullable();
    table.string("availability").notNullable().defaultTo("public");
    table.timestamp("fetched_at", { useTz: true }).notNullable();
    table.boolean("flagged").notNullable().defaultTo(false);
    table.index(["submission_id", "fetched_at"]);
  });

  await knex.schema.createTable("oracle_reports", (table) => {
    table.increments("id").primary();
    table
      .integer("submission_id")
      .notNullable()
      .references("id")
      .inTable("submissions")
      .onDelete("CASCADE");
    table.bigInteger("report_seq");
    table.bigInteger("view_count").notNullable();
    table.timestamp("fetched_at", { useTz: true }).notNullable();
    table.boolean("is_final").notNullable().defaultTo(false);
    table.boolean("is_baseline").notNullable().defaultTo(false);
    table.text("reporter").notNullable();
    table.text("tx_signature");
    table.string("status").notNullable().defaultTo("pending");
    table.text("hold_reason");
    table.integer("attempts").notNullable().defaultTo(0);
    table
      .timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("claim_requests", (table) => {
    table.increments("id").primary();
    table
      .integer("submission_id")
      .notNullable()
      .references("id")
      .inTable("submissions")
      .onDelete("CASCADE");
    table.text("clipper_wallet").notNullable();
    table.string("status").notNullable().defaultTo("PENDING");
    table.string("error_code");
    table.integer("attempts").notNullable().defaultTo(0);
    table
      .timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table
      .timestamp("updated_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
  });
  await knex.raw(
    "CREATE UNIQUE INDEX claim_requests_one_active ON claim_requests (submission_id) WHERE status IN ('PENDING', 'READY')"
  );

  await knex.schema.createTable("claims", (table) => {
    table.increments("id").primary();
    table
      .integer("submission_id")
      .notNullable()
      .references("id")
      .inTable("submissions")
      .onDelete("CASCADE");
    table.bigInteger("amount").notNullable();
    table.bigInteger("remaining_claim").notNullable();
    table.text("tx_signature").notNullable().unique();
    table
      .timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("notifications", (table) => {
    table.increments("id").primary();
    table
      .text("wallet")
      .notNullable()
      .references("wallet")
      .inTable("users")
      .onDelete("CASCADE");
    table.string("type").notNullable();
    table.jsonb("payload").notNullable();
    table.timestamp("read_at", { useTz: true });
    table
      .timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("indexer_events", (table) => {
    table.text("tx_signature").notNullable();
    table.integer("event_index").notNullable();
    table.string("event_name").notNullable();
    table.jsonb("payload").notNullable();
    table
      .timestamp("processed_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table.primary(["tx_signature", "event_index"]);
  });

  await knex.schema.createTable("indexer_cursor", (table) => {
    table.string("id").primary().defaultTo("default");
    table.text("last_signature");
    table
      .timestamp("updated_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
  });
}

export async function down(knex) {
  for (const table of [
    "indexer_cursor",
    "indexer_events",
    "notifications",
    "claims",
    "claim_requests",
    "oracle_reports",
    "view_snapshots",
    "review_actions",
    "clipper_stats",
    "submissions",
    "submission_intents",
    "campaigns",
    "youtube_channels",
    "oauth_states",
    "auth_sessions",
    "users",
  ]) {
    await knex.schema.dropTableIfExists(table);
  }
}
