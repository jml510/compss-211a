import {sqliteTable,text,integer,index} from 'drizzle-orm/sqlite-core';

export const classSettings=sqliteTable('class_settings',{
  id:integer('id').primaryKey(),
  joinCode:text('join_code').notNull(),
});
export const checkins=sqliteTable('checkins',{
  tokenHash:text('token_hash').primaryKey(),
  snapshot:text('snapshot').notNull(),
  submittedAt:integer('submitted_at').notNull(),
});

// Append-only, bounded event labels. No names, student code, answer text, or IP addresses.
export const activityEvents=sqliteTable('activity_events',{
  id:text('id').primaryKey(),
  browserHash:text('browser_hash').notNull(),
  skill:text('skill').notNull(),
  kind:text('kind').notNull(),
  value:text('value').notNull(),
  variant:text('variant').notNull(),
  receivedAt:integer('received_at').notNull(),
},table=>[index('idx_activity_received').on(table.receivedAt)]);

// Optional cross-device progress, keyed by a hash of the student's sync code. Code drafts are never stored.
export const progressSync=sqliteTable('progress_sync',{
  codeHash:text('code_hash').primaryKey(),
  snapshot:text('snapshot').notNull(),
  revision:integer('revision').notNull(),
  updatedAt:integer('updated_at').notNull(),
});
