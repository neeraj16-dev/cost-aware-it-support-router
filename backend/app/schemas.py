from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "user"

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str

class TokenData(BaseModel):
    username: Optional[str] = None

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

class TicketStatusUpdate(BaseModel):
    status: str

class TicketReassign(BaseModel):
    corrected_queue: str

class TicketLogRead(BaseModel):
    id: int
    subject: str
    body: str
    engine: str
    assigned_queue: str
    confidence_score: float
    latency_ms: float
    llm_used: bool
    tokens_used: int
    cost_usd: float
    status: str
    created_at: datetime
    user_id: int | None = None
    is_reassigned: bool
    corrected_queue: Optional[str]

    model_config = {
        "from_attributes": True
    }

class PaginatedTickets(BaseModel):
    items: List[TicketLogRead]
    total:int