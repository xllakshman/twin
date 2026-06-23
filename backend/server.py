from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from dotenv import load_dotenv
from typing import Optional, List, Dict, Tuple, NamedTuple
import json
import uuid
import re
from datetime import datetime
import boto3
from botocore.exceptions import ClientError
from openai import OpenAI
from context import prompt, OPENAI_JSON_INSTRUCTION, name

# Load environment variables
load_dotenv()

app = FastAPI()

# Configure CORS
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Initialize Bedrock client - see Q42 on https://edwarddonner.com/faq if the Region gives you problems
bedrock_client = boto3.client(
    service_name="bedrock-runtime",
    region_name=os.getenv("DEFAULT_AWS_REGION", "us-east-1"),
)

# Model / provider configuration
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "bedrock")
BEDROCK_MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "apac.amazon.nova-lite-v1:0")
FALLBACK_BEDROCK_MODEL_ID = os.getenv("FALLBACK_BEDROCK_MODEL_ID", "apac.amazon.nova-lite-v1:0")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
QUOTA_EXCEEDED_MESSAGE = "Quota exceeded for the day, please try after sometime."
QUOTA_EXCEEDED_AFTER_FALLBACK_MESSAGE = (
    "Quota exceeded switching to another model available..! "
    "All models have reached their daily limit — please try again later."
)
MODEL_SWITCH_NOTICE = "Quota exceeded switching to another model available..!"

GREETING_RESPONSE_FALLBACK = (
    f"Hi! Thanks for visiting — I'm {name}'s digital twin. "
    "Feel free to ask about my career at Amazon, recent projects, or leadership experience."
)
DEFAULT_GREETING_QUESTIONS = [
    "What is your role at Amazon?",
    "Tell me about a recent project you led.",
    "What teams do you work with?",
]

_openai_client: Optional[OpenAI] = None

# Memory storage configuration
USE_S3 = os.getenv("USE_S3", "false").lower() == "true"
S3_BUCKET = os.getenv("S3_BUCKET", "")
MEMORY_DIR = os.getenv("MEMORY_DIR", "../memory")

# Initialize S3 client if needed
if USE_S3:
    s3_client = boto3.client("s3")


# Request/Response models
class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    session_id: str
    suggested_questions: List[str] = []
    notice: Optional[str] = None


class LLMResult(NamedTuple):
    text: str
    notice: Optional[str] = None
    suggested_questions: Optional[List[str]] = None


class Message(BaseModel):
    role: str
    content: str
    timestamp: str


def openai_fallback_enabled() -> bool:
    return LLM_PROVIDER == "bedrock_with_openai_fallback" and bool(OPENAI_API_KEY)


def openai_primary_enabled() -> bool:
    return LLM_PROVIDER == "openai_with_bedrock_fallback" and bool(OPENAI_API_KEY)


def get_openai_client() -> OpenAI:
    global _openai_client
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY is not configured")
    if _openai_client is None:
        _openai_client = OpenAI(api_key=OPENAI_API_KEY)
    return _openai_client


# Memory management functions
def get_memory_path(session_id: str) -> str:
    return f"{session_id}.json"


def load_conversation(session_id: str) -> List[Dict]:
    """Load conversation history from storage"""
    if USE_S3:
        try:
            response = s3_client.get_object(Bucket=S3_BUCKET, Key=get_memory_path(session_id))
            return json.loads(response["Body"].read().decode("utf-8"))
        except ClientError as e:
            if e.response["Error"]["Code"] == "NoSuchKey":
                return []
            raise
    else:
        file_path = os.path.join(MEMORY_DIR, get_memory_path(session_id))
        if os.path.exists(file_path):
            with open(file_path, "r") as f:
                return json.load(f)
        return []


def save_conversation(session_id: str, messages: List[Dict]):
    """Save conversation history to storage"""
    if USE_S3:
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=get_memory_path(session_id),
            Body=json.dumps(messages, indent=2),
            ContentType="application/json",
        )
    else:
        os.makedirs(MEMORY_DIR, exist_ok=True)
        file_path = os.path.join(MEMORY_DIR, get_memory_path(session_id))
        with open(file_path, "w") as f:
            json.dump(messages, f, indent=2)


SUGGESTIONS_PATTERN = re.compile(
    r"<SUGGESTED_QUESTIONS>\s*(.*?)\s*</SUGGESTED_QUESTIONS>",
    re.DOTALL | re.IGNORECASE,
)
TRAILING_QUESTION_LINE = re.compile(r"^[-•*]?\s*(.+?\?)\s*$")


def normalize_question_line(line: str) -> str:
    line = line.strip().lstrip("-•*").strip()
    line = re.sub(r"^(?:first|second|third)\s+follow-up\s+question:\s*", "", line, flags=re.IGNORECASE)
    line = re.sub(r"^\d+[.)]\s*", "", line)
    return line.strip()


def extract_suggested_questions(text: str) -> Tuple[str, List[str]]:
    """Strip the suggestions block from the reply and return clean text + questions."""
    match = SUGGESTIONS_PATTERN.search(text)
    if match:
        clean_response = SUGGESTIONS_PATTERN.sub("", text).strip()
        questions = []
        for line in match.group(1).splitlines():
            line = normalize_question_line(line)
            if line:
                questions.append(line)
        if questions:
            return clean_response, questions[:3]

    return extract_trailing_question_suggestions(text)


