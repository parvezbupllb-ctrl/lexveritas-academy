CREATE TABLE `backup_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`backup_type` text NOT NULL,
	`frequency` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`retention_count` integer NOT NULL,
	`last_run_at` integer,
	`next_run_at` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `backup_storage_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`account_email` text DEFAULT '' NOT NULL,
	`folder` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'authorization_required' NOT NULL,
	`connected` integer DEFAULT 0 NOT NULL,
	`last_tested_at` integer,
	`last_synced_at` integer,
	`config` text DEFAULT '{}' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_backup_storage_provider_email` ON `backup_storage_connections` (`provider`,`account_email`);--> statement-breakpoint
ALTER TABLE `backup_history` ADD `size_bytes` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `backup_history` ADD `verification_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `backup_history` ADD `drive_status` text DEFAULT 'not_synced' NOT NULL;--> statement-breakpoint
ALTER TABLE `backup_history` ADD `keep_forever` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `backup_history` ADD `included_modules` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `backup_history` ADD `manifest` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `backup_history` ADD `checksum` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `backup_history` ADD `archive_key` text;--> statement-breakpoint
ALTER TABLE `backup_history` ADD `payload_key` text;--> statement-breakpoint
ALTER TABLE `backup_history` ADD `media_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `backup_history` ADD `source` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `backup_history` ADD `error_message` text;--> statement-breakpoint
CREATE INDEX `idx_backup_history_created` ON `backup_history` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_backup_history_status` ON `backup_history` (`status`,`verification_status`);