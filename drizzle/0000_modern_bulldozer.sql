CREATE TABLE `asset_files` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text DEFAULT 'creation-photo' NOT NULL,
	`r2_key` text NOT NULL,
	`mime_type` text,
	`byte_size` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `barcodes` (
	`id` text PRIMARY KEY NOT NULL,
	`barcode_value` text NOT NULL,
	`format` text DEFAULT 'unknown' NOT NULL,
	`yarn_line_id` text,
	`yarn_colorway_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`yarn_line_id`) REFERENCES `yarn_lines`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`yarn_colorway_id`) REFERENCES `yarn_colorways`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `barcodes_value_unique` ON `barcodes` (`barcode_value`);--> statement-breakpoint
CREATE TABLE `creation_yarn` (
	`creation_id` text NOT NULL,
	`inventory_yarn_id` text NOT NULL,
	`skeins_used` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`creation_id`, `inventory_yarn_id`),
	FOREIGN KEY (`creation_id`) REFERENCES `creations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inventory_yarn_id`) REFERENCES `inventory_yarn`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `creations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`pattern_id` text,
	`name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`notes` text,
	`finished_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`pattern_id`) REFERENCES `patterns`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `hooks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`size_label` text NOT NULL,
	`metric_size_mm` text,
	`material` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `inventory_yarn` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`yarn_line_id` text,
	`yarn_colorway_id` text,
	`nickname` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	`storage_location` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`yarn_line_id`) REFERENCES `yarn_lines`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`yarn_colorway_id`) REFERENCES `yarn_colorways`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `manufacturers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`website_url` text,
	`scrape_root_url` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `manufacturers_slug_unique` ON `manufacturers` (`slug`);--> statement-breakpoint
CREATE TABLE `patterns` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`source_url` text,
	`difficulty` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `yarn_colorways` (
	`id` text PRIMARY KEY NOT NULL,
	`yarn_line_id` text NOT NULL,
	`name` text NOT NULL,
	`color_code` text,
	`hex_reference` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`yarn_line_id`) REFERENCES `yarn_lines`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `yarn_colorways_line_color_unique` ON `yarn_colorways` (`yarn_line_id`,`name`);--> statement-breakpoint
CREATE TABLE `yarn_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`manufacturer_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`weight_class` text,
	`fiber_content` text,
	`yardage_meters` integer,
	`needle_or_hook_range` text,
	`product_url` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`manufacturer_id`) REFERENCES `manufacturers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `yarn_lines_slug_unique` ON `yarn_lines` (`slug`);