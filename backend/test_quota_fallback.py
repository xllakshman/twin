import json
import unittest
from unittest.mock import patch

from botocore.exceptions import ClientError
from fastapi import HTTPException

import server


def throttling_error(message: str = "Too many tokens per day, please wait before trying again."):
    return ClientError(
        {"Error": {"Code": "ThrottlingException", "Message": message}},
        "Converse",
    )


class LLMFallbackTests(unittest.TestCase):
    def setUp(self):
        self.original_provider = server.LLM_PROVIDER
        self.original_primary = server.BEDROCK_MODEL_ID
        self.original_fallback = server.FALLBACK_BEDROCK_MODEL_ID
        self.original_openai_key = server.OPENAI_API_KEY
        server.LLM_PROVIDER = "bedrock"
        server.BEDROCK_MODEL_ID = "apac.amazon.nova-lite-v1:0"
        server.FALLBACK_BEDROCK_MODEL_ID = "apac.amazon.nova-micro-v1:0"
        server.OPENAI_API_KEY = ""

    def tearDown(self):
        server.LLM_PROVIDER = self.original_provider
        server.BEDROCK_MODEL_ID = self.original_primary
        server.FALLBACK_BEDROCK_MODEL_ID = self.original_fallback
        server.OPENAI_API_KEY = self.original_openai_key
        server._openai_client = None

    def test_is_quota_throttling_detects_throttling_exception(self):
        self.assertTrue(server.is_quota_throttling(throttling_error()))

    def test_is_quota_throttling_ignores_validation_errors(self):
        error = ClientError(
            {"Error": {"Code": "ValidationException", "Message": "bad model"}},
            "Converse",
        )
        self.assertFalse(server.is_quota_throttling(error))

    @patch("server.invoke_bedrock_model")
    def test_call_llm_uses_primary_model_when_available(self, mock_invoke):
        mock_invoke.return_value = "Hello from primary"

        result = server.call_llm([], "Hi")

        mock_invoke.assert_called_once_with(server.BEDROCK_MODEL_ID, unittest.mock.ANY)
        self.assertEqual(result.text, "Hello from primary")
        self.assertIsNone(result.notice)

    @patch("server.invoke_bedrock_model")
    def test_call_llm_falls_back_to_second_bedrock_model(self, mock_invoke):
        mock_invoke.side_effect = [throttling_error(), "Hello from fallback"]

        result = server.call_llm([], "Hi")

        self.assertEqual(mock_invoke.call_count, 2)
        self.assertEqual(result.text, "Hello from fallback")
        self.assertEqual(result.notice, server.MODEL_SWITCH_NOTICE)

    @patch("server.invoke_openai")
    @patch("server.invoke_bedrock_model")
    def test_call_llm_falls_back_to_openai_on_dev(self, mock_bedrock, mock_openai):
        server.LLM_PROVIDER = "bedrock_with_openai_fallback"
        server.OPENAI_API_KEY = "test-key"
        mock_bedrock.side_effect = throttling_error()
        mock_openai.return_value = server.LLMResult("Hello from OpenAI", suggested_questions=["Q1"])

        result = server.call_llm([], "Hi")

        mock_bedrock.assert_called_once()
        mock_openai.assert_called_once()
        self.assertEqual(result.text, "Hello from OpenAI")
        self.assertEqual(result.notice, server.MODEL_SWITCH_NOTICE)

    @patch("server.invoke_openai")
    @patch("server.invoke_bedrock_model")
    def test_call_llm_returns_quota_message_when_openai_fallback_fails(self, mock_bedrock, mock_openai):
        server.LLM_PROVIDER = "bedrock_with_openai_fallback"
        server.OPENAI_API_KEY = "test-key"
        mock_bedrock.side_effect = throttling_error()
        mock_openai.side_effect = Exception("OpenAI unavailable")

        with self.assertRaises(HTTPException) as ctx:
            server.call_llm([], "Hi")

        self.assertEqual(ctx.exception.status_code, 429)
        self.assertEqual(ctx.exception.detail, server.QUOTA_EXCEEDED_AFTER_FALLBACK_MESSAGE)

    @patch("server.invoke_bedrock_model")
    def test_call_llm_skips_bedrock_fallback_when_models_match(self, mock_invoke):
        server.FALLBACK_BEDROCK_MODEL_ID = server.BEDROCK_MODEL_ID
        mock_invoke.side_effect = throttling_error()

        with self.assertRaises(HTTPException) as ctx:
            server.call_llm([], "Hi")

        mock_invoke.assert_called_once()
        self.assertEqual(ctx.exception.status_code, 429)
        self.assertEqual(ctx.exception.detail, server.QUOTA_EXCEEDED_MESSAGE)

    @patch("server.invoke_bedrock_model")
    @patch("server.invoke_openai")
    def test_call_llm_uses_openai_first_on_dev(self, mock_openai, mock_bedrock):
        server.LLM_PROVIDER = "openai_with_bedrock_fallback"
        server.OPENAI_API_KEY = "test-key"
        mock_openai.return_value = server.LLMResult(
            "Hello from OpenAI",
            suggested_questions=["What teams do you work with?"],
        )

        result = server.call_llm([], "Tell me about your role")

        mock_openai.assert_called_once()
        mock_bedrock.assert_not_called()
        self.assertEqual(result.text, "Hello from OpenAI")
        self.assertEqual(result.suggested_questions, ["What teams do you work with?"])
        self.assertIsNone(result.notice)

    @patch("server.invoke_bedrock_model")
    @patch("server.invoke_openai")
    def test_call_llm_falls_back_to_bedrock_when_openai_fails(self, mock_openai, mock_bedrock):
        server.LLM_PROVIDER = "openai_with_bedrock_fallback"
        server.OPENAI_API_KEY = "test-key"
        mock_openai.side_effect = Exception("OpenAI unavailable")
        mock_bedrock.return_value = (
            "Hello from Bedrock\n\n<SUGGESTED_QUESTIONS>\nWhat is your background?\n</SUGGESTED_QUESTIONS>"
        )

        result = server.call_llm([], "Tell me about your role")

        mock_openai.assert_called_once()
        mock_bedrock.assert_called_once()
        self.assertEqual(result.text, "Hello from Bedrock")
        self.assertEqual(result.suggested_questions, ["What is your background?"])
        self.assertEqual(result.notice, server.MODEL_SWITCH_NOTICE)


