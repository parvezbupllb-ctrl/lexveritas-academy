ALTER TABLE `blogs` ADD `category` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `blogs` ADD `subcategory` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `blogs` ADD `view_count` integer DEFAULT 0 NOT NULL;