CREATE TABLE "salon_lifecycle" (
	"salon_id" bigint PRIMARY KEY NOT NULL,
	"billing_status" text DEFAULT 'trialing' NOT NULL,
	"trial_ends_at" timestamp with time zone DEFAULT now() + interval '14 days',
	"suspended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "salon_lifecycle_billing_status_check" CHECK ("salon_lifecycle"."billing_status" in ('trialing','active','past_due','canceled')),
	CONSTRAINT "salon_lifecycle_trial_end_check" CHECK ("salon_lifecycle"."billing_status" <> 'trialing' or "salon_lifecycle"."trial_ends_at" is not null)
);
--> statement-breakpoint
ALTER TABLE "salon_lifecycle" ADD CONSTRAINT "salon_lifecycle_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
-- Backfill deliberado: los salones preexistentes son cuentas operativas y no
-- deben entrar en trial. No existen clientes reales en produccion a esta fecha.
INSERT INTO "salon_lifecycle" (
	"salon_id",
	"billing_status",
	"trial_ends_at",
	"created_at",
	"updated_at"
)
SELECT "id", 'active', NULL, "created_at", now()
FROM "salons";
--> statement-breakpoint
DO $$
DECLARE
	salon_count bigint;
	lifecycle_count bigint;
BEGIN
	SELECT count(*) INTO salon_count FROM salons;
	SELECT count(*) INTO lifecycle_count FROM salon_lifecycle;

	IF salon_count <> lifecycle_count THEN
		RAISE EXCEPTION 'salon_lifecycle_backfill_incomplete: salons=%, lifecycle=%',
			salon_count, lifecycle_count;
	END IF;
END $$;
--> statement-breakpoint
-- El ciclo de vida no comparte la excepcion de lectura publica de `salons`.
-- Toda lectura y escritura requiere el GUC del tenant y falla de forma cerrada.
ALTER TABLE "salon_lifecycle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "salon_lifecycle" FORCE ROW LEVEL SECURITY;
CREATE POLICY "salon_lifecycle_tenant" ON "salon_lifecycle"
	FOR ALL
	USING ("salon_id" = current_setting('app.current_salon_id', true)::bigint)
	WITH CHECK ("salon_id" = current_setting('app.current_salon_id', true)::bigint);
--> statement-breakpoint
-- Postgres impone el grafo aunque una futura integracion intente saltarse el
-- contrato TypeScript. Repetir el mismo estado es un no-op valido.
CREATE FUNCTION "salon_lifecycle_validate_transition"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF NEW.billing_status IS DISTINCT FROM OLD.billing_status AND NOT (
		(OLD.billing_status = 'trialing' AND NEW.billing_status IN ('active', 'canceled')) OR
		(OLD.billing_status = 'active' AND NEW.billing_status IN ('past_due', 'canceled')) OR
		(OLD.billing_status = 'past_due' AND NEW.billing_status IN ('active', 'canceled')) OR
		(OLD.billing_status = 'canceled' AND NEW.billing_status IN ('trialing', 'active'))
	) THEN
		RAISE EXCEPTION 'salon_lifecycle_invalid_transition: % -> %',
			OLD.billing_status, NEW.billing_status
			USING ERRCODE = '23514',
				CONSTRAINT = 'salon_lifecycle_transition_check';
	END IF;

	NEW.updated_at = now();
	RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER "salon_lifecycle_validate_transition"
	BEFORE UPDATE ON "salon_lifecycle"
	FOR EACH ROW
	EXECUTE FUNCTION "salon_lifecycle_validate_transition"();
