from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import date, datetime


class TeacherOut(BaseModel):
    id: int
    username: str
    model_config = {"from_attributes": True}


class MemberBase(BaseModel):
    name: str
    roll_no: str
    department: str
    year: str


class MemberCreate(MemberBase):
    pass


class MemberOut(MemberBase):
    id: int
    model_config = {"from_attributes": True}


# OLD Attendance schema (keep for backward compatibility) - DEPRECATED
class AttendanceBase(BaseModel):
    roll_no: str
    date: str  # This is the problematic field - string type
    status: str


class AttendanceCreate(AttendanceBase):
    pass


class AttendanceOut(AttendanceBase):
    id: int
    model_config = {"from_attributes": True}


# NEW — Enhanced Attendance schemas
class AttendanceNewBase(BaseModel):
    roll_no: str
    status: str = "present"


class AttendanceNewCreate(AttendanceNewBase):
    session_date: Optional[date] = None
    name: Optional[str] = None


class AttendanceNewResponse(AttendanceNewBase):
    id: int
    session_date: date
    marked_at: datetime
    marked_by: str
    name: Optional[str] = None
    
    model_config = {"from_attributes": True}


# NEW — Attendance History Response (for archive/date queries)
# This is the schema that matches what crud.py returns
class AttendanceHistoryResponse(BaseModel):
    id: int
    roll_no: str
    status: str
    session_date: date
    marked_at: Optional[datetime] = None
    marked_by: Optional[str] = None
    name: Optional[str] = ""

    model_config = ConfigDict(from_attributes=True)


# NEW — QR schemas
class QRCodeBase(BaseModel):
    code: str
    created_for: str
    created_at: str

class QRCodeCreate(QRCodeBase):
    pass

class QRCodeOut(QRCodeBase):
    id: int
    model_config = {"from_attributes": True}


# ---------- Teacher Password Reset ----------
class TeacherPasswordReset(BaseModel):
    old_password: str
    new_password: str


# ---------- Student Password Reset ----------
class StudentPasswordReset(BaseModel):
    roll_no: str
    new_password: str


# ---------- Student Login ----------
class StudentLogin(BaseModel):
    roll_no: str
    password: str


# ---------- Attendance Session Schemas ----------
class SessionOut(BaseModel):
    id: int
    session_date: date
    is_active: bool
    model_config = {"from_attributes": True}


# ---------- Biometric Schemas ----------
class BiometricRegisterRequest(BaseModel):
    roll_no: str
    image_base64: Optional[str] = None
    images_base64: Optional[list[str]] = None
    poses: Optional[list[str]] = None  # e.g. ["front", "left", "right"]


class BiometricScanRequest(BaseModel):
    image_base64: str
    status: str = "present"


class BiometricVectorResponse(BaseModel):
    roll_no: str
    name: str
    has_vector: bool
    updated_at: Optional[datetime] = None
    embedding_preview: Optional[list[float]] = None
    vector_size: Optional[int] = None


class BiometricRegisterResponse(BaseModel):
    roll_no: str
    name: str
    vector_size: int
    samples_used: int
    poses_stored: int = 1
    updated_at: datetime


class BiometricScanMatch(BaseModel):
    roll_no: str
    name: str
    similarity: float
    attendance_recorded: bool = False
    attendance: Optional[AttendanceHistoryResponse] = None


class BiometricFaceResult(BaseModel):
    face_index: int
    matched: bool
    roll_no: Optional[str] = None
    name: Optional[str] = None
    similarity: Optional[float] = None
    attendance_recorded: bool = False


class BiometricScanResponse(BaseModel):
    matched: bool
    roll_no: Optional[str] = None
    name: Optional[str] = None
    similarity: Optional[float] = None
    attendance: Optional[AttendanceHistoryResponse] = None
    match_count: int = 0
    matches: list[BiometricScanMatch] = Field(default_factory=list)
    faces_detected: int = 0
    face_results: list[BiometricFaceResult] = Field(default_factory=list)
