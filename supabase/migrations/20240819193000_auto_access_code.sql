-- Function to generate a random 4-digit numeric code
CREATE OR REPLACE FUNCTION public.generate_unique_access_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
    new_code text;
    exists_already boolean;
BEGIN
    LOOP
        -- Generate 4 random digits
        new_code := LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
        
        -- Check if it exists for the same owner (tenant isolation)
        -- We use a simple loop, given 4 digits (10k combinations) it's safe for reasonable tenant sizes
        SELECT EXISTS (
            SELECT 1 FROM public.clients 
            WHERE access_code = new_code
        ) INTO exists_already;
        
        EXIT WHEN NOT exists_already;
    END LOOP;
    RETURN new_code;
END;
$$;

-- Update existing employees who don't have a code
UPDATE public.clients 
SET access_code = public.generate_unique_access_code()
WHERE access_code IS NULL OR access_code = '';

-- Trigger to auto-generate code on insert if not provided
CREATE OR REPLACE FUNCTION public.trg_clients_auto_access_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.access_code IS NULL OR NEW.access_code = '' THEN
        NEW.access_code := public.generate_unique_access_code();
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clients_auto_access_code ON public.clients;
CREATE TRIGGER trg_clients_auto_access_code
    BEFORE INSERT ON public.clients
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_clients_auto_access_code();

-- Ensure authenticated users can still see it (should be fine if they can see the client)
GRANT EXECUTE ON FUNCTION public.generate_unique_access_code() TO authenticated;
