"""FastAPI face-matching service for the FaceMark attendance app."""

from __future__ import annotations

import base64
import binascii
import hmac
import math
import os
import re
from functools import lru_cache
from io import BytesIO
import numpy as np
from fastapi import FastAPI, Header, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from PIL import Image, UnidentifiedImageError
from group_match import assign_faces

MAX_IMAGE_BYTES = 8 * 1024 * 1024
MAX_IMAGE_DIMENSION = 4096
MAX_IMAGE_PIXELS = 16_000_000
MAX_DATA_URL_LENGTH = 11_184_900
DATA_URL_PATTERN = re.compile(
    r"\Adata:image/(?:jpeg|png|webp);base64,([A-Za-z0-9+/]*={0,2})\Z"
)

app = FastAPI(
    title="FaceMark Face Match Service",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
)


class FaceMatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reference_image: str = Field(min_length=100, max_length=MAX_DATA_URL_LENGTH)
    selfie_image: str = Field(min_length=100, max_length=MAX_DATA_URL_LENGTH)


class FaceMatchResponse(BaseModel):
    same_person: bool
    confidence: float = Field(ge=0, le=1)
    reason: str


class StudentReference(BaseModel):
    model_config = ConfigDict(extra="forbid")
    student_id: str = Field(min_length=36, max_length=36)
    reference_image: str = Field(min_length=100, max_length=MAX_DATA_URL_LENGTH)


class GroupMatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    group_image: str = Field(min_length=100, max_length=MAX_DATA_URL_LENGTH)
    students: list[StudentReference] = Field(min_length=1, max_length=70)


def _authorize(authorization):
    expected_key = os.environ.get("PY_BACKEND_API_KEY", "")
    if not expected_key:
        raise HTTPException(status_code=503, detail="Face matching is not configured.")
    scheme, _, key = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not key or not hmac.compare_digest(key, expected_key):
        raise HTTPException(status_code=401, detail="Invalid authorization.")


def _represent(image):
    return _get_face_model().represent(img_path=image, model_name="Facenet512",
        detector_backend="retinaface", enforce_detection=True, align=True)


@app.post("/v1/group-face-match")
def group_face_match(payload: GroupMatchRequest, authorization: str | None = Header(default=None)):
    _authorize(authorization)
    if len({s.student_id for s in payload.students}) != len(payload.students):
        raise HTTPException(status_code=422, detail="Duplicate students are not allowed.")
    image = _decode_image(payload.group_image)
    references = [_decode_image(s.reference_image) for s in payload.students]
    try:
        faces = _represent(image)
        if len(faces) > 70:
            raise ValueError("Too many faces.")
        embeddings, students, unavailable = [], [], []
        for student, reference in zip(payload.students, references):
            try:
                represented = _represent(reference)
                if len(represented) != 1:
                    raise ValueError("Reference needs one face.")
                embeddings.append(represented[0]["embedding"])
                students.append(student.student_id)
            except ValueError:
                unavailable.append(student.student_id)
        matches = assign_faces(embeddings, [f["embedding"] for f in faces])
        return {"detected_faces": len(faces), "matches": [
            {"student_id": students[m["reference_index"]], "confidence": m["confidence"]}
            for m in matches], "unavailable_student_ids": unavailable}
    except ValueError as error:
        raise HTTPException(status_code=422, detail="Use a clear class photo with at most 70 faces.") from error
    except Exception as error:
        raise HTTPException(status_code=503, detail="Group face matching is temporarily unavailable.") from error


def _decode_image(data_url: str) -> np.ndarray:
    match = DATA_URL_PATTERN.fullmatch(data_url)
    if match is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Images must be JPEG, PNG, or WebP data URLs.",
        )

    try:
        image_bytes = base64.b64decode(match.group(1), validate=True)
        if not image_bytes or len(image_bytes) > MAX_IMAGE_BYTES:
            raise ValueError("Image size is outside the allowed range.")
        with Image.open(BytesIO(image_bytes)) as image:
            if image.format not in {"JPEG", "PNG", "WEBP"}:
                raise ValueError("Unsupported image format.")
            width, height = image.size
            if (
                width < 32
                or height < 32
                or width > MAX_IMAGE_DIMENSION
                or height > MAX_IMAGE_DIMENSION
                or width * height > MAX_IMAGE_PIXELS
            ):
                raise ValueError("Image dimensions are outside the allowed range.")
            image.load()
            rgb = np.asarray(image.convert("RGB"), dtype=np.uint8)
    except HTTPException:
        raise
    except (
        binascii.Error,
        Image.DecompressionBombError,
        OSError,
        UnidentifiedImageError,
        ValueError,
    ) as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="One of the supplied images is invalid or too large.",
        ) from error

    # DeepFace expects OpenCV-style BGR arrays, rather than Pillow's RGB order.
    return np.ascontiguousarray(rgb[:, :, ::-1])


@lru_cache(maxsize=1)
def _get_face_model():
    # Load the face-recognition package only when the first authenticated check runs.
    from deepface import DeepFace

    return DeepFace


def _compare_faces(reference: np.ndarray, selfie: np.ndarray) -> dict:
    return _get_face_model().verify(
        img1_path=reference,
        img2_path=selfie,
        model_name="Facenet512",
        detector_backend="opencv",
        distance_metric="cosine",
        enforce_detection=True,
    )


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/face-match", response_model=FaceMatchResponse)
def face_match(
    payload: FaceMatchRequest,
    authorization: str | None = Header(default=None),
) -> FaceMatchResponse:
    expected_key = os.environ.get("PY_BACKEND_API_KEY", "")
    if not expected_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Face matching is not configured.",
        )

    scheme, _, supplied_key = (authorization or "").partition(" ")
    if (
        scheme.lower() != "bearer"
        or not supplied_key
        or not hmac.compare_digest(supplied_key, expected_key)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    reference = _decode_image(payload.reference_image)
    selfie = _decode_image(payload.selfie_image)

    try:
        result = _compare_faces(reference, selfie)
        distance = float(result.get("distance", 1))
        threshold = float(result.get("threshold", 1))
        if not math.isfinite(distance) or not math.isfinite(threshold) or threshold <= 0:
            raise ValueError("The face model returned an invalid score.")
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Both images must show one clear face.",
        ) from error
    except Exception as error:
        # Do not return image content, credentials, model paths, or internal errors.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Face matching is temporarily unavailable.",
        ) from error

    same_person = bool(result.get("verified", False))
    similarity = max(0.0, min(1.0, 1.0 - distance / threshold))
    confidence = similarity * (0.39 if same_person else 0.59) + (
        0.6 if same_person else 0.0
    )
    return FaceMatchResponse(
        same_person=same_person,
        confidence=confidence,
        reason="Faces match." if same_person else "Faces do not match.",
    )