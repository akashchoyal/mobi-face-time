# FaceMark Python face-match service

This is a separate Python service for FaceMark's optional face matching. The
attendance app does not run Python itself; it can call this service after it is
deployed and the server address and matching API key are configured securely.

## Run locally

Use Python 3.11. Create a virtual environment, install `requirements.txt`, set
`PY_BACKEND_API_KEY` in your terminal or hosting environment, then start the
service:

```sh
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
export PY_BACKEND_API_KEY='your-long-random-key'
uvicorn main:app --host 0.0.0.0 --port 8000
```

On Windows PowerShell, set the key with
`$env:PY_BACKEND_API_KEY = 'your-long-random-key'` before starting Uvicorn.
Never commit the real key or put it in a source file.

## Deploy

Deploy this directory (`python-backend/`) as a Docker web service on a Python
host. Add `PY_BACKEND_API_KEY` as a private environment variable in that host's
settings, then copy the public HTTPS service address. `/health` provides a
basic service check. The first face comparison downloads the FaceNet model and
can take longer; subsequent requests reuse it in memory. Use a host with enough
memory for TensorFlow and the downloaded model.

For local Docker testing, build the image from this directory and pass the key
at run time using your container platform's secret/environment setting. Do not
save a real key in the image or Dockerfile.

## API contract

`POST /v1/face-match` requires `Authorization: Bearer <PY_BACKEND_API_KEY>` and
JSON with `reference_image` and `selfie_image` as JPEG, PNG, or WebP data URLs.
The response is `{ "same_person": boolean, "confidence": 0..1, "reason": string }`.
Each image is limited to 8 MiB, and matching requires a clear face in each
image. Invalid images receive HTTP 422; a missing server key returns 503; an
invalid request key returns 401. Image contents and keys are not logged or
included in error responses. This verifies face similarity only; it does not
prove that the selfie is a live person or prevent presentation attacks.

The FaceMark app continues using its built-in face check until both
`PY_BACKEND_URL` and `PY_BACKEND_API_KEY` have been added to the app's secure
settings. Do not configure a live connection before the service is deployed.

## Teacher group-photo attendance

`POST /v1/group-face-match` uses the same Bearer key and accepts
`{group_image, students: [{student_id, reference_image}]}` with up to 70 enrolled
students and 70 detected faces. It returns `{detected_faces, matches:
[{student_id, confidence}], unavailable_student_ids}`. RetinaFace detects faces
and FaceNet512 produces embeddings; one-to-one cosine-distance assignment rejects
ambiguous identities. This is not a guarantee that 70 small/distant faces will
be recognized: clear, high-resolution, front-facing photos are essential.
Warm up both model weights before production use; allow a request body large
enough for the reference photos and configure the host timeout accordingly.

The teacher captures a full-width rear-camera photo, reviews recognized names,
and confirms attendance. Only recognized students can be confirmed, unmatched
students are not marked absent, and repeat check-ins for the same day/subject/
period are skipped. Scan results expire after 30 minutes. The group photo is
not stored in the database. Group scanning stays disabled until both Python
service secrets exist; camera preview can still be opened before connection.

Run tests without downloading model weights:
`python -m unittest discover -s tests -v`.