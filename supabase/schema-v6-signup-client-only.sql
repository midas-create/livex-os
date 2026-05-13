-- =============================================================================
-- Signup: public.users row must always be role = 'client' (never from metadata)
-- Run in Supabase SQL Editor after schema.sql (replaces handle_new_user body)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, company_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'company_name', ''),
    'client'
  );
  RETURN NEW;
END;
$$;
