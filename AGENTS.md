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

- External Python FastAPI integration lives in `src/lib/py-backend.server.ts`, is disabled by default, and activates only when BOTH `PY_BACKEND_URL` and `PY_BACKEND_API_KEY` secrets exist. Contract: `POST {PY_BACKEND_URL}/v1/face-match` with Bearer key, body `{reference_image, selfie_image}` (data URLs), response `{same_person, confidence, reason}`. When inactive, face matching uses the built-in Lovable AI gateway in `attendance.functions.ts` — never make a live connection without the URL and key.
- Python Programming and FastAPI are backend technologies, never school subjects in `src/lib/subjects.ts`.
