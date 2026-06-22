import unittest
from unittest.mock import MagicMock, patch

from botocore.exceptions import ClientError
from fastapi import HTTPException

import server


def throttling_error(message: str = "Too many tokens per day, please wait before trying again."):
    return ClientError(
        {"Error": {"Code": "ThrottlingException", "Message": message}},
        "Converse",
    )


class QuotaFallbackTests(unittest.TestCase):
    def setUp(self):
        self.original_primary = server.BEDROCK_MODEL_ID
        self.original_fallback = server.FALLBACK_BEDROCK_MODEL_ID
        server.BEDROCK_MODEL_ID = "apac.amazon.nova-lite-v1:0"
        server.FALLBACK_BEDROCK_MODEL_ID = "apac.amazon.nova-micro-v1:0"

    def tearDown(self):
        server.BEDROCK_MODEL_ID = self.original_primary
        server.FALLBACK_BEDROCK_MODEL_ID = self.original_fallback

    def test_is_quota_throttling_detects_throttling_exception(self):
        error = throttling_error()
        self.assertTrue(server.is_quota_throttling(error))

    def test_is_quota_throttling_ignores_validation_errors(self):
        error = ClientError(
            {"Error": {"Code": "ValidationException", "Message": "bad model"}},
            "Converse",
        )
        self.assertFalse(server.is_quota_throttling(error))

    @patch("server.invoke_bedrock_model")
    def test_call_bedrock_uses_primary_model_when_available(self, mock_invoke):
        mock_invoke.return_value = "Hello from primary"

        result = server.call_bedrock([], "Hi")

        mock_invoke.assert_called_once_with(server.BEDROCK_MODEL_ID, unittest.mock.ANY)
        self.assertEqual(result.text, "Hello from primary")
        self.assertIsNone(result.notice)

    @patch("server.invoke_bedrock_model")
    def test_call_bedrock_falls_back_on_quota_throttling(self, mock_invoke):
        mock_invoke.side_effect = [
            throttling_error(),
            "Hello from fallback",
        ]

        result = server.call_bedrock([], "Hi")

        self.assertEqual(mock_invoke.call_count, 2)
        self.assertEqual(mock_invoke.call_args_list[0].args[0], server.BEDROCK_MODEL_ID)
        self.assertEqual(mock_invoke.call_args_list[1].args[0], server.FALLBACK_BEDROCK_MODEL_ID)
        self.assertEqual(result.text, "Hello from fallback")
        self.assertEqual(result.notice, server.MODEL_SWITCH_NOTICE)

    @patch("server.invoke_bedrock_model")
    def test_call_bedrock_returns_quota_message_when_both_models_throttled(self, mock_invoke):
        mock_invoke.side_effect = [throttling_error(), throttling_error()]

        with self.assertRaises(HTTPException) as ctx:
            server.call_bedrock([], "Hi")

        self.assertEqual(ctx.exception.status_code, 429)
        self.assertEqual(ctx.exception.detail, server.QUOTA_EXCEEDED_MESSAGE)

    @patch("server.invoke_bedrock_model")
    def test_call_bedrock_skips_fallback_when_models_match(self, mock_invoke):
        server.FALLBACK_BEDROCK_MODEL_ID = server.BEDROCK_MODEL_ID
        mock_invoke.side_effect = throttling_error()

        with self.assertRaises(HTTPException) as ctx:
            server.call_bedrock([], "Hi")

        mock_invoke.assert_called_once()
        self.assertEqual(ctx.exception.status_code, 429)
        self.assertEqual(ctx.exception.detail, server.QUOTA_EXCEEDED_MESSAGE)


if __name__ == "__main__":
    unittest.main()
