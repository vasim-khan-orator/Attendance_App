from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text as sql_text
from pydantic import BaseModel
import schemas, crud
import config
from database import SessionLocal, engine
from models import Base, Teacher, StudentAuth, QRCode, AttendanceSession, Member
from datetime import datetime, date
import uuid  # ✅ Added import for UUID generation
from models_download import ensure_models as ensure_face_models

Base.metadata.create_all(bind=engine)

app = FastAPI()


def run_compat_migrations(db: Session):
    # SQLite create_all does not add missing columns on existing tables.
    attendance_cols = {
        row[1]
        for row in db.execute(sql_text("PRAGMA table_info(attendance)")).fetchall()
    }
    if "session_id" not in attendance_cols:
        db.execute(sql_text("ALTER TABLE attendance ADD COLUMN session_id INTEGER"))
        db.commit()


def ensure_schema_compatibility():
    db = SessionLocal()
    try:
        run_compat_migrations(db)
    finally:
        db.close()


# Ensure migrations also run for non-server execution paths (e.g. tests/import usage).
ensure_schema_compatibility()


def build_error_response(
    request: Request,
    code: str,
    message: str,
    details=None,
):
    return {
        "success": False,
        "error": {
            "code": code,
            "message": message,
            "details": details,
        },
        # Backward compatibility for existing frontend handlers.
        "detail": message,
        "path": request.url.path,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    if isinstance(exc.detail, dict):
        message = exc.detail.get("message") or exc.detail.get("detail") or "Request failed"
        details = exc.detail
    else:
        message = str(exc.detail)
        details = None

    return JSONResponse(
        status_code=exc.status_code,
        content=build_error_response(
            request=request,
            code=f"HTTP_{exc.status_code}",
            message=message,
            details=details,
        ),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content=build_error_response(
            request=request,
            code="VALIDATION_ERROR",
            message="Validation failed",
            details=exc.errors(),
        ),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content=build_error_response(
            request=request,
            code="INTERNAL_SERVER_ERROR",
            message="Internal server error",
            details={"type": type(exc).__name__},
        ),
    )

# ✅ Enable CORS for specific origins (Vite development server)
origins = config.CORS_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=config.CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ ADD THIS: Startup event to create default teacher
@app.on_event("startup")
def startup_event():
    db = SessionLocal()
    try:
        # Ensure default teacher exists
        crud.ensure_default_teacher(db)
        run_compat_migrations(db)
        # Download face detection models if missing
        ensure_face_models()
        print("✅ Startup: Default teacher initialized, face models ready")
    except Exception as e:
        print(f"⚠️ Startup error: {e}")
    finally:
        db.close()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/")
def root():
    return {"status": "API running"}


# Debug endpoint to check teacher credentials
@app.get("/debug/teacher")
def debug_teacher(db: Session = Depends(get_db)):
    teacher = db.query(Teacher).filter(Teacher.username == "admin").first()
    if teacher:
        return {"username": teacher.username, "password": teacher.password}
    return {"error": "No admin teacher found"}


# Debug endpoint to check student password
@app.get("/debug/student/{roll_no}")
def debug_student(roll_no: str, db: Session = Depends(get_db)):
    auth = db.query(StudentAuth).filter(StudentAuth.roll_no == roll_no).first()
    if not auth:
        return {
            "roll_no": roll_no,
            "password": "DEFAULT (roll_no)"
        }
    return {
        "roll_no": auth.roll_no,
        "password": auth.password
    }


# Debug endpoint to check QR records
@app.get("/debug/qr")
def debug_qr(db: Session = Depends(get_db)):
    records = db.query(QRCode).all()
    return [
        {
            "code": r.code,
            "roll_no": r.created_for,
            "created_at": r.created_at,
        }
        for r in records
    ]


@app.post("/members", response_model=schemas.MemberOut)
def add_member(member: schemas.MemberCreate, db: Session = Depends(get_db)):
    return crud.create_member(db, member)


@app.get("/members", response_model=list[schemas.MemberOut])
def list_members(db: Session = Depends(get_db)):
    return crud.get_members(db)


@app.delete("/members/{roll_no}")
def remove_member(roll_no: str, db: Session = Depends(get_db)):
    crud.delete_member(db, roll_no)
    return {"deleted": True}


@app.post("/attendance", response_model=schemas.AttendanceOut)
def add_attendance(att: schemas.AttendanceCreate, db: Session = Depends(get_db)):
    return crud.create_attendance(db, att)


@app.get("/attendance", response_model=list[schemas.AttendanceOut])
def list_attendance(db: Session = Depends(get_db)):
    return crud.get_attendance(db)


# ✅ UPDATED — Get attendance by date (string format) with AttendanceHistoryResponse
@app.get(
    "/attendance/by-date/{session_date}",
    response_model=list[schemas.AttendanceHistoryResponse]
)
def fetch_attendance_by_date(session_date: str, db: Session = Depends(get_db)):
    return crud.get_attendance_by_date(db, session_date)


# ✅ NEW — Get attendance by date using date object
@app.get(
    "/attendance/by-date-object/{date_value}",
    response_model=list[schemas.AttendanceHistoryResponse]
)
def attendance_by_date_object(date_value: date, db: Session = Depends(get_db)):
    return crud.get_attendance_by_date(db, date_value)


# ✅ UPDATED — Get all unique attendance dates
@app.get("/attendance/dates", response_model=list[str])
def list_attendance_dates(db: Session = Depends(get_db)):
    return crud.get_attendance_dates(db)


# ---------- NEW QR API ----------

@app.post("/qr", response_model=schemas.QRCodeOut)
def save_qr(qr: schemas.QRCodeCreate, db: Session = Depends(get_db)):
    return crud.create_qr(db, qr)


@app.get("/qr/latest", response_model=schemas.QRCodeOut | None)
def latest_qr(db: Session = Depends(get_db)):
    return crud.get_latest_qr(db)


# ---------- QR GRANT ACCESS ENDPOINT ----------
@app.post("/qr/grant-access")
def grant_qr_access(data: dict, db: Session = Depends(get_db)):
    roll = data["roll_no"]

    # 1) Ensure member exists
    member = db.query(Member).filter_by(roll_no=roll).first()
    if not member:
        raise HTTPException(404, f"Member with roll {roll} not found")

    # 2) Ensure StudentAuth exists (auto-create if missing)
    auth = db.query(StudentAuth).filter_by(roll_no=roll).first()
    if not auth:
        auth = StudentAuth(roll_no=roll, password=roll)
        db.add(auth)
        db.commit()
        db.refresh(auth)

    # 3) Generate unique QR token for this student
    unique_code = f"ALLOWED-{roll}-{uuid.uuid4().hex[:6]}"

    qr = QRCode(
        code=unique_code,
        created_for=roll,
        created_at=datetime.now().isoformat()
    )

    db.add(qr)
    db.commit()
    db.refresh(qr)

    return {
        "success": True,
        "roll_no": roll,
        "code": unique_code,
        "message": "QR access granted with unique token"
    }


# ---------- QR CHECK ACCESS ENDPOINT ----------
@app.get("/qr/check-access/{roll_no}")
def check_qr_access(roll_no: str, db: Session = Depends(get_db)):
    qr = (
        db.query(QRCode)
        .filter(QRCode.created_for == roll_no)
        .order_by(QRCode.created_at.desc())
        .first()
    )

    if not qr:
        return {"allowed": False}

    # here "ALLOWED" represents permission granted
    return {
        "allowed": qr.code.startswith("ALLOWED"),  # ✅ Updated to check prefix
        "roll_no": roll_no,
        "timestamp": qr.created_at,
        "code": qr.code  # ✅ Include the code in response
    }


# ---------- ATTENDANCE SESSION API ----------

# Pydantic model for session response
class SessionResponse(BaseModel):
    id: int
    session_date: date
    is_active: bool
    started_at: datetime | None = None
    ended_at: datetime | None = None
    total_present: int | None = None
    total_absent: int | None = None
    total_students: int | None = None
    started_by: str | None = None
    ended_by: str | None = None

    model_config = {"from_attributes": True}


# 🟢 FIXED: Clean up duplicate routes and fix collisions
@app.post("/attendance/session/start")
def start_session_route(db: Session = Depends(get_db)):
    """Start a new attendance session"""
    return crud.start_attendance_session(db)


@app.post("/attendance/session/stop", response_model=SessionResponse)
def stop_session_route(db: Session = Depends(get_db)):
    """Stop the active attendance session"""
    return crud.stop_active_session(db)


@app.get("/attendance/session/active")
def get_active_session_route(db: Session = Depends(get_db)):
    """Get the currently active session"""
    return crud.get_active_session(db)


# 🟢 FIXED: Explicitly require integer for session_id to avoid collisions
@app.get("/attendance/session/{session_id:int}")
def get_attendance_for_session(session_id: int, db: Session = Depends(get_db)):
    """Get attendance records for a specific session by ID"""
    return crud.get_attendance_by_session_id(db, session_id)


# 🟢 FIXED: Explicitly require integer for session_id in archive route
@app.post("/attendance/session/{session_id:int}/archive")
def archive_session_route(session_id: int, archive_notes: str = None, db: Session = Depends(get_db)):
    """Archive a specific session"""
    return crud.archive_session(db, session_id, archive_notes)


@app.get("/attendance/sessions/archived")
def get_archived_sessions(db: Session = Depends(get_db)):
    return crud.get_archived_sessions(db)


@app.get("/attendance/sessions/active")
def get_active_sessions_list(db: Session = Depends(get_db)):
    return crud.get_active_sessions(db)


# ---------- TEACHER LOGIN API ----------

# ✅ REMOVE THIS CONFLICTING ENDPOINT or fix it
class LoginRequest(BaseModel):
    username: str
    password: str

# ❌ COMMENT OUT OR REMOVE THIS CONFLICTING ENDPOINT
# @app.post("/teacher-password")
# def check_teacher_login(body: LoginRequest):
#     if body.username == "admin" and body.password == "admin":
#         return {"status": "ok"}
#     raise HTTPException(status_code=401, detail="Invalid credentials")


# ---------- UPDATED TEACHER LOGIN ENDPOINT ----------
@app.post("/login/teacher")
@app.post("/Login/teacher")   # backward-compatible alias
def teacher_login_route(body: dict, db: Session = Depends(get_db)):
    """Teacher login with database check or fallback to hardcoded"""
    username = body.get("username")
    password = body.get("password")
    
    # First try database
    teacher = db.query(Teacher).filter(
        Teacher.username == username
    ).first()
    
    if teacher and teacher.password == password:
        return {"success": True, "username": teacher.username}
    
    # Fallback to hardcoded credentials
    if username == "admin" and password == "admin":
        # Ensure this teacher exists in database
        ensure_teacher = db.query(Teacher).filter(
            Teacher.username == "admin"
        ).first()
        
        if not ensure_teacher:
            ensure_teacher = Teacher(username="admin", password="admin")
            db.add(ensure_teacher)
            db.commit()
        
        return {"success": True, "username": "admin"}
    
    raise HTTPException(status_code=401, detail="Invalid username or password")


# ---------- STUDENT LOGIN ENDPOINT ----------
@app.post("/login/student")
def login_student(body: schemas.StudentLogin, db: Session = Depends(get_db)):
    student = crud.student_login(
        db,
        roll_no=body.roll_no,
        password=body.password
    )

    return {
        "success": True,
        "roll_no": student.roll_no,
        "name": student.name
    }


# ---------- SIMPLE ATTENDANCE MARKING (for QR scanner) ----------
class AttendanceMark(BaseModel):
    roll_no: str
    status: str = "present"


@app.post("/attendance/mark")
def mark_attendance_route(data: AttendanceMark, db: Session = Depends(get_db)):
    return crud.mark_attendance(
        db,
        roll_no=data.roll_no,
        status_value=data.status,  # FIXED: Changed from status to status_value
        marked_by="qr_scanner"
    )


@app.post("/biometric/register", response_model=schemas.BiometricRegisterResponse)
def register_biometric_route(payload: schemas.BiometricRegisterRequest, db: Session = Depends(get_db)):
    images = payload.images_base64 or ([] if payload.image_base64 is None else [payload.image_base64])
    if not images:
        raise HTTPException(status_code=400, detail="At least one enrollment image is required")

    return crud.register_biometric_vector(
        db,
        roll_no=payload.roll_no,
        images_base64=images,
        poses=payload.poses,
    )


@app.get("/biometric/vectors", response_model=list[schemas.BiometricVectorResponse])
def biometric_vectors_route(db: Session = Depends(get_db)):
    return crud.get_biometric_vector_sheet(db)


@app.post("/biometric/scan", response_model=schemas.BiometricScanResponse)
def biometric_scan_route(payload: schemas.BiometricScanRequest, db: Session = Depends(get_db)):
    return crud.match_face_and_mark_attendance(
        db,
        image_base64=payload.image_base64,
        status_value=payload.status,
    )


# ---------- Get current attendance ----------
@app.get("/attendance/current")
def attendance_current(db: Session = Depends(get_db)):
    return crud.get_current_attendance_ui(db)


# ---------- ATTENDANCE HISTORY BY DATE ----------
@app.get("/attendance/history/date")
def attendance_history_by_date(date_str: str, db: Session = Depends(get_db)):
    try:
        # Validate date format
        target_date = date.fromisoformat(date_str)
        # Use the new function from crud.py
        return crud.get_attendance_by_session_date(db, target_date)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid date format. Use YYYY-MM-DD format."
        )


# ---------- ENHANCED ATTENDANCE API (for backward compatibility) ----------
@app.get("/attendance/history", response_model=list[schemas.AttendanceHistoryResponse])
def attendance_history(db: Session = Depends(get_db)):
    return crud.get_attendance_history(db)


# ---------- Teacher Password Reset ----------
@app.post("/teacher/reset-password")
def teacher_reset_password(body: schemas.TeacherPasswordReset, db: Session = Depends(get_db)):
    teacher = crud.reset_teacher_password(
        db,
        old_password=body.old_password,
        new_password=body.new_password
    )
    return {"success": True, "username": teacher.username}


# ---------- Student Password Reset ----------
@app.post("/student/reset-password")
def student_reset_password(body: schemas.StudentPasswordReset, db: Session = Depends(get_db)):
    record = crud.set_student_password(
        db,
        roll_no=body.roll_no,
        new_password=body.new_password
    )
    return {"success": True, "roll_no": record.roll_no}
