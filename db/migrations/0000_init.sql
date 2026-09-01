CREATE TABLE `images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`painting_id` integer NOT NULL,
	`original_path` text NOT NULL,
	`original_hash` text NOT NULL,
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
CREATE INDEX `images_painting_idx` ON `images` (`painting_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `images_processing_idx` ON `images` (`processing_status`);--> statement-breakpoint
CREATE TABLE `pages` (
	`slug` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `painting_tags` (
	`painting_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`painting_id`, `tag_id`),
	FOREIGN KEY (`painting_id`) REFERENCES `paintings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `painting_tags_tag_idx` ON `painting_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `paintings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`title` text NOT NULL,
	`year` integer,
	`medium` text,
	`width_cm` real,
	`height_cm` real,
	`story` text,
	`title_en` text,
	`story_en` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`provenance` text DEFAULT 'unknown' NOT NULL,
	`provenance_note` text,
	`audio_path` text,
	`needs_crop` integer DEFAULT false NOT NULL,
	`needs_review` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_by` text DEFAULT 'admin' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `paintings_public_id_idx` ON `paintings` (`public_id`);--> statement-breakpoint
CREATE INDEX `paintings_status_sort_idx` ON `paintings` (`status`,`sort_order`);--> statement-breakpoint
CREATE INDEX `paintings_review_idx` ON `paintings` (`needs_review`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_slug_idx` ON `tags` (`slug`);