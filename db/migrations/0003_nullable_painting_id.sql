PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`painting_id` integer,
	`original_path` text NOT NULL,
	`original_hash` text NOT NULL,
	`crop_json` text,
	`derived_hash` text,
	`width` integer,
	`height` integer,
	`thumbhash` text,
	`exif_json` text,
	`is_primary` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`processing_status` text DEFAULT 'pending' NOT NULL,
	`processing_error` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`painting_id`) REFERENCES `paintings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_images`("id", "painting_id", "original_path", "original_hash", "crop_json", "derived_hash", "width", "height", "thumbhash", "exif_json", "is_primary", "sort_order", "processing_status", "processing_error", "created_at") SELECT "id", "painting_id", "original_path", "original_hash", "crop_json", "derived_hash", "width", "height", "thumbhash", "exif_json", "is_primary", "sort_order", "processing_status", "processing_error", "created_at" FROM `images`;--> statement-breakpoint
DROP TABLE `images`;--> statement-breakpoint
ALTER TABLE `__new_images` RENAME TO `images`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `images_painting_idx` ON `images` (`painting_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `images_processing_idx` ON `images` (`processing_status`);