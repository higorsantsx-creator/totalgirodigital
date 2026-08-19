-- Add a stable, human-friendly access code for employees.
-- Codes are generated server-side in a database trigger and are never reused.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS access_code text;

CREATE UNIQUE INDEX IF NOT EXISTS clients_access_code_unique
  ON public.clients (access_code)
  WHERE access_code IS NOT NULL;

CREATE SEQUENCE IF NOT EXISTS public.employee_access_code_seq START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION public.generate_employee_access_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  next_code bigint;
BEGIN
  next_code := nextval('public.employee_access_code_seq');
  IF next_code > 9999 THEN
    RAISE EXCEPTION 'Limite de códigos de funcionários atingido (9999)';
  END IF;
  RETURN lpad(next_code::text, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.set_employee_access_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.access_code IS NULL OR btrim(NEW.access_code) = '' THEN
    NEW.access_code := public.generate_employee_access_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clients_set_employee_access_code ON public.clients;
CREATE TRIGGER clients_set_employee_access_code
BEFORE INSERT ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.set_employee_access_code();

-- Backfill existing employees in a deterministic order without changing their IDs.
DO $$
DECLARE
  client_row record;
BEGIN
  FOR client_row IN
    SELECT id
    FROM public.clients
    WHERE access_code IS NULL
    ORDER BY created_at, id
  LOOP
    UPDATE public.clients
    SET access_code = public.generate_employee_access_code()
    WHERE id = client_row.id;
  END LOOP;
END;
$$;
