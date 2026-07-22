from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select

from backend.app.db.database import get_session
from backend.app.db.models import User
from backend.app.schemas import UserCreate, Token
from backend.app.auth import get_password_hash, verify_password, create_access_token
from backend.app.dependencies import get_current_user

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])

@router.post("/register", response_model=Token)
def register(user: UserCreate, session: Session = Depends(get_session)):
    existing_user = session.exec(select(User).where(User.username == user.username)).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_pw = get_password_hash(user.password)

    new_user = User(username=user.username, hashed_password=hashed_pw, role="user")
    session.add(new_user)
    session.commit()
    session.refresh(new_user)

    access_token = create_access_token(data={"sub": new_user.username})
    
    return {
        "access_token": access_token,
        "token_type": "bearer"
    }

@router.post("/admin/register")
def admin_register(
    user: UserCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    print(f"--- ADMIN REGISTRATION ATTEMPT ---")
    print(f"Admin requesting: {current_user.username}")
    print(f"Payload received -> Username: {user.username}, Role: {user.role}")

    if current_user.role != "admin":
        print("FAIL: User is not an admin.")
        raise HTTPException(status_code=403, detail="Only admins can register department agents.")
    
    # ADDED .first() to properly evaluate the database result!
    existing_user = session.exec(select(User).where(User.username == user.username)).first()
    
    if existing_user:
        print(f"FAIL: {user.username} already exists in database.")
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_pw = get_password_hash(user.password)

    new_user = User(username=user.username, hashed_password=hashed_pw, role=user.role)
    session.add(new_user)
    session.commit()

    print(f"SUCCESS: Agent {user.username} created successfully!")
    print(f"----------------------------------")

    return {
        "message": f"Successfully created {user.role} agent: {user.username}"
    }

@router.get("/users")
def get_all_users(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view the user list.")
    
    users = session.exec(select(User)).all()
    
    # Return user objects without exposing hashed_password
    return [
        {"id": u.id, "username": u.username, "role": u.role} 
        for u in users
    ]

@router.post("/token", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.username == form_data.username)).first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect Username or Password")
    
    access_token = create_access_token(data={"sub": user.username})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role
    }