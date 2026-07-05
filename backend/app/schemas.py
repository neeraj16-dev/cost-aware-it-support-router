from pydantic import BaseModel
from typing import Optional

class UserCreate(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[int] = None

class TicketRequest(BaseModel):
    subject: str
    body: str

class RoutingInfo(BaseModel):
    engine: str
    queue: str
    confidence: float

class Metrics(BaseModel):
    latency_ms: float
    llm_used: bool
    cost_usd: float
    tokens_used: int

class RoutingResponse(BaseModel):
    routing: RoutingInfo
    metrics: Metrics