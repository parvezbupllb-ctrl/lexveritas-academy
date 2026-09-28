CREATE TABLE `seo_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`content_type` text NOT NULL,
	`content_id` text NOT NULL,
	`path` text NOT NULL,
	`seo_title` text DEFAULT '' NOT NULL,
	`meta_description` text DEFAULT '' NOT NULL,
	`canonical_url` text DEFAULT '' NOT NULL,
	`indexable` integer DEFAULT 1 NOT NULL,
	`follow_links` integer DEFAULT 1 NOT NULL,
	`og_title` text DEFAULT '' NOT NULL,
	`og_description` text DEFAULT '' NOT NULL,
	`social_image` text,
	`schema_type` text DEFAULT 'WebPage' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_seo_entries_content` ON `seo_entries` (`content_type`,`content_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_seo_entries_path` ON `seo_entries` (`path`);--> statement-breakpoint
CREATE INDEX `idx_seo_entries_indexable` ON `seo_entries` (`indexable`,`updated_at`);--> statement-breakpoint
CREATE TABLE `seo_redirects` (
	`id` text PRIMARY KEY NOT NULL,
	`old_url` text NOT NULL,
	`new_url` text NOT NULL,
	`status_code` integer DEFAULT 301 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_seo_redirects_old_url` ON `seo_redirects` (`old_url`);--> statement-breakpoint
CREATE INDEX `idx_seo_redirects_active` ON `seo_redirects` (`active`,`updated_at`);