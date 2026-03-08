CREATE TABLE `admin_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`token_hash` text NOT NULL UNIQUE,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `request_rate_limits` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`bucket_key` text NOT NULL UNIQUE,
	`scope` text NOT NULL,
	`identifier_hash` text NOT NULL,
	`count` integer NOT NULL,
	`reset_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