def extract_trailing_question_suggestions(text: str) -> Tuple[str, List[str]]:
    """Fallback: pick up trailing question lines when the model skips XML tags."""
    lines = text.splitlines()
    questions: List[str] = []
    cutoff = len(lines)

    for index in range(len(lines) - 1, -1, -1):
        line = lines[index].strip()
        if not line:
            if questions:
                cutoff = index
                break
            continue

        match = TRAILING_QUESTION_LINE.match(line)
        if match:
            question = normalize_question_line(match.group(1))
            if question:
                questions.insert(0, question)
                cutoff = index
                if len(questions) >= 3:
                    break
            continue

        if questions:
            break

    if not questions:
        return text.strip(), []

    clean_response = "\n".join(lines[:cutoff]).strip()
    return clean_response, questions[:3]


def is_quota_throttling(error: ClientError) -> bool:
    error_code = error.response.get("Error", {}).get("Code", "")
    if error_code == "ThrottlingException":
        return True
    message = error.response.get("Error", {}).get("Message", "").lower()
    return "too many tokens" in message or "throttl" in message


def build_bedrock_messages(conversation: List[Dict], user_message: str) -> List[Dict]:
    messages = []
    for msg in conversation[-50:]:
        messages.append({
            "role": msg["role"],
            "content": [{"text": msg["content"]}],
        })
    messages.append({
        "role": "user",
        "content": [{"text": user_message}],
    })
    return messages


def build_openai_messages(conversation: List[Dict], user_message: str) -> List[Dict]:
    system_prompt = prompt() + OPENAI_JSON_INSTRUCTION
    messages = [{"role": "system", "content": system_prompt}]
    for msg in conversation[-50:]:
        if msg["role"] in ("user", "assistant"):
            messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": user_message})
    return messages


def invoke_bedrock_model(model_id: str, messages: List[Dict]) -> str:
    response = bedrock_client.converse(
        modelId=model_id,
        messages=messages,
        system=[{"text": prompt()}],
        inferenceConfig={
            "maxTokens": 2000,
            "temperature": 0.7,
            "topP": 0.9,
        },
    )
    return response["output"]["message"]["content"][0]["text"]


def parse_openai_content(content: str) -> LLMResult:
    try:
        data = json.loads(content)
        if isinstance(data, dict):
            text = (
                data.get("response")
                or data.get("answer")
                or data.get("message")
                or data.get("reply")
                or ""
            )
            if "response" in data or "answer" in data or "message" in data or "reply" in data:
                questions = [
                    normalize_question_line(str(question))
                    for question in data.get("suggested_questions", [])
                    if str(question).strip()
                ]
                return LLMResult(
                    text=str(text).strip(),
                    suggested_questions=questions[:3],
                )
    except json.JSONDecodeError:
        pass

    clean_response, questions = extract_suggested_questions(content)
    return LLMResult(text=clean_response, suggested_questions=questions)


def ensure_nonempty_response(user_message: str, response: str, suggested_questions: List[str]) -> Tuple[str, List[str]]:
    if response.strip():
        return response, suggested_questions

    print(f"Empty LLM response for message: {user_message!r}; using greeting fallback")
    questions = suggested_questions or DEFAULT_GREETING_QUESTIONS[:3]
    return GREETING_RESPONSE_FALLBACK, questions


def invoke_openai(conversation: List[Dict], user_message: str) -> LLMResult:
    response = get_openai_client().chat.completions.create(
        model=OPENAI_MODEL,
        messages=build_openai_messages(conversation, user_message),
        max_tokens=2000,
        temperature=0.7,
        response_format={"type": "json_object"},
    )
    content = response.choices[0].message.content or ""
    return parse_openai_content(content)


def handle_bedrock_client_error(error: ClientError) -> None:
    error_code = error.response.get("Error", {}).get("Code", "")
    if error_code == "ValidationException":
        print(f"Bedrock validation error: {error}")
        raise HTTPException(status_code=400, detail=str(error))
    if error_code == "AccessDeniedException":
        print(f"Bedrock access denied: {error}")
        raise HTTPException(status_code=403, detail="Access denied to Bedrock model")
    if is_quota_throttling(error):
        raise HTTPException(status_code=429, detail=QUOTA_EXCEEDED_MESSAGE)
    print(f"Bedrock error: {error}")
    raise HTTPException(status_code=500, detail=f"Bedrock error: {str(error)}")


def try_openai_fallback(conversation: List[Dict], user_message: str) -> LLMResult:
    print(f"Bedrock throttled, falling back to OpenAI ({OPENAI_MODEL})")
    try:
        result = invoke_openai(conversation, user_message)
        return LLMResult(result.text, notice=MODEL_SWITCH_NOTICE, suggested_questions=result.suggested_questions)
    except Exception as error:
        print(f"OpenAI fallback failed: {error}")
        raise HTTPException(
            status_code=429,
            detail=QUOTA_EXCEEDED_AFTER_FALLBACK_MESSAGE,
        )


