CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`review_text` text NOT NULL,
	`reviewer_name` text NOT NULL,
	`reviewer_photo` text,
	`university` text NOT NULL,
	`verified` integer DEFAULT 0 NOT NULL,
	`published` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `review_public_order` ON `reviews` (`published`,`verified`,`active`,`display_order`);