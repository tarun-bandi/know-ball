-- Fix: rename local variable to avoid ambiguity with codenames_rooms.code column
CREATE OR REPLACE FUNCTION public.generate_room_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result_code text;
  i int;
BEGIN
  LOOP
    result_code := '';
    FOR i IN 1..6 LOOP
      result_code := result_code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM codenames_rooms r WHERE r.code = result_code AND r.status != 'finished') THEN
      RETURN result_code;
    END IF;
  END LOOP;
END;
$$;
