CREATE TABLE `puzzle_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` integer NOT NULL,
	`puzzle_id` text NOT NULL,
	`question` text NOT NULL,
	`language` text,
	`category` text,
	`correct` integer NOT NULL,
	`attempted_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` integer NOT NULL,
	`token_hash` text NOT NULL UNIQUE,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`email` text NOT NULL UNIQUE,
	`username` text NOT NULL UNIQUE,
	`password_hash` text NOT NULL,
	`avatar_url` text,
	`created_at` integer NOT NULL
);
