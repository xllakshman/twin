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
from context import prompt

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
    region_name=os.getenv("DEFAULT_AWS_REGION", "us-east-1")
)

# Bedrock model selection - see Q42 on https://edwarddonner.com/faq for more
BEDROCK_MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "apac.amazon.nova-lite-v1:0")
FALLBACK_BEDROCK_MODEL_ID = os.getenv("FALLBACK_BEDROCK_MODEL_ID", "apac.amazon.nova-lite-v1:0")
QUOTA_EXCEEDED_MESSAGE = "Quota exceeded for the day, please try after sometime."
QUOTA_EXCEEDED_AFTER_FALLBACK_MESSAGE = (
    "Quota exceeded switching to another model available..! "
    "All models have reached their daily limit — please try again later."
)
MODEL_SWITCH_NOTICE = "Quota exceeded switching to another model available..!"

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


class BedrockResult(NamedTuple):
    text: str
    notice: Optional[str] = None


class Message(BaseModel):
    role: str
    content: str
    timestamp: str


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
        # Local file storage
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
        # Local file storage
        os.makedirs(MEMORY_DIR, exist_ok=True)
        file_path = os.path.join(MEMORY_DIR, get_memory_path(session_id))
        with open(file_path, "w") as f:
            json.dump(messages, f, indent=2)


SUGGESTIONS_PATTERN = re.compile(
    r"<SUGGESTED_QUESTIONS>\s*(.*?)\s*</SUGGESTED_QUESTIONS>",
    re.DOTALL | re.IGNORECASE,
)


def extract_suggested_questions(text: str) -> Tuple[str, List[str]]:
    """Strip the suggestions block from the reply and return clean text + questions."""
    match = SUGGESTIONS_PATTERN.search(text)
    if not match:
        return text.strip(), []

    clean_response = SUGGESTIONS_PATTERN.sub("", text).strip()
    questions = []
    for line in match.group(1).splitlines():
        line = line.strip().lstrip("-•").strip()
        line = re.sub(r"^(?:first|second|third)\s+follow-up\s+question:\s*", "", line, flags=re.IGNORECASE)
        line = re.sub(r"^\d+[.)]\s*", "", line)
        if line:
            questions.append(line)
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


def call_bedrock(conversation: List[Dict], user_message: str) -> BedrockResult:
    """Call AWS Bedrock with conversation history, falling back on quota throttling."""
    messages = build_bedrock_messages(conversation, user_message)

    try:
        return BedrockResult(invoke_bedrock_model(BEDROCK_MODEL_ID, messages))
    except ClientError as primary_error:
        can_fallback = (
            is_quota_throttling(primary_error)
            and FALLBACK_BEDROCK_MODEL_ID
            and FALLBACK_BEDROCK_MODEL_ID != BEDROCK_MODEL_ID
        )
        if not can_fallback:
            handle_bedrock_client_error(primary_error)

        print(
            f"Primary model throttled ({BEDROCK_MODEL_ID}), "
            f"trying fallback {FALLBACK_BEDROCK_MODEL_ID}"
        )
        try:
            return BedrockResult(
                invoke_bedrock_model(FALLBACK_BEDROCK_MODEL_ID, messages),
                notice=MODEL_SWITCH_NOTICE,
            )
        except ClientError as fallback_error:
            if is_quota_throttling(fallback_error):
                raise HTTPException(
                    status_code=429,
                    detail=QUOTA_EXCEEDED_AFTER_FALLBACK_MESSAGE,
                )
            handle_bedrock_client_error(fallback_error)


@app.get("/")
async def root():
    return {
        "message": "AI Digital Twin API (Powered by AWS Bedrock)",
        "memory_enabled": True,
        "storage": "S3" if USE_S3 else "local",
        "ai_model": BEDROCK_MODEL_ID
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy", 
        "use_s3": USE_S3,
        "bedrock_model": BEDROCK_MODEL_ID
    }


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        # Generate session ID if not provided
        session_id = request.session_id or str(uuid.uuid4())

        # Load conversation history
        conversation = load_conversation(session_id)

        # Call Bedrock for response
        bedrock_result = call_bedrock(conversation, request.message)
        assistant_response, suggested_questions = extract_suggested_questions(bedrock_result.text)

        # Update conversation history
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

        # Save conversation
        save_conversation(session_id, conversation)

        return ChatResponse(
            response=assistant_response,
            session_id=session_id,
            suggested_questions=suggested_questions,
            notice=bedrock_result.notice,
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