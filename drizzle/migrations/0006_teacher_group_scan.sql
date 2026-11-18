CREATE TABLE public.group_attendance_scans (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), teacher_id uuid NOT NULL, class_name text NOT NULL, section text NOT NULL, school_name text NOT NULL, subject text NOT NULL, period text NOT NULL, matches jsonb NOT NULL DEFAULT '[]', detected_faces integer NOT NULL DEFAULT 0 CHECK (detected_faces BETWEEN 0 AND 70), created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now() + interval '30 minutes', confirmed_at timestamptz);
GRANT SELECT, INSERT ON public.group_attendance_scans TO authenticated;
GRANT ALL ON public.group_attendance_scans TO service_role;
ALTER TABLE public.group_attendance_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY teacher_reads_own_scan ON public.group_attendance_scans FOR SELECT TO authenticated USING (teacher_id = auth.uid() AND public.has_role(auth.uid(), 'teacher'));
CREATE POLICY teacher_creates_own_scan ON public.group_attendance_scans FOR INSERT TO authenticated WITH CHECK (teacher_id = auth.uid() AND public.has_role(auth.uid(), 'teacher'));
CREATE OR REPLACE FUNCTION public.confirm_group_attendance(_scan_id uuid, _student_ids uuid[]) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.group_attendance_scans; saved integer;
BEGIN
IF NOT public.has_role(auth.uid(), 'teacher') THEN RAISE EXCEPTION 'Only teachers can save group attendance'; END IF;
SELECT * INTO s FROM public.group_attendance_scans WHERE id=_scan_id AND teacher_id=auth.uid() FOR UPDATE;
IF NOT FOUND OR s.expires_at < now() THEN RAISE EXCEPTION 'Scan expired. Take a new photo'; END IF;
IF s.confirmed_at IS NOT NULL THEN RETURN 0; END IF;
IF cardinality(_student_ids) IS NULL OR cardinality(_student_ids) NOT BETWEEN 1 AND 70 THEN RAISE EXCEPTION 'Select between 1 and 70 students'; END IF;
IF EXISTS (SELECT 1 FROM unnest(_student_ids) sid WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(s.matches) m WHERE (m->>'student_id')::uuid=sid AND (m->>'confidence')::numeric>=0.6)) THEN RAISE EXCEPTION 'Only recognized students may be confirmed'; END IF;
PERFORM pg_advisory_xact_lock(hashtext(s.school_name || s.class_name || s.section || s.subject || s.period));
INSERT INTO public.attendance(user_id,kind,subject,period,confidence)
SELECT DISTINCT p.id,'in',s.subject,s.period,(m->>'confidence')::double precision FROM jsonb_array_elements(s.matches) m JOIN public.profiles p ON p.id=(m->>'student_id')::uuid WHERE p.id=ANY(_student_ids) AND p.class_name=s.class_name AND p.section=s.section AND p.school_name=s.school_name AND NOT public.has_role(p.id,'teacher') AND NOT EXISTS (SELECT 1 FROM public.attendance a WHERE a.user_id=p.id AND a.kind='in' AND a.subject=s.subject AND a.period=s.period AND (a.created_at AT TIME ZONE 'Asia/Kolkata')::date=(now() AT TIME ZONE 'Asia/Kolkata')::date);
GET DIAGNOSTICS saved=ROW_COUNT;
UPDATE public.group_attendance_scans SET confirmed_at=now() WHERE id=s.id;
RETURN saved;
END; $$;
REVOKE ALL ON FUNCTION public.confirm_group_attendance(uuid,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_group_attendance(uuid,uuid[]) TO authenticated;