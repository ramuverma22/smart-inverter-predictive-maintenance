"""Create a demo account and one inverter. Run from backend: python -m app.seed_demo"""
from .main import SessionLocal, User, Device, pwd_context

EMAIL = "demo@example.com"
PASSWORD = "demo1234"

def main():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == EMAIL).first()
        if not user:
            user = User(name="Demo User", email=EMAIL, password_hash=pwd_context.hash(PASSWORD))
            db.add(user); db.commit(); db.refresh(user)
        device = db.query(Device).filter(Device.owner_id == user.id).first()
        if not device:
            device = Device(name="Campus Inverter 01", location="IIT Kanpur", capacity=5.0, owner_id=user.id)
            db.add(device); db.commit(); db.refresh(device)
        print(f"Demo login: {EMAIL} / {PASSWORD}")
        print(f"Device ID: {device.id}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
