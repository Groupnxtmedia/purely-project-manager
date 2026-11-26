CREATE TABLE `board_state` (
	`id` text PRIMARY KEY NOT NULL,
	`projects` text NOT NULL,
	`tasks` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`window` integer NOT NULL
);
