CREATE TABLE `app_users` (
	`id` text PRIMARY KEY NOT NULL,
	`salon_id` integer NOT NULL,
	`role` text NOT NULL,
	`display_name` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`salon_id`) REFERENCES `salons`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "app_users_role_check" CHECK("app_users"."role" in ('admin','staff'))
);
--> statement-breakpoint
CREATE INDEX `app_users_salon_id_idx` ON `app_users` (`salon_id`);--> statement-breakpoint
CREATE TABLE `booking_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`booking_id` integer NOT NULL,
	`salon_id` integer NOT NULL,
	`position` integer NOT NULL,
	`service_id` integer NOT NULL,
	`employee_id` integer NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`service_snapshot` text NOT NULL,
	`booking_status` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`salon_id`) REFERENCES `salons`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "booking_items_position_nonneg" CHECK("booking_items"."position" >= 0),
	CONSTRAINT "booking_items_ends_after_starts" CHECK("booking_items"."ends_at" > "booking_items"."starts_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `booking_items_booking_position_unique` ON `booking_items` (`booking_id`,`position`);--> statement-breakpoint
CREATE INDEX `booking_items_booking_id_idx` ON `booking_items` (`booking_id`);--> statement-breakpoint
CREATE INDEX `booking_items_service_id_idx` ON `booking_items` (`service_id`);--> statement-breakpoint
CREATE INDEX `booking_items_employee_id_idx` ON `booking_items` (`employee_id`);--> statement-breakpoint
CREATE INDEX `booking_items_employee_starts_active_idx` ON `booking_items` (`employee_id`,`starts_at`) WHERE "booking_items"."booking_status" in ('pending','confirmed','in_progress');--> statement-breakpoint
CREATE INDEX `booking_items_service_starts_active_idx` ON `booking_items` (`service_id`,`starts_at`) WHERE "booking_items"."booking_status" in ('pending','confirmed','in_progress');--> statement-breakpoint
CREATE TABLE `booking_notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`booking_id` integer NOT NULL,
	`salon_id` integer NOT NULL,
	`kind` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`sent_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`provider_message_id` text,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`salon_id`) REFERENCES `salons`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "booking_notifications_kind_check" CHECK("booking_notifications"."kind" in ('booking_confirmation','booking_reminder','booking_cancellation','booking_reschedule','salon_new_booking'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `booking_notifications_booking_kind_version_unique` ON `booking_notifications` (`booking_id`,`kind`,`version`);--> statement-breakpoint
CREATE INDEX `booking_notifications_salon_idx` ON `booking_notifications` (`salon_id`);--> statement-breakpoint
CREATE INDEX `booking_notifications_booking_idx` ON `booking_notifications` (`booking_id`);--> statement-breakpoint
CREATE TABLE `booking_status_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`booking_id` integer NOT NULL,
	`salon_id` integer NOT NULL,
	`from_status` text,
	`to_status` text NOT NULL,
	`actor_type` text NOT NULL,
	`actor_id` text,
	`reason` text,
	`at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`salon_id`) REFERENCES `salons`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "booking_status_events_actor_type_check" CHECK("booking_status_events"."actor_type" in ('client','staff','system'))
);
--> statement-breakpoint
CREATE INDEX `booking_status_events_booking_id_idx` ON `booking_status_events` (`booking_id`);--> statement-breakpoint
CREATE TABLE `booking_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`booking_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`purpose` text DEFAULT 'manage' NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "booking_tokens_purpose_check" CHECK("booking_tokens"."purpose" in ('manage'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `booking_tokens_token_hash_unique` ON `booking_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `booking_tokens_booking_id_idx` ON `booking_tokens` (`booking_id`);--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`salon_id` integer NOT NULL,
	`client_id` integer NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`status` text NOT NULL,
	`client_note` text,
	`internal_note` text,
	`source` text DEFAULT 'web' NOT NULL,
	`idempotency_key` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`confirmed_at` integer,
	`cancelled_at` integer,
	`cancellation_reason` text,
	`version` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`salon_id`) REFERENCES `salons`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "bookings_ends_after_starts" CHECK("bookings"."ends_at" > "bookings"."starts_at"),
	CONSTRAINT "bookings_status_check" CHECK("bookings"."status" in ('pending','confirmed','in_progress','completed','cancelled_client','cancelled_salon','no_show')),
	CONSTRAINT "bookings_source_check" CHECK("bookings"."source" in ('web','admin','phone','walk_in'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_public_id_unique` ON `bookings` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_idempotency_key_unique` ON `bookings` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `bookings_salon_id_idx` ON `bookings` (`salon_id`);--> statement-breakpoint
CREATE INDEX `bookings_client_id_idx` ON `bookings` (`client_id`);--> statement-breakpoint
CREATE INDEX `bookings_salon_starts_idx` ON `bookings` (`salon_id`,`starts_at`);--> statement-breakpoint
CREATE TABLE `clients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`salon_id` integer NOT NULL,
	`email` text collate nocase,
	`phone` text,
	`display_name` text NOT NULL,
	`internal_notes` text,
	`marketing_consent` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`salon_id`) REFERENCES `salons`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "clients_email_or_phone_present" CHECK("clients"."email" is not null or "clients"."phone" is not null)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clients_salon_email_unique` ON `clients` (`salon_id`,`email`) WHERE "clients"."email" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `clients_salon_phone_unique` ON `clients` (`salon_id`,`phone`) WHERE "clients"."phone" is not null;--> statement-breakpoint
CREATE INDEX `clients_salon_id_idx` ON `clients` (`salon_id`);--> statement-breakpoint
CREATE TABLE `employee_recurring_breaks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_id` integer NOT NULL,
	`weekday` integer NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`effective_from` text DEFAULT (date('now')) NOT NULL,
	`effective_until` text,
	`label` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "erb_weekday_range" CHECK("employee_recurring_breaks"."weekday" between 1 and 7),
	CONSTRAINT "erb_ends_after_starts" CHECK("employee_recurring_breaks"."ends_at" > "employee_recurring_breaks"."starts_at"),
	CONSTRAINT "erb_effective_until_after_from" CHECK("employee_recurring_breaks"."effective_until" is null or "employee_recurring_breaks"."effective_until" >= "employee_recurring_breaks"."effective_from")
);
--> statement-breakpoint
CREATE INDEX `employee_recurring_breaks_employee_id_idx` ON `employee_recurring_breaks` (`employee_id`);--> statement-breakpoint
CREATE INDEX `employee_recurring_breaks_lookup_idx` ON `employee_recurring_breaks` (`employee_id`,`weekday`,`effective_from`,`effective_until`);--> statement-breakpoint
CREATE TABLE `employee_services` (
	`employee_id` integer NOT NULL,
	`service_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`employee_id`, `service_id`),
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `employee_services_service_id_idx` ON `employee_services` (`service_id`);--> statement-breakpoint
CREATE TABLE `employee_time_off` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_id` integer NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`reason` text NOT NULL,
	`note` text,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "eto_ends_after_starts" CHECK("employee_time_off"."ends_at" > "employee_time_off"."starts_at"),
	CONSTRAINT "eto_reason_check" CHECK("employee_time_off"."reason" in ('vacation','sick','personal','training','other'))
);
--> statement-breakpoint
CREATE INDEX `employee_time_off_employee_id_idx` ON `employee_time_off` (`employee_id`);--> statement-breakpoint
CREATE TABLE `employee_weekly_schedule` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_id` integer NOT NULL,
	`weekday` integer NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`effective_from` text DEFAULT (date('now')) NOT NULL,
	`effective_until` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ews_weekday_range" CHECK("employee_weekly_schedule"."weekday" between 1 and 7),
	CONSTRAINT "ews_ends_after_starts" CHECK("employee_weekly_schedule"."ends_at" > "employee_weekly_schedule"."starts_at"),
	CONSTRAINT "ews_effective_until_after_from" CHECK("employee_weekly_schedule"."effective_until" is null or "employee_weekly_schedule"."effective_until" >= "employee_weekly_schedule"."effective_from")
);
--> statement-breakpoint
CREATE INDEX `employee_weekly_schedule_employee_id_idx` ON `employee_weekly_schedule` (`employee_id`);--> statement-breakpoint
CREATE INDEX `employee_weekly_schedule_lookup_idx` ON `employee_weekly_schedule` (`employee_id`,`weekday`,`effective_from`,`effective_until`);--> statement-breakpoint
CREATE TABLE `employees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`salon_id` integer NOT NULL,
	`app_user_id` text,
	`display_name` text NOT NULL,
	`slug` text NOT NULL,
	`bio` text,
	`photo_path` text,
	`is_active` integer DEFAULT true NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`color_hex` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`salon_id`) REFERENCES `salons`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`app_user_id`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "employees_color_hex_format" CHECK("employees"."color_hex" is null or "employees"."color_hex" glob '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `employees_salon_slug_unique` ON `employees` (`salon_id`,`slug`);--> statement-breakpoint
CREATE INDEX `employees_salon_id_idx` ON `employees` (`salon_id`);--> statement-breakpoint
CREATE INDEX `employees_app_user_id_idx` ON `employees` (`app_user_id`) WHERE "employees"."app_user_id" is not null;--> statement-breakpoint
CREATE TABLE `salon_closures` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`salon_id` integer NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`label` text NOT NULL,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`salon_id`) REFERENCES `salons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "sc_ends_after_starts" CHECK("salon_closures"."ends_at" > "salon_closures"."starts_at")
);
--> statement-breakpoint
CREATE INDEX `salon_closures_salon_id_idx` ON `salon_closures` (`salon_id`);--> statement-breakpoint
CREATE TABLE `salon_working_hours` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`salon_id` integer NOT NULL,
	`weekday` integer NOT NULL,
	`opens_at` text,
	`closes_at` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`salon_id`) REFERENCES `salons`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "swh_weekday_range" CHECK("salon_working_hours"."weekday" between 1 and 7),
	CONSTRAINT "swh_open_close_consistency" CHECK(("salon_working_hours"."opens_at" is null and "salon_working_hours"."closes_at" is null) or ("salon_working_hours"."opens_at" is not null and "salon_working_hours"."closes_at" is not null and "salon_working_hours"."closes_at" > "salon_working_hours"."opens_at"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `salon_working_hours_salon_weekday_unique` ON `salon_working_hours` (`salon_id`,`weekday`);--> statement-breakpoint
CREATE INDEX `salon_working_hours_salon_idx` ON `salon_working_hours` (`salon_id`);--> statement-breakpoint
CREATE TABLE `salons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`timezone` text DEFAULT 'Europe/Madrid' NOT NULL,
	`locale` text DEFAULT 'es-ES' NOT NULL,
	`slot_granularity_minutes` integer DEFAULT 15 NOT NULL,
	`settings` text DEFAULT '{}' NOT NULL,
	`address` text,
	`phone` text,
	`contact_email` text,
	`logo_path` text,
	`booking_min_hours_ahead` integer DEFAULT 2 NOT NULL,
	`booking_max_days_ahead` integer DEFAULT 60 NOT NULL,
	`cancellation_min_hours` integer DEFAULT 12 NOT NULL,
	`cancellation_policy_text` text,
	`terms_text` text,
	`notify_salon_on_new_booking` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "salons_slot_granularity_range" CHECK("salons"."slot_granularity_minutes" > 0 and "salons"."slot_granularity_minutes" <= 120),
	CONSTRAINT "salons_booking_min_hours_ahead_range" CHECK("salons"."booking_min_hours_ahead" >= 0 and "salons"."booking_min_hours_ahead" <= 168),
	CONSTRAINT "salons_booking_max_days_ahead_range" CHECK("salons"."booking_max_days_ahead" >= 1 and "salons"."booking_max_days_ahead" <= 365),
	CONSTRAINT "salons_cancellation_min_hours_range" CHECK("salons"."cancellation_min_hours" >= 0 and "salons"."cancellation_min_hours" <= 720)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `salons_slug_unique` ON `salons` (`slug`);--> statement-breakpoint
CREATE TABLE `services` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`salon_id` integer NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`duration_minutes` integer NOT NULL,
	`price_cents` integer NOT NULL,
	`max_concurrent` integer,
	`color_hex` text,
	`is_active` integer DEFAULT true NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`salon_id`) REFERENCES `salons`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "services_duration_minutes_check" CHECK("services"."duration_minutes" > 0 and "services"."duration_minutes" % 5 = 0),
	CONSTRAINT "services_price_cents_check" CHECK("services"."price_cents" >= 0),
	CONSTRAINT "services_max_concurrent_check" CHECK("services"."max_concurrent" is null or "services"."max_concurrent" > 0),
	CONSTRAINT "services_color_hex_format" CHECK("services"."color_hex" is null or "services"."color_hex" glob '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `services_salon_slug_unique` ON `services` (`salon_id`,`slug`);--> statement-breakpoint
CREATE INDEX `services_salon_id_idx` ON `services` (`salon_id`);