from sqlalchemy import Column, Integer, String, Date, DateTime, Boolean, Text
from database import Base
from datetime import datetime, date

class Teacher(Base):
    __tablename__ = "teachers"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True)
    password = Column(String)

class Member(Base):
    __tablename__ = "members"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    roll_no = Column(String, unique=True, index=True)
    department = Column(String)
    year = Column(String)

class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    roll_no = Column(String, index=True)
    date = Column(String)  # Keep for backward compatibility
    # ✅ CORRECT: Using lambda function for proper default date
    session_date = Column(Date, default=lambda: date.today())
    status = Column(String, default="present")
    marked_at = Column(DateTime, default=datetime.now)  # New: Timestamp
    marked_by = Column(String, default="teacher")  # New: Who marked it
    name = Column(String)  # Keep for backward compatibility
    archived = Column(Boolean, default=False)  # Mark if archived
    archived_at = Column(DateTime, nullable=True)  # When archived
    session_id = Column(Integer, nullable=True, index=True)


class AttendanceSession(Base):
    __tablename__ = "attendance_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_date = Column(Date, nullable=False)
    session_name = Column(String, nullable=True)  # Optional: Name for the session
    description = Column(Text, nullable=True)  # Optional: Description
    is_active = Column(Boolean, default=True)
    total_present = Column(Integer, default=0)  # Count of present students
    total_absent = Column(Integer, default=0)  # Count of absent students
    total_students = Column(Integer, default=0)  # Total students enrolled
    started_by = Column(String, nullable=True)  # Who started the session
    ended_by = Column(String, nullable=True)  # Who ended the session
    started_at = Column(DateTime, default=datetime.now)
    ended_at = Column(DateTime, nullable=True)
    archived = Column(Boolean, default=False)  # Mark if archived
    archived_at = Column(DateTime, nullable=True)  # When archived
    archive_notes = Column(Text, nullable=True)  # Optional notes for archiving


# NEW — QR Code table
class QRCode(Base):
    __tablename__ = "qr_codes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True)
    created_for = Column(String)
    created_at = Column(String)

# NEW — Student Authentication table
class StudentAuth(Base):
    __tablename__ = "student_auth"

    id = Column(Integer, primary_key=True, index=True)
    roll_no = Column(String, unique=True, index=True)
    password = Column(String)


class BiometricVector(Base):
    __tablename__ = "biometric_vectors"

    id = Column(Integer, primary_key=True, index=True)
    roll_no = Column(String, unique=True, index=True)
    embedding_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now)
