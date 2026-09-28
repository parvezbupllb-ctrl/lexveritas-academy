CREATE TABLE `bd_laws_queries` (
	`id` text PRIMARY KEY NOT NULL,
	`question` text NOT NULL,
	`language` text NOT NULL,
	`result_status` text NOT NULL,
	`section_ids` text DEFAULT '[]' NOT NULL,
	`source_count` integer DEFAULT 0 NOT NULL,
	`duration_ms` integer DEFAULT 0 NOT NULL,
	`visitor_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_bd_laws_queries_created` ON `bd_laws_queries` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_bd_laws_queries_status` ON `bd_laws_queries` (`result_status`,`created_at`);--> statement-breakpoint
CREATE TABLE `bd_laws_sections` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`chapter` text DEFAULT '' NOT NULL,
	`part` text DEFAULT '' NOT NULL,
	`section_number` text NOT NULL,
	`section_title` text DEFAULT '' NOT NULL,
	`section_text` text NOT NULL,
	`official_url` text NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`status` text DEFAULT 'indexed' NOT NULL,
	`content_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `bd_laws_sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_bd_laws_sections_url` ON `bd_laws_sections` (`official_url`);--> statement-breakpoint
CREATE INDEX `idx_bd_laws_sections_source_number` ON `bd_laws_sections` (`source_id`,`section_number`);--> statement-breakpoint
CREATE INDEX `idx_bd_laws_sections_status` ON `bd_laws_sections` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `bd_laws_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`act_name` text NOT NULL,
	`act_number` text DEFAULT '' NOT NULL,
	`year` integer,
	`official_url` text NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`last_synced_at` integer,
	`content_hash` text DEFAULT '' NOT NULL,
	`error_message` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_bd_laws_sources_url` ON `bd_laws_sources` (`official_url`);--> statement-breakpoint
CREATE INDEX `idx_bd_laws_sources_status` ON `bd_laws_sources` (`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_bd_laws_sources_name` ON `bd_laws_sources` (`act_name`);--> statement-breakpoint
CREATE TABLE `bd_laws_sync_history` (
	`id` text PRIMARY KEY NOT NULL,
	`mode` text NOT NULL,
	`status` text NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`discovered_sources` integer DEFAULT 0 NOT NULL,
	`indexed_sections` integer DEFAULT 0 NOT NULL,
	`changed_sources` integer DEFAULT 0 NOT NULL,
	`failed_sources` integer DEFAULT 0 NOT NULL,
	`error_message` text
);
--> statement-breakpoint
CREATE INDEX `idx_bd_laws_sync_started` ON `bd_laws_sync_history` (`started_at`);