class SuggestionExtractionTests(unittest.TestCase):
    def test_extract_suggested_questions_from_xml_block(self):
        text = (
            "Here is my answer.\n\n"
            "<SUGGESTED_QUESTIONS>\n"
            "What teams do you work with?\n"
            "Tell me about a recent project.\n"
            "</SUGGESTED_QUESTIONS>"
        )
        clean, questions = server.extract_suggested_questions(text)
        self.assertEqual(clean, "Here is my answer.")
        self.assertEqual(
            questions,
            ["What teams do you work with?", "Tell me about a recent project."],
        )

    def test_extract_trailing_question_suggestions(self):
        text = (
            "Here is my answer.\n\n"
            "What teams do you work with?\n"
            "Tell me about a recent project?"
        )
        clean, questions = server.extract_suggested_questions(text)
        self.assertEqual(clean, "Here is my answer.")
        self.assertEqual(
            questions,
            ["What teams do you work with?", "Tell me about a recent project?"],
        )

    def test_parse_openai_content_json(self):
        payload = json.dumps(
            {
                "response": "Here is my answer.",
                "suggested_questions": [
                    "What teams do you work with?",
                    "Tell me about a recent project?",
                ],
            }
        )
        result = server.parse_openai_content(payload)
        self.assertEqual(result.text, "Here is my answer.")
        self.assertEqual(
            result.suggested_questions,
            ["What teams do you work with?", "Tell me about a recent project?"],
        )


if __name__ == "__main__":
    unittest.main()
