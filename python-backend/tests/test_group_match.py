import os
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
import numpy as np
import main
from group_match import assign_faces
import test_main


class GroupMatchTests(unittest.TestCase):
    def test_scans_70_students_at_once(self):
        embeddings = np.eye(70).tolist()
        matches = assign_faces(embeddings, embeddings)
        self.assertEqual(len(matches), 70)
        self.assertEqual(len({m['face_index'] for m in matches}), 70)

    def test_rejects_71_students(self):
        with self.assertRaises(ValueError):
            assign_faces(np.eye(71).tolist(), [[1] * 71])

    def test_one_face_cannot_mark_two_students(self):
        self.assertEqual(assign_faces([[1, 0], [1, 0]], [[1, 0]]), [])

    def test_different_faces_are_not_present(self):
        self.assertEqual(assign_faces([[1, 0]], [[0, 1]]), [])

    def test_group_api_requires_bearer(self):
        image = test_main.FaceMatchApiTests.image_data_url()
        with patch.dict(os.environ, {'PY_BACKEND_API_KEY': 'test-key'}):
            response = TestClient(main.app).post('/v1/group-face-match', json={
                'group_image': image, 'students': [{'student_id': 'a' * 36, 'reference_image': image}]})
        self.assertEqual(response.status_code, 401)

    def test_group_api_returns_recognized_student(self):
        image = test_main.FaceMatchApiTests.image_data_url()
        with patch.dict(os.environ, {'PY_BACKEND_API_KEY': 'test-key'}), patch.object(
            main, '_represent', return_value=[{'embedding': [1, 0]}]):
            response = TestClient(main.app).post('/v1/group-face-match', headers={
                'Authorization': 'Bearer test-key'}, json={'group_image': image,
                'students': [{'student_id': 'a' * 36, 'reference_image': image}]})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['matches'][0]['student_id'], 'a' * 36)


if __name__ == '__main__':
    unittest.main()