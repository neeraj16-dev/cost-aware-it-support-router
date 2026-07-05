from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select


from backend.app.schemas import TicketRequest, RoutingResponse
from backend.app.dependencies import get_model_manager, get_current_user
from backend.app.services.predictor import predict_ticket
from backend.app.db.database import get_session
from backend.app.db.models import TicketLog, User
import traceback

router = APIRouter()

@router.post(
    "/api/v1/tickets/route",
    response_model=RoutingResponse
)
async def route_ticket(
    ticket: TicketRequest,
    manager = Depends(get_model_manager),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    try:
        result = predict_ticket(
            ticket.subject,
            ticket.body,
            manager
        )
    
        log_entry = TicketLog(
            subject=ticket.subject,
            body=ticket.body,
            engine=result["routing"]["engine"],
            assigned_queue=result["routing"]["queue"],
            confidence_score=result["routing"]["confidence"],
            latency_ms=result["metrics"]["latency_ms"],
            llm_used=result["metrics"]["llm_used"],
            tokens_used=result["metrics"]["tokens_used"],
            cost_usd=result["metrics"]["cost_usd"],
            user_id=current_user.id
        )

        db.add(log_entry)
        db.commit()
        db.refresh(log_entry)

        return result
    
    except Exception as e:
        db.rollback()
        # --- NEW VISUAL ALARMS ---
        print("\n" + "!!!" * 15)
        print("CRITICAL ERROR IN ROUTE_TICKET:")
        traceback.print_exc()  # This prints the EXACT line number that crashed
        print("!!!" * 15 + "\n")
        # --------------------------
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    

@router.get("/api/v1/tickets/logs")
def get_ticket_logs(db: Session = Depends(get_session)):
    """Fetch all ticket routing logs from the database."""
    # Select all rows from the TicketLog table
    statement = select(TicketLog).order_by(TicketLog.created_at.desc())
    logs = db.exec(statement).all()
    return logs

@router.get("/")
def root():
    return {
        "message": "Cost-Aware IT Support Router is running!"
    }

