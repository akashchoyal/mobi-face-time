ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS school_name text NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS class_name text NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS section text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.class_seat_count(_class text, _section text)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM public.profiles WHERE class_name = _class AND section = _section
$$;
GRANT EXECUTE ON FUNCTION public.class_seat_count(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  _class text := COALESCE(NEW.raw_user_meta_data->>'class_name','');
  _section text := COALESCE(NEW.raw_user_meta_data->>'section','');
BEGIN
  IF _class <> '' AND (SELECT count(*) FROM public.profiles WHERE class_name=_class AND section=_section) >= 70 THEN
    RAISE EXCEPTION 'Class is full (70 students)';
  END IF;
  INSERT INTO public.profiles (id, full_name, email, school_name, class_name, section)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), COALESCE(NEW.email,''),
    COALESCE(NEW.raw_user_meta_data->>'school_name',''), _class, _section)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN NEW.raw_user_meta_data->>'role' = 'teacher' THEN 'teacher'::public.app_role ELSE 'student'::public.app_role END)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$function$;