def try_bedrock_fallback(conversation: List[Dict], user_message: str, reason: str) -> LLMResult:
    print(f"{reason}, falling back to Bedrock ({BEDROCK_MODEL_ID})")
    messages = build_bedrock_messages(conversation, user_message)
    try:
        text = invoke_bedrock_model(BEDROCK_MODEL_ID, messages)
        clean_response, questions = extract_suggested_questions(text)
        return LLMResult(clean_response, notice=MODEL_SWITCH_NOTICE, suggested_questions=questions)
    except ClientError as primary_error:
        if not is_quota_throttling(primary_error):
            handle_bedrock_client_error(primary_error)

        if FALLBACK_BEDROCK_MODEL_ID and FALLBACK_BEDROCK_MODEL_ID != BEDROCK_MODEL_ID:
            return try_bedrock_model_fallback(messages)

        handle_bedrock_client_error(primary_error)


def try_bedrock_model_fallback(messages: List[Dict]) -> LLMResult:
    print(
        f"Primary model throttled ({BEDROCK_MODEL_ID}), "
        f"trying Bedrock fallback {FALLBACK_BEDROCK_MODEL_ID}"
    )
    try:
        text = invoke_bedrock_model(FALLBACK_BEDROCK_MODEL_ID, messages)
        clean_response, questions = extract_suggested_questions(text)
        return LLMResult(clean_response, notice=MODEL_SWITCH_NOTICE, suggested_questions=questions)
    except ClientError as fallback_error:
        if is_quota_throttling(fallback_error):
            raise HTTPException(
                status_code=429,
                detail=QUOTA_EXCEEDED_AFTER_FALLBACK_MESSAGE,
            )
        handle_bedrock_client_error(fallback_error)


def call_bedrock_llm(conversation: List[Dict], user_message: str) -> LLMResult:
    messages = build_bedrock_messages(conversation, user_message)
    try:
        text = invoke_bedrock_model(BEDROCK_MODEL_ID, messages)
        clean_response, questions = extract_suggested_questions(text)
        return LLMResult(clean_response, suggested_questions=questions)
    except ClientError as primary_error:
        if not is_quota_throttling(primary_error):
            handle_bedrock_client_error(primary_error)

        if openai_fallback_enabled():
            return try_openai_fallback(conversation, user_message)

        if (
            LLM_PROVIDER == "bedrock"
            and FALLBACK_BEDROCK_MODEL_ID
            and FALLBACK_BEDROCK_MODEL_ID != BEDROCK_MODEL_ID
        ):
            return try_bedrock_model_fallback(messages)

        handle_bedrock_client_error(primary_error)


def call_llm(conversation: List[Dict], user_message: str) -> LLMResult:
    """Generate a reply using the configured LLM provider and fallback rules."""
    if LLM_PROVIDER == "openai":
        return invoke_openai(conversation, user_message)

    if openai_primary_enabled():
        try:
            return invoke_openai(conversation, user_message)
        except Exception as error:
            print(f"OpenAI primary failed: {error}")
            return try_bedrock_fallback(conversation, user_message, "OpenAI unavailable")

    return call_bedrock_llm(conversation, user_message)


@app.get("/")
async def root():
    return {
        "message": "AI Digital Twin API",
        "memory_enabled": True,
        "storage": "S3" if USE_S3 else "local",
        "llm_provider": LLM_PROVIDER,
        "ai_model": OPENAI_MODEL if LLM_PROVIDER == "openai" else BEDROCK_MODEL_ID,
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "use_s3": USE_S3,
        "llm_provider": LLM_PROVIDER,
        "bedrock_model": BEDROCK_MODEL_ID,
        "openai_model": OPENAI_MODEL if OPENAI_API_KEY else None,
        "openai_fallback_enabled": openai_fallback_enabled(),
        "openai_primary_enabled": openai_primary_enabled(),
    }


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        session_id = request.session_id or str(uuid.uuid4())
        conversation = load_conversation(session_id)

        llm_result = call_llm(conversation, request.message)
        if llm_result.suggested_questions is not None:
            assistant_response = llm_result.text
            suggested_questions = llm_result.suggested_questions
        else:
            assistant_response, suggested_questions = extract_suggested_questions(llm_result.text)

        assistant_response, suggested_questions = ensure_nonempty_response(
            request.message,
            assistant_response,
            suggested_questions,
        )

        conversation.append(
            {"role": "user", "content": request.message, "timestamp": datetime.now().isoformat()}
        )
        conversation.append(
            {
                "role": "assistant",
                "content": assistant_response,
                "timestamp": datetime.now().isoformat(),
            }
        )

        save_conversation(session_id, conversation)

        return ChatResponse(
            response=assistant_response,
            session_id=session_id,
            suggested_questions=suggested_questions,
            notice=llm_result.notice,
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in chat endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/conversation/{session_id}")
async def get_conversation(session_id: str):
    """Retrieve conversation history"""
    try:
        conversation = load_conversation(session_id)
        return {"session_id": session_id, "messages": conversation}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
