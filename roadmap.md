# Tasks

- [x] Remove mistakenly added Python/FastAPI subjects.
- [x] Prepare the FastAPI service project and the server-only, disabled-by-default app integration.
- [x] Test the service API contract and check the existing app still renders.
- [ ] Live connection to the user's FastAPI server — blocked until the user supplies the server URL and API key (secrets: PY_BACKEND_URL, PY_BACKEND_API_KEY).
- [x] Add teacher camera group-photo attendance scanning for up to 70 students, with confirmation before saving; camera checked and matcher tests pass.
- [ ] Verify real group-photo recognition and confirmation end-to-end — blocked until the Python server is deployed and both connection secrets are supplied.
- [x] Remove student face-scanning controls and send students to their attendance table.
- [x] Add teacher live-camera scan controls with serial recognition and automatic saving of recognized students; 60-student cycle tested.
- [ ] Verify live-camera recognition and attendance readback with real faces — blocked by missing Python server URL and key.
- [x] Keep recognition simultaneous within each class camera frame, as clarified by the user's example screenshot.
