ALTER TABLE `bd_laws_sources` ADD `legal_status` text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `bd_laws_sources` ADD `status_source_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `bd_laws_sources` ADD `superseded_by` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_bd_laws_sources_legal_status` ON `bd_laws_sources` (`legal_status`,`year`);