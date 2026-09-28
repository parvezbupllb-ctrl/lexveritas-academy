CREATE TABLE `authors` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`photo` text,
	`description` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_authors_slug` ON `authors` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_authors_name` ON `authors` (`name`);--> statement-breakpoint
ALTER TABLE `blogs` ADD `author_id` text REFERENCES authors(id);--> statement-breakpoint
CREATE INDEX `idx_blogs_author_id` ON `blogs` (`author_id`);--> statement-breakpoint
ALTER TABLE `notices` ADD `attachment` text;