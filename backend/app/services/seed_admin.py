from sqlmodel import Session, select
from backend.app.db.database import engine
from backend.app.db.models import User
from backend.app.auth import get_password_hash

with Session(engine) as session:
    admin = session.exec(
        select(User).where(User.username == "admin")
    ).first()

    if not admin:
        session.add(
            User(
                username = "admin",
                hashed_password=get_password_hash("admin123"),
                role="admin"
            )
        )
        
        session.commit()
        print("Admin created")

    else:
        print("Admin already exists")