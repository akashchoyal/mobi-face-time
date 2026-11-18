<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules

- The separately hosted Python FastAPI face-match service lives in `python-backend/`; the app adapter lives in `src/lib/py-backend.server.ts`, stays disabled by default, and activates only when BOTH `PY_BACKEND_URL` and `PY_BACKEND_API_KEY` secrets exist. Contract: `POST {PY_BACKEND_URL}/v1/face-match` with Bearer key, body `{reference_image, selfie_image}` (data URLs), response `{same_person, confidence, reason}`. When inactive, face matching uses the built-in Lovable AI gateway in `attendance.functions.ts` — never make a live connection without the URL and key.
- Python Programming and FastAPI are backend technologies, never school subjects in `src/lib/subjects.ts`.
- Teacher group-photo recognition uses the optional FastAPI `/v1/group-face-match` embedding matcher for up to 70 faces; never use a language model for bulk identity matching, because uncertain identities must remain unmarked.
- Group scan results are server-created, teacher-owned and expire after 30 minutes; the locked `confirm_group_attendance` RPC validates recognized IDs and deduplicates India-local daily check-ins, because client selections cannot authorize arbitrary attendance writes.
