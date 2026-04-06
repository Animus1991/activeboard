CREATE TABLE IF NOT EXISTS "army_list_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"army_list_id" uuid NOT NULL,
	"unit_type_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1,
	"custom_name" varchar(100),
	"upgrades" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "army_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"game_system_id" uuid NOT NULL,
	"faction_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"points_limit" integer DEFAULT 1000,
	"total_points" integer DEFAULT 0,
	"is_public" boolean DEFAULT false,
	"is_favorite" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "factions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_system_id" uuid NOT NULL,
	"slug" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"playstyle" text,
	"icon_url" text,
	"color_primary" varchar(7),
	"color_secondary" varchar(7),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "friendships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"friend_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'pending',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"accepted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "game_room_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"army_list_id" uuid,
	"is_ready" boolean DEFAULT false,
	"is_connected" boolean DEFAULT true,
	"device_type" varchar(20),
	"team_number" integer,
	"turn_order" integer,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"left_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "game_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(8) NOT NULL,
	"host_id" uuid NOT NULL,
	"game_system_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"max_players" integer DEFAULT 4,
	"points_limit" integer DEFAULT 1000,
	"is_private" boolean DEFAULT true,
	"password" varchar(100),
	"status" varchar(20) DEFAULT 'waiting',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"finished_at" timestamp,
	CONSTRAINT "game_rooms_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "game_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"current_turn" integer DEFAULT 1,
	"current_player_id" uuid,
	"game_state" jsonb DEFAULT '{}'::jsonb,
	"winner_id" uuid,
	"end_reason" varchar(50),
	"total_turns" integer,
	"duration_minutes" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "game_systems" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"publisher" varchar(100),
	"description" text,
	"min_players" integer DEFAULT 2,
	"max_players" integer DEFAULT 4,
	"avg_play_time_minutes" integer,
	"complexity" varchar(20),
	"rules_url" text,
	"icon_url" text,
	"cover_image_url" text,
	"is_active" boolean DEFAULT true,
	"is_featured" boolean DEFAULT false,
	"release_phase" varchar(20) DEFAULT 'alpha',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "game_systems_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "unit_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"faction_id" uuid NOT NULL,
	"slug" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"points_cost" integer DEFAULT 0,
	"quality" integer,
	"defense" integer,
	"model_count" integer DEFAULT 1,
	"equipment" jsonb DEFAULT '[]'::jsonb,
	"special_rules" jsonb DEFAULT '[]'::jsonb,
	"model_asset_id" varchar(100),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"username" varchar(50) NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" varchar(100),
	"avatar_url" text,
	"bio" text,
	"preferred_game_systems" jsonb DEFAULT '[]'::jsonb,
	"vr_headset" varchar(50),
	"timezone" varchar(50),
	"total_games_played" integer DEFAULT 0,
	"total_play_time_minutes" integer DEFAULT 0,
	"is_verified" boolean DEFAULT false,
	"is_admin" boolean DEFAULT false,
	"is_banned" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_login_at" timestamp,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "waitlist_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(100),
	"primary_interest" varchar(50),
	"current_platforms" jsonb DEFAULT '[]'::jsonb,
	"has_vr_headset" boolean DEFAULT false,
	"vr_headset_type" varchar(50),
	"play_frequency" varchar(50),
	"biggest_pain_point" text,
	"willing_to_pay" varchar(50),
	"referral_code" varchar(20),
	"referred_by" varchar(20),
	"referral_count" integer DEFAULT 0,
	"status" varchar(20) DEFAULT 'pending',
	"priority" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"invited_at" timestamp,
	"converted_at" timestamp,
	CONSTRAINT "waitlist_entries_email_unique" UNIQUE("email"),
	CONSTRAINT "waitlist_entries_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "army_list_units" ADD CONSTRAINT "army_list_units_army_list_id_army_lists_id_fk" FOREIGN KEY ("army_list_id") REFERENCES "public"."army_lists"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "army_list_units" ADD CONSTRAINT "army_list_units_unit_type_id_unit_types_id_fk" FOREIGN KEY ("unit_type_id") REFERENCES "public"."unit_types"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "army_lists" ADD CONSTRAINT "army_lists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "army_lists" ADD CONSTRAINT "army_lists_game_system_id_game_systems_id_fk" FOREIGN KEY ("game_system_id") REFERENCES "public"."game_systems"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "army_lists" ADD CONSTRAINT "army_lists_faction_id_factions_id_fk" FOREIGN KEY ("faction_id") REFERENCES "public"."factions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "factions" ADD CONSTRAINT "factions_game_system_id_game_systems_id_fk" FOREIGN KEY ("game_system_id") REFERENCES "public"."game_systems"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "friendships" ADD CONSTRAINT "friendships_friend_id_users_id_fk" FOREIGN KEY ("friend_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "game_room_players" ADD CONSTRAINT "game_room_players_room_id_game_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."game_rooms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "game_room_players" ADD CONSTRAINT "game_room_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "game_room_players" ADD CONSTRAINT "game_room_players_army_list_id_army_lists_id_fk" FOREIGN KEY ("army_list_id") REFERENCES "public"."army_lists"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "game_rooms" ADD CONSTRAINT "game_rooms_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "game_rooms" ADD CONSTRAINT "game_rooms_game_system_id_game_systems_id_fk" FOREIGN KEY ("game_system_id") REFERENCES "public"."game_systems"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_room_id_game_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."game_rooms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_current_player_id_users_id_fk" FOREIGN KEY ("current_player_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_winner_id_users_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unit_types" ADD CONSTRAINT "unit_types_faction_id_factions_id_fk" FOREIGN KEY ("faction_id") REFERENCES "public"."factions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "army_list_units_army_list_idx" ON "army_list_units" USING btree ("army_list_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "army_lists_user_idx" ON "army_lists" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "army_lists_game_system_idx" ON "army_lists" USING btree ("game_system_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "factions_game_system_idx" ON "factions" USING btree ("game_system_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "factions_slug_idx" ON "factions" USING btree ("game_system_id","slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "friendships_user_idx" ON "friendships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "friendships_friend_idx" ON "friendships" USING btree ("friend_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "friendships_pair_idx" ON "friendships" USING btree ("user_id","friend_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "game_room_players_room_idx" ON "game_room_players" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "game_room_players_user_idx" ON "game_room_players" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "game_room_players_room_user_idx" ON "game_room_players" USING btree ("room_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "game_rooms_code_idx" ON "game_rooms" USING btree ("code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "game_rooms_host_idx" ON "game_rooms" USING btree ("host_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "game_rooms_status_idx" ON "game_rooms" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "game_sessions_room_idx" ON "game_sessions" USING btree ("room_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "game_systems_slug_idx" ON "game_systems" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refresh_tokens_user_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refresh_tokens_token_idx" ON "refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "unit_types_faction_idx" ON "unit_types" USING btree ("faction_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "waitlist_email_idx" ON "waitlist_entries" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "waitlist_referral_code_idx" ON "waitlist_entries" USING btree ("referral_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "waitlist_status_idx" ON "waitlist_entries" USING btree ("status");