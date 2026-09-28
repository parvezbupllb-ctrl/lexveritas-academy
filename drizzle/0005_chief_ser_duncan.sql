ALTER TABLE `soft_orders` ADD `downloaded_at` integer;--> statement-breakpoint
ALTER TABLE `notes` ADD `download_count` integer DEFAULT 0 NOT NULL;
