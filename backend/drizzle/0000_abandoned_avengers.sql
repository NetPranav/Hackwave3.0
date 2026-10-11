CREATE TABLE "baselines" (
	"project_id" text NOT NULL,
	"service" text NOT NULL,
	"endpoint" text NOT NULL,
	"payload" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "code_maps" (
	"repo" text PRIMARY KEY NOT NULL,
	"commit" text NOT NULL,
	"payload" jsonb NOT NULL,
	"scanned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drift_events" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"service" text NOT NULL,
	"detector" text NOT NULL,
	"severity" text NOT NULL,
	"state" text NOT NULL,
	"confidence" real NOT NULL,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fingerprints" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"service" text NOT NULL,
	"endpoint" text NOT NULL,
	"window_start" timestamp NOT NULL,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"installation_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sdk_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"key_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"project_id" text PRIMARY KEY NOT NULL,
	"notifications" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sdk_keys" ADD CONSTRAINT "sdk_keys_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "baseline_key" ON "baselines" USING btree ("project_id","service","endpoint");--> statement-breakpoint
CREATE INDEX "fp_lookup" ON "fingerprints" USING btree ("project_id","service","endpoint","window_start");--> statement-breakpoint
CREATE UNIQUE INDEX "sdk_keys_hash" ON "sdk_keys" USING btree ("key_hash");