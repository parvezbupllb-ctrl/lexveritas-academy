ALTER TABLE `backup_history` ADD `drive_folder_id` text;--> statement-breakpoint
ALTER TABLE `backup_history` ADD `drive_synced_at` integer;--> statement-breakpoint
ALTER TABLE `backup_history` ADD `drive_error_message` text;