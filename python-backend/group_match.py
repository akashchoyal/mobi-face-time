"""One-to-one class-photo matching using face embeddings, not language models."""
import numpy as np
from scipy.optimize import linear_sum_assignment

MAX_STUDENTS = 70
DISTANCE_THRESHOLD = 0.30
AMBIGUITY_MARGIN = 0.05


def assign_faces(reference_embeddings, group_embeddings):
    if len(reference_embeddings) > MAX_STUDENTS or len(group_embeddings) > MAX_STUDENTS:
        raise ValueError("A scan supports at most 70 students and faces.")
    if not reference_embeddings or not group_embeddings:
        return []
    refs = np.asarray(reference_embeddings, dtype=float)
    faces = np.asarray(group_embeddings, dtype=float)
    if not np.isfinite(refs).all() or not np.isfinite(faces).all():
        raise ValueError("Invalid embeddings.")
    ref_norms = np.linalg.norm(refs, axis=1, keepdims=True)
    face_norms = np.linalg.norm(faces, axis=1, keepdims=True)
    if (ref_norms == 0).any() or (face_norms == 0).any():
        raise ValueError("Invalid embeddings.")
    distances = np.clip(1 - (refs / ref_norms) @ (faces / face_norms).T, 0, 2)
    rows, cols = linear_sum_assignment(distances)
    matches = []
    for row, col in zip(rows, cols):
        distance = float(distances[row, col])
        alternatives = np.delete(distances[:, col], row)
        if distance > DISTANCE_THRESHOLD:
            continue
        if len(alternatives) and float(alternatives.min()) - distance < AMBIGUITY_MARGIN:
            continue
        matches.append({"reference_index": int(row), "face_index": int(col),
                        "confidence": 0.6 + 0.39 * (1 - distance / DISTANCE_THRESHOLD)})
    return matches