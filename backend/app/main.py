from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, create_engine, func, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

from .ml import predict_health

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./inverter.db")
SECRET_KEY = os.getenv("SECRET_KEY", "dev-only-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_HOURS = int(os.getenv("ACCESS_TOKEN_HOURS", "24"))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))


class Device(Base):
    __tablename__ = "devices"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    location: Mapped[str] = mapped_column(String(200))
    capacity: Mapped[float] = mapped_column(Float)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)


class Telemetry(Base):
    __tablename__ = "telemetry"
    id: Mapped[int] = mapped_column(primary_key=True)
    device_id: Mapped[int] = mapped_column(ForeignKey("devices.id"), index=True)
    voltage: Mapped[float] = mapped_column(Float)
    current: Mapped[float] = mapped_column(Float)
    temperature: Mapped[float] = mapped_column(Float)
    battery: Mapped[float] = mapped_column(Float)
    frequency: Mapped[float] = mapped_column(Float)
    power: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)


class Fault(Base):
    __tablename__ = "faults"
    id: Mapped[int] = mapped_column(primary_key=True)
    device_id: Mapped[int] = mapped_column(ForeignKey("devices.id"), index=True)
    message: Mapped[str] = mapped_column(String(255))
    severity: Mapped[str] = mapped_column(String(30))
    source: Mapped[str] = mapped_column(String(30), default="rule")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)


Base.metadata.create_all(engine)


class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class DeviceIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    location: str = Field(min_length=1, max_length=200)
    capacity: float = Field(gt=0, le=10000)


class TelemetryIn(BaseModel):
    device_id: int = Field(gt=0)
    voltage: float = Field(gt=0, le=1000)
    current: float = Field(ge=0, le=1000)
    temperature: float = Field(ge=-40, le=200)
    battery: float = Field(ge=0, le=100)
    frequency: float = Field(gt=0, le=100)
    power: Optional[float] = Field(default=None, ge=0, le=10000)


app = FastAPI(title="Inverter Sentinel API", version="3.0.0", description="Smart inverter monitoring and predictive-maintenance demo API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[x.strip() for x in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if x.strip()],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)


def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def token_for(user: User) -> str:
    payload = {"sub": str(user.id), "exp": datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_HOURS)}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(db_session)) -> User:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def device_owned(device_id: int, user: User, db: Session) -> Device:
    device = db.get(Device, device_id)
    if not device or device.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Device not found")
    return device


def detect_rule_faults(data: TelemetryIn):
    faults = []
    if data.voltage > 250:
        faults.append(("Over-voltage detected", "critical"))
    elif data.voltage < 180:
        faults.append(("Under-voltage detected", "critical"))
    if data.temperature > 60:
        faults.append(("Overheating: inspect cooling system", "critical"))
    elif data.temperature > 55:
        faults.append(("High temperature: inspect cooling system", "warning"))
    if data.battery < 20:
        faults.append(("Battery level is low", "warning"))
    if not 48 <= data.frequency <= 52:
        faults.append(("Frequency is outside the normal 48-52 Hz range", "warning"))
    return faults


@app.get("/health")
def health():
    return {"status": "healthy", "service": "inverter-sentinel", "version": "3.0.0"}


@app.post("/api/auth/register")
def register(data: RegisterIn, db: Session = Depends(db_session)):
    email = str(data.email).lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(409, "Email already registered")
    user = User(name=data.name.strip(), email=email, password_hash=pwd_context.hash(data.password))
    db.add(user); db.commit(); db.refresh(user)
    return {"access_token": token_for(user), "token_type": "bearer", "user": {"id": user.id, "name": user.name, "email": user.email}}


@app.post("/api/auth/login")
def login(data: LoginIn, db: Session = Depends(db_session)):
    user = db.scalar(select(User).where(User.email == str(data.email).lower()))
    if not user or not pwd_context.verify(data.password, user.password_hash):
        raise HTTPException(401, "Incorrect email or password")
    return {"access_token": token_for(user), "token_type": "bearer", "user": {"id": user.id, "name": user.name, "email": user.email}}


@app.get("/api/me")
def me(user: User = Depends(current_user)):
    return {"id": user.id, "name": user.name, "email": user.email}


@app.get("/api/devices")
def list_devices(user: User = Depends(current_user), db: Session = Depends(db_session)):
    devices = db.scalars(select(Device).where(Device.owner_id == user.id).order_by(Device.id)).all()
    result = []
    for d in devices:
        latest = db.scalar(select(Telemetry).where(Telemetry.device_id == d.id).order_by(Telemetry.created_at.desc()).limit(1))
        result.append({"id": d.id, "name": d.name, "location": d.location, "capacity": d.capacity,
                       "latest_at": latest.created_at if latest else None})
    return result


@app.post("/api/devices", status_code=status.HTTP_201_CREATED)
def create_device(data: DeviceIn, user: User = Depends(current_user), db: Session = Depends(db_session)):
    device = Device(**data.model_dump(), owner_id=user.id)
    db.add(device); db.commit(); db.refresh(device)
    return device


@app.delete("/api/devices/{device_id}", status_code=204)
def delete_device(device_id: int, user: User = Depends(current_user), db: Session = Depends(db_session)):
    device = device_owned(device_id, user, db)
    db.query(Fault).filter(Fault.device_id == device.id).delete()
    db.query(Telemetry).filter(Telemetry.device_id == device.id).delete()
    db.delete(device); db.commit()


@app.post("/api/telemetry", status_code=status.HTTP_201_CREATED)
def ingest(data: TelemetryIn, user: User = Depends(current_user), db: Session = Depends(db_session)):
    device_owned(data.device_id, user, db)
    power = data.power if data.power is not None else round(data.voltage * data.current / 1000, 3)
    reading = Telemetry(**data.model_dump(exclude={"power"}), power=power)
    db.add(reading)
    faults = detect_rule_faults(data)
    for message, severity in faults:
        db.add(Fault(device_id=data.device_id, message=message, severity=severity, source="rule"))
    db.commit(); db.refresh(reading)
    return {"reading": reading, "faults_created": len(faults)}


@app.get("/api/dashboard/{device_id}")
def dashboard(device_id: int, user: User = Depends(current_user), db: Session = Depends(db_session)):
    device = device_owned(device_id, user, db)
    readings = db.scalars(select(Telemetry).where(Telemetry.device_id == device_id).order_by(Telemetry.created_at.desc()).limit(100)).all()
    faults = db.scalars(select(Fault).where(Fault.device_id == device_id).order_by(Fault.created_at.desc()).limit(20)).all()
    prediction = predict_health(readings)
    return {"device": device, "latest": readings[0] if readings else None, "readings": list(reversed(readings)), "faults": faults, "prediction": prediction}


@app.get("/api/summary")
def summary(user: User = Depends(current_user), db: Session = Depends(db_session)):
    devices = db.scalars(select(Device).where(Device.owner_id == user.id)).all()
    critical = db.scalar(select(func.count(Fault.id)).join(Device).where(Device.owner_id == user.id, Fault.severity == "critical")) or 0
    warning = db.scalar(select(func.count(Fault.id)).join(Device).where(Device.owner_id == user.id, Fault.severity == "warning")) or 0
    return {"devices": len(devices), "critical_alerts": critical, "warning_alerts": warning}


@app.get("/api/faults")
def list_faults(user: User = Depends(current_user), db: Session = Depends(db_session)):
    return db.scalars(select(Fault).join(Device).where(Device.owner_id == user.id).order_by(Fault.created_at.desc()).limit(100)).all()
