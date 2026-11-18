REVOKE INSERT ON public.group_attendance_scans FROM authenticated;
DROP POLICY teacher_creates_own_scan ON public.group_attendance_scans;