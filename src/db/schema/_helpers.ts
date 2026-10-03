import { sql } from "drizzle-orm";
import { uuid, timestamp } from "drizzle-orm/pg-core";

/** Standard UUID primary key, DB-generated via pgcrypto's gen_random_uuid(). */
export const idColumn = () =>
  uuid("id").primaryKey().default(sql`gen_random_uuid()`);

/** Standard audit timestamp columns applied to every table. */
export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

/** Soft-delete marker for master data with historical significance. */
export const softDelete = {
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};
