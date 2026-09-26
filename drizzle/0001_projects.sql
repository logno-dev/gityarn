CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`notes` text,
	`start_date` text,
	`due_date` text,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `project_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`notes` text,
	`due_date` text,
	`completed_at` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `project_step_patterns` (
	`step_id` text NOT NULL,
	`pattern_id` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`step_id`, `pattern_id`),
	FOREIGN KEY (`step_id`) REFERENCES `project_steps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`pattern_id`) REFERENCES `patterns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `project_yarn` (
	`project_id` text NOT NULL,
	`inventory_yarn_id` text NOT NULL,
	`skeins_planned` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`project_id`, `inventory_yarn_id`),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inventory_yarn_id`) REFERENCES `inventory_yarn`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `project_hooks` (
	`project_id` text NOT NULL,
	`hook_id` text NOT NULL,
	PRIMARY KEY(`project_id`, `hook_id`),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`hook_id`) REFERENCES `hooks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `creations` ADD `project_id` text REFERENCES projects(id) ON DELETE set null;
--> statement-breakpoint
ALTER TABLE `creations` ADD `post_type` text DEFAULT 'standalone' NOT NULL;
--> statement-breakpoint
CREATE TABLE `creation_patterns` (
	`creation_id` text NOT NULL,
	`pattern_id` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`creation_id`, `pattern_id`),
	FOREIGN KEY (`creation_id`) REFERENCES `creations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`pattern_id`) REFERENCES `patterns`(`id`) ON UPDATE no action ON DELETE cascade
);
