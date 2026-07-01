CREATE TABLE "app_users" (
	"id" text PRIMARY KEY NOT NULL,
	"salon_id" bigint NOT NULL,
	"role" text NOT NULL,
	"email" "citext" NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"email_verified_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"welcome_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_users_role_check" CHECK ("app_users"."role" in ('admin','staff'))
);
--> statement-breakpoint
CREATE TABLE "auth_password_reset_tokens" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "auth_password_reset_tokens_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_password_reset_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_agent" text,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_items" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "booking_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"booking_id" bigint NOT NULL,
	"salon_id" bigint NOT NULL,
	"position" integer NOT NULL,
	"service_id" bigint NOT NULL,
	"employee_id" bigint NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"service_snapshot" jsonb NOT NULL,
	"booking_status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_items_position_nonneg" CHECK ("booking_items"."position" >= 0),
	CONSTRAINT "booking_items_ends_after_starts" CHECK ("booking_items"."ends_at" > "booking_items"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "booking_notifications" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "booking_notifications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"booking_id" bigint NOT NULL,
	"salon_id" bigint NOT NULL,
	"kind" text NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"provider_message_id" text,
	CONSTRAINT "booking_notifications_kind_check" CHECK ("booking_notifications"."kind" in ('booking_confirmation','booking_reminder','booking_cancellation','booking_reschedule','salon_new_booking'))
);
--> statement-breakpoint
CREATE TABLE "booking_status_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "booking_status_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"booking_id" bigint NOT NULL,
	"salon_id" bigint NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"reason" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_status_events_actor_type_check" CHECK ("booking_status_events"."actor_type" in ('client','staff','system'))
);
--> statement-breakpoint
CREATE TABLE "booking_tokens" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "booking_tokens_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"booking_id" bigint NOT NULL,
	"token_hash" text NOT NULL,
	"purpose" text DEFAULT 'manage' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_tokens_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "booking_tokens_purpose_check" CHECK ("booking_tokens"."purpose" in ('manage'))
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bookings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" text NOT NULL,
	"salon_id" bigint NOT NULL,
	"client_id" bigint NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"client_note" text,
	"internal_note" text,
	"source" text DEFAULT 'web' NOT NULL,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancellation_reason" text,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "bookings_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "bookings_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "bookings_ends_after_starts" CHECK ("bookings"."ends_at" > "bookings"."starts_at"),
	CONSTRAINT "bookings_status_check" CHECK ("bookings"."status" in ('pending','confirmed','in_progress','completed','cancelled_client','cancelled_salon','no_show')),
	CONSTRAINT "bookings_source_check" CHECK ("bookings"."source" in ('web','admin','phone','walk_in'))
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "clients_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"salon_id" bigint NOT NULL,
	"email" "citext",
	"phone" text,
	"display_name" text NOT NULL,
	"internal_notes" text,
	"marketing_consent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clients_email_or_phone_present" CHECK ("clients"."email" is not null or "clients"."phone" is not null)
);
--> statement-breakpoint
CREATE TABLE "employee_recurring_breaks" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "employee_recurring_breaks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"employee_id" bigint NOT NULL,
	"weekday" integer NOT NULL,
	"starts_at" text NOT NULL,
	"ends_at" text NOT NULL,
	"effective_from" text NOT NULL,
	"effective_until" text,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "erb_weekday_range" CHECK ("employee_recurring_breaks"."weekday" between 1 and 7),
	CONSTRAINT "erb_ends_after_starts" CHECK ("employee_recurring_breaks"."ends_at" > "employee_recurring_breaks"."starts_at"),
	CONSTRAINT "erb_effective_until_after_from" CHECK ("employee_recurring_breaks"."effective_until" is null or "employee_recurring_breaks"."effective_until" >= "employee_recurring_breaks"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "employee_services" (
	"employee_id" bigint NOT NULL,
	"service_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employee_services_employee_id_service_id_pk" PRIMARY KEY("employee_id","service_id")
);
--> statement-breakpoint
CREATE TABLE "employee_time_off" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "employee_time_off_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"employee_id" bigint NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"reason" text NOT NULL,
	"note" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "eto_ends_after_starts" CHECK ("employee_time_off"."ends_at" > "employee_time_off"."starts_at"),
	CONSTRAINT "eto_reason_check" CHECK ("employee_time_off"."reason" in ('vacation','sick','personal','training','other'))
);
--> statement-breakpoint
CREATE TABLE "employee_weekly_schedule" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "employee_weekly_schedule_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"employee_id" bigint NOT NULL,
	"weekday" integer NOT NULL,
	"starts_at" text NOT NULL,
	"ends_at" text NOT NULL,
	"effective_from" text NOT NULL,
	"effective_until" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ews_weekday_range" CHECK ("employee_weekly_schedule"."weekday" between 1 and 7),
	CONSTRAINT "ews_ends_after_starts" CHECK ("employee_weekly_schedule"."ends_at" > "employee_weekly_schedule"."starts_at"),
	CONSTRAINT "ews_effective_until_after_from" CHECK ("employee_weekly_schedule"."effective_until" is null or "employee_weekly_schedule"."effective_until" >= "employee_weekly_schedule"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "employees_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"salon_id" bigint NOT NULL,
	"app_user_id" text,
	"display_name" text NOT NULL,
	"slug" text NOT NULL,
	"bio" text,
	"photo_path" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"color_hex" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employees_color_hex_format" CHECK ("employees"."color_hex" is null or "employees"."color_hex" ~ '^#[0-9A-Fa-f]{6}$')
);
--> statement-breakpoint
CREATE TABLE "salon_closures" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "salon_closures_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"salon_id" bigint NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"label" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sc_ends_after_starts" CHECK ("salon_closures"."ends_at" > "salon_closures"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "salon_working_hours" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "salon_working_hours_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"salon_id" bigint NOT NULL,
	"weekday" integer NOT NULL,
	"opens_at" text,
	"closes_at" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "swh_weekday_range" CHECK ("salon_working_hours"."weekday" between 1 and 7),
	CONSTRAINT "swh_open_close_consistency" CHECK (("salon_working_hours"."opens_at" is null and "salon_working_hours"."closes_at" is null) or ("salon_working_hours"."opens_at" is not null and "salon_working_hours"."closes_at" is not null and "salon_working_hours"."closes_at" > "salon_working_hours"."opens_at"))
);
--> statement-breakpoint
CREATE TABLE "salons" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "salons_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"timezone" text DEFAULT 'Europe/Madrid' NOT NULL,
	"locale" text DEFAULT 'es-ES' NOT NULL,
	"slot_granularity_minutes" integer DEFAULT 15 NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"address" text,
	"phone" text,
	"contact_email" text,
	"logo_path" text,
	"booking_min_hours_ahead" integer DEFAULT 2 NOT NULL,
	"booking_max_days_ahead" integer DEFAULT 60 NOT NULL,
	"cancellation_min_hours" integer DEFAULT 12 NOT NULL,
	"cancellation_policy_text" text,
	"terms_text" text,
	"notify_salon_on_new_booking" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"onboarding_completed_at" timestamp with time zone,
	CONSTRAINT "salons_slug_unique" UNIQUE("slug"),
	CONSTRAINT "salons_slot_granularity_range" CHECK ("salons"."slot_granularity_minutes" > 0 and "salons"."slot_granularity_minutes" <= 120),
	CONSTRAINT "salons_booking_min_hours_ahead_range" CHECK ("salons"."booking_min_hours_ahead" >= 0 and "salons"."booking_min_hours_ahead" <= 168),
	CONSTRAINT "salons_booking_max_days_ahead_range" CHECK ("salons"."booking_max_days_ahead" >= 1 and "salons"."booking_max_days_ahead" <= 365),
	CONSTRAINT "salons_cancellation_min_hours_range" CHECK ("salons"."cancellation_min_hours" >= 0 and "salons"."cancellation_min_hours" <= 720)
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "services_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"salon_id" bigint NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"duration_minutes" integer NOT NULL,
	"price_cents" integer NOT NULL,
	"max_concurrent" integer,
	"color_hex" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "services_duration_minutes_check" CHECK ("services"."duration_minutes" > 0 and "services"."duration_minutes" % 5 = 0),
	CONSTRAINT "services_price_cents_check" CHECK ("services"."price_cents" >= 0),
	CONSTRAINT "services_max_concurrent_check" CHECK ("services"."max_concurrent" is null or "services"."max_concurrent" > 0),
	CONSTRAINT "services_color_hex_format" CHECK ("services"."color_hex" is null or "services"."color_hex" ~ '^#[0-9A-Fa-f]{6}$')
);
--> statement-breakpoint
ALTER TABLE "app_users" ADD CONSTRAINT "app_users_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_password_reset_tokens" ADD CONSTRAINT "auth_password_reset_tokens_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_notifications" ADD CONSTRAINT "booking_notifications_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_notifications" ADD CONSTRAINT "booking_notifications_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_status_events" ADD CONSTRAINT "booking_status_events_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_status_events" ADD CONSTRAINT "booking_status_events_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_tokens" ADD CONSTRAINT "booking_tokens_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_recurring_breaks" ADD CONSTRAINT "employee_recurring_breaks_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_services" ADD CONSTRAINT "employee_services_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_services" ADD CONSTRAINT "employee_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_time_off" ADD CONSTRAINT "employee_time_off_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_time_off" ADD CONSTRAINT "employee_time_off_created_by_app_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_weekly_schedule" ADD CONSTRAINT "employee_weekly_schedule_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_app_user_id_app_users_id_fk" FOREIGN KEY ("app_user_id") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon_closures" ADD CONSTRAINT "salon_closures_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon_closures" ADD CONSTRAINT "salon_closures_created_by_app_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon_working_hours" ADD CONSTRAINT "salon_working_hours_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "app_users_email_unique" ON "app_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "app_users_salon_id_idx" ON "app_users" USING btree ("salon_id");--> statement-breakpoint
CREATE INDEX "auth_password_reset_user_id_idx" ON "auth_password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_items_booking_position_unique" ON "booking_items" USING btree ("booking_id","position");--> statement-breakpoint
CREATE INDEX "booking_items_booking_id_idx" ON "booking_items" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_items_service_id_idx" ON "booking_items" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "booking_items_employee_id_idx" ON "booking_items" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "booking_items_employee_starts_active_idx" ON "booking_items" USING btree ("employee_id","starts_at") WHERE "booking_items"."booking_status" in ('pending','confirmed','in_progress');--> statement-breakpoint
CREATE INDEX "booking_items_service_starts_active_idx" ON "booking_items" USING btree ("service_id","starts_at") WHERE "booking_items"."booking_status" in ('pending','confirmed','in_progress');--> statement-breakpoint
CREATE UNIQUE INDEX "booking_notifications_booking_kind_version_unique" ON "booking_notifications" USING btree ("booking_id","kind","version");--> statement-breakpoint
CREATE INDEX "booking_notifications_salon_idx" ON "booking_notifications" USING btree ("salon_id");--> statement-breakpoint
CREATE INDEX "booking_notifications_booking_idx" ON "booking_notifications" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_status_events_booking_id_idx" ON "booking_status_events" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_tokens_booking_id_idx" ON "booking_tokens" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "bookings_salon_id_idx" ON "bookings" USING btree ("salon_id");--> statement-breakpoint
CREATE INDEX "bookings_client_id_idx" ON "bookings" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "bookings_salon_starts_idx" ON "bookings" USING btree ("salon_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "clients_salon_email_unique" ON "clients" USING btree ("salon_id","email") WHERE "clients"."email" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "clients_salon_phone_unique" ON "clients" USING btree ("salon_id","phone") WHERE "clients"."phone" is not null;--> statement-breakpoint
CREATE INDEX "clients_salon_id_idx" ON "clients" USING btree ("salon_id");--> statement-breakpoint
CREATE INDEX "employee_recurring_breaks_employee_id_idx" ON "employee_recurring_breaks" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "employee_recurring_breaks_lookup_idx" ON "employee_recurring_breaks" USING btree ("employee_id","weekday","effective_from","effective_until");--> statement-breakpoint
CREATE INDEX "employee_services_service_id_idx" ON "employee_services" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "employee_time_off_employee_id_idx" ON "employee_time_off" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "employee_weekly_schedule_employee_id_idx" ON "employee_weekly_schedule" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "employee_weekly_schedule_lookup_idx" ON "employee_weekly_schedule" USING btree ("employee_id","weekday","effective_from","effective_until");--> statement-breakpoint
CREATE UNIQUE INDEX "employees_salon_slug_unique" ON "employees" USING btree ("salon_id","slug");--> statement-breakpoint
CREATE INDEX "employees_salon_id_idx" ON "employees" USING btree ("salon_id");--> statement-breakpoint
CREATE INDEX "employees_app_user_id_idx" ON "employees" USING btree ("app_user_id") WHERE "employees"."app_user_id" is not null;--> statement-breakpoint
CREATE INDEX "salon_closures_salon_id_idx" ON "salon_closures" USING btree ("salon_id");--> statement-breakpoint
CREATE UNIQUE INDEX "salon_working_hours_salon_weekday_unique" ON "salon_working_hours" USING btree ("salon_id","weekday");--> statement-breakpoint
CREATE INDEX "salon_working_hours_salon_idx" ON "salon_working_hours" USING btree ("salon_id");--> statement-breakpoint
CREATE UNIQUE INDEX "services_salon_slug_unique" ON "services" USING btree ("salon_id","slug");--> statement-breakpoint
CREATE INDEX "services_salon_id_idx" ON "services" USING btree ("salon_id");