import base64
import os
import unittest
from io import BytesIO
from unittest.mock import patch

from fastapi.testclient import TestClient
from PIL import Image

import main


class FaceMatchApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)
        self.environment = patch.dict(os.environ, {"PY_BACKEND_API_KEY": "test-key"})
        self.environment.start()
        self.addCleanup(self.environment.stop)

    @staticmethod
    def image_data_url():
        buffer = BytesIO()
        Image.new("RGB", (64, 64), color=(120, 90, 80)).save(buffer, format="PNG")
        return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode()

    def payload(self):
        image = self.image_data_url()
        return {"reference_image": image, "selfie_image": image}

    def test_rejects_missing_or_invalid_bearer_key(self):
        self.assertEqual(self.client.post("/v1/face-match", json=self.payload()).status_code, 401)
        response = self.client.post(
            "/v1/face-match",
            json=self.payload(),
            headers={"Authorization": "Bearer wrong-key"},
        )
        self.assertEqual(response.status_code, 401)

    def test_returns_503_if_service_key_is_not_configured(self):
        with patch.dict(os.environ, {}, clear=True):
            response = self.client.post(
                "/v1/face-match",
                json=self.payload(),
                headers={"Authorization": "Bearer test-key"},
            )
        self.assertEqual(response.status_code, 503)

    def test_rejects_invalid_image_before_running_the_model(self):
        payload = self.payload()
        payload["selfie_image"] = "data:image/png;base64,not-an-image"
        with patch.object(main, "_compare_faces") as compare:
            response = self.client.post(
                "/v1/face-match",
                json=payload,
                headers={"Authorization": "Bearer test-key"},
            )
        self.assertEqual(response.status_code, 422)
        compare.assert_not_called()

    def test_returns_the_app_compatible_match_result(self):
        with patch.object(
            main,
            "_compare_faces",
            return_value={"verified": True, "distance": 0.2, "threshold": 0.8},
        ):
            response = self.client.post(
                "/v1/face-match",
                json=self.payload(),
                headers={"Authorization": "Bearer test-key"},
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"same_person": True, "confidence": 0.75, "reason": "Faces match."},
        )

    def test_unmatched_faces_return_zero_confidence_and_a_rejection(self):
        with patch.object(
            main,
            "_compare_faces",
            return_value={"verified": False, "distance": 1.2, "threshold": 0.8},
        ):
            response = self.client.post(
                "/v1/face-match",
                json=self.payload(),
                headers={"Authorization": "Bearer test-key"},
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"same_person": False, "confidence": 0, "reason": "Faces do not match."},
        )


if __name__ == "__main__":
    unittest.main()