from datetime import datetime, UTC
from typing import Optional
from sqlmodel import Field, SQLModel

class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    hashed_password: str
    role: str = Field(default="user")

class TicketLog(SQLModel, table=True):
    __tablename__ = "ticket_logs"

    id: Optional[int] = Field(default=None, primary_key=True)
    subject: str
    body: str
    engine: str         
    assigned_queue: str  
    confidence_score: float
    latency_ms: float
    llm_used: bool
    tokens_used: int
    cost_usd: float
    status: str = Field(default="open")
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    user_id: Optional[int] = Field(default=None, foreign_key="users.id")
    is_reassigned: bool = Field(default=False)
    corrected_queue: Optional[str] = Field(default=None)