from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlmodel import Session, select, func


from backend.app.schemas import TicketRequest, RoutingResponse, TicketStatusUpdate, PaginatedTickets, TicketReassign
from backend.app.dependencies import get_model_manager, get_current_user
from backend.app.services.predictor import predict_ticket
from backend.app.db.database import get_session
from backend.app.db.models import TicketLog, User
from backend.app.services.retrainer import run_active_learning_pipeline
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
    

@router.get("/api/v1/tickets/logs", response_model=PaginatedTickets)
def get_ticket_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == "admin":
        base_query = select(TicketLog)
    elif current_user.role == "user":
        base_query = select(TicketLog).where(TicketLog.user_id == current_user.id)
    else:
        base_query = select(TicketLog).where(TicketLog.assigned_queue == current_user.role)

    count_statement = select(func.count()).select_from(base_query.subquery())
    statement = base_query.order_by(TicketLog.created_at.desc()).offset(skip).limit(limit)

    total_count = db.exec(count_statement).one()
    logs = db.exec(statement).all()
    return {
        "items": logs,
        "total": total_count
    }

@router.patch("/api/v1/tickets/{ticket_id}/status")
def update_ticket_status(
    ticket_id: int,
    status_update: TicketStatusUpdate,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == "user":
        raise HTTPException(status_code=403, detail="Not authorized to resolve tickets")
    
    ticket = db.get(TicketLog, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    ticket.status = status_update.status
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    return ticket

@router.patch("/api/v1/tickets/{ticket_id}/reassign")
def reassign_ticket(
    ticket_id: int,
    reassign_data: TicketReassign,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == "user":
        raise HTTPException(status_code=403, detail="Not authorized to reassign tickets")
    
    ticket = db.get(TicketLog, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    ticket.is_reassigned = True
    ticket.corrected_queue = reassign_data.corrected_queue
    ticket.status = "resolved"

    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket

@router.post("/api/v1/admin/retrain")
def trigger_retraining(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    manager = Depends(get_model_manager) # <-- ADD THIS
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can trigger model retraining.")
        
    # Pass the manager to the background task!
    background_tasks.add_task(run_active_learning_pipeline, manager)
    
    return {"message": "Active Learning retraining pipeline has been initiated in the background."}

@router.get("/")
def root():
    return {
        "message": "Cost-Aware IT Support Router is running!"
    }

