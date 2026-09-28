ALTER TABLE `notes` ADD `subject` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `notes` ADD `page_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `notes` ADD `reading_minutes` integer DEFAULT 0 NOT NULL;