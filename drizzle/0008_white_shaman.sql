CREATE TABLE `site_visitors` (
	`id` text PRIMARY KEY NOT NULL,
	`first_seen_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`visit_count` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE `books` ADD `stock_count` integer;