CREATE TABLE `guest_daily_usage` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`guest_day_key` text NOT NULL UNIQUE,
	`guest_key` text NOT NULL,
	`day_key` text NOT NULL,
	`count` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `users` ADD `stripe_customer_id` text;--> statement-breakpoint
ALTER TABLE `users` ADD `stripe_subscription_id` text;--> statement-breakpoint
ALTER TABLE `users` ADD `subscription_status` text;--> statement-breakpoint
ALTER TABLE `users` ADD `subscription_current_period_end` integer;