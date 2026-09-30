CREATE TABLE `progress_sync` (
	`code_hash` text PRIMARY KEY NOT NULL,
	`snapshot` text NOT NULL,
	`revision` integer NOT NULL,
	`updated_at` integer NOT NULL
);
