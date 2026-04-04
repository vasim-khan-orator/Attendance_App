from models import Teacher, Member, Attendance, QRCode, StudentAuth, AttendanceSession, BiometricVector
from schemas import MemberCreate, AttendanceCreate, QRCodeCreate
from datetime import date, datetime
from fastapi import HTTPException, status
from sqlalchemy import func, and_, or_
from sqlalchemy.exc import IntegrityError
import base64
import json
import cv2
import numpy as np


def _now_local() -> datetime:
    return datetime.now()


def create_member(db, member: MemberCreate):
    db_member = Member(**member.model_dump())
    db.add(db_member)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Member with roll number {member.roll_no} already exists"
        )
    db.refresh(db_member)
    return db_member


def get_members(db):
    return db.query(Member).all()


def delete_member(db, roll_no: str):
    # Perform cleanup of all associated data before deleting the member
    db.query(Attendance).filter(Attendance.roll_no == roll_no).delete()
    db.query(StudentAuth).filter(StudentAuth.roll_no == roll_no).delete()
    db.query(BiometricVector).filter(BiometricVector.roll_no == roll_no).delete()
    
    # Finally, delete the member profile
    db.query(Member).filter(Member.roll_no == roll_no).delete()
    db.commit()


def create_attendance(db, attendance: AttendanceCreate):
    db_att = Attendance(**attendance.model_dump())
    db.add(db_att)
    db.commit()
    db.refresh(db_att)
    return db_att


def get_attendance(db):
    return db.query(Attendance).all()


# NEW — QR Create
def create_qr(db, qr: QRCodeCreate):
    db_qr = QRCode(**qr.model_dump())
    db.add(db_qr)
    db.commit()
    db.refresh(db_qr)
    return db_qr


# NEW — Get latest QR
def get_latest_qr(db):
    return db.query(QRCode).order_by(QRCode.id.desc()).first()


# NEW — Get attendance by specific date (string or date) - UPDATED
def get_attendance_by_date(db, date_value):
    """
    Get attendance records for a specific date.
    Accepts both string (YYYY-MM-DD) or date objects.
    Returns a list of dictionaries formatted for API response.
    """
    # Convert string to date if necessary
    if isinstance(date_value, str):
        try:
            date_value = date.fromisoformat(date_value)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format. Use YYYY-MM-DD"
            )
    
    records = db.query(Attendance).filter(
        Attendance.session_date == date_value
    ).all()

    return [
        {
            "id": r.id,
            "roll_no": r.roll_no,
            "status": r.status,
            "session_date": str(r.session_date),
            "marked_at": r.marked_at,
            "name": r.name or "",
            "marked_by": r.marked_by or "scanner",
        }
        for r in records
    ]


# NEW — Get attendance by date (date object) - keep for backward compatibility
def get_attendance_by_session_date(db, target_date: date):
    return db.query(Attendance).filter(
        Attendance.session_date == target_date
    ).all()


# NEW — Get attendance by date (flexible - accepts both string or date)
def get_attendance_by_date_flexible(db, date_value):
    """
    Flexible function that accepts either string or date object
    and returns attendance for that date
    """
    if isinstance(date_value, str):
        # Convert string to date object
        try:
            date_value = date.fromisoformat(date_value)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format. Use YYYY-MM-DD"
            )
    
    return db.query(Attendance).filter(
        Attendance.session_date == date_value
    ).all()


# NEW — Get all unique attendance dates - UPDATED
def get_attendance_dates(db):
    rows = db.query(Attendance.session_date).distinct().all()
    return [str(r[0]) for r in rows]


# NEW — Get teacher by username
def get_teacher_by_username(db, username: str):
    return db.query(Teacher).filter(Teacher.username == username).first()


# NEW — Teacher Login function
def teacher_login(db, username: str, password: str):
    teacher = db.query(Teacher).filter(Teacher.username == username).first()

    if not teacher or teacher.password != password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )

    return teacher


# ---------- Attendance Session Control Functions ----------
def start_attendance_session(db, started_by: str = "teacher"):
    # Close any previous active session automatically
    db.query(AttendanceSession).filter(
        AttendanceSession.is_active == True
    ).update({"is_active": False, "ended_at": _now_local()})

    session = AttendanceSession(
        session_date=date.today(), 
        is_active=True,
        started_by=started_by,
        total_students=db.query(Member).count()  # Get total enrolled students
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def move_current_to_history(db):
    today = date.today()

    records = db.query(Attendance).filter(
        Attendance.session_date == today
    ).all()

    # nothing to move
    if not records:
        return

    for r in records:
        r.status = "archived"  # optional tag

    db.commit()


def stop_attendance_session(db, ended_by: str = "teacher"):
    session = db.query(AttendanceSession).filter(
        AttendanceSession.is_active == True
    ).first()

    if not session:
        return None

    # Calculate statistics before closing
    attendance_count = db.query(Attendance).filter(
        Attendance.session_date == session.session_date
    ).count()
    
    total_students = session.total_students or db.query(Member).count()
    
    session.is_active = False
    session.ended_at = _now_local()
    session.ended_by = ended_by
    session.total_present = attendance_count
    session.total_absent = total_students - attendance_count

    db.commit()

    move_current_to_history(db)

    db.refresh(session)
    return session


def get_active_session(db):
    return db.query(AttendanceSession).filter(
        AttendanceSession.is_active == True
    ).first()


# NEW — Stop active session with archive logic
def stop_active_session(db, ended_by: str = "teacher"):
    session = db.query(AttendanceSession).filter(
        AttendanceSession.is_active == True
    ).first()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active session to stop"
        )

    # Get attendance statistics for this session
    attendance_records = db.query(Attendance).filter(
        Attendance.session_date == session.session_date
    ).all()
    
    total_present = len(attendance_records)
    total_students = session.total_students or db.query(Member).count()
    total_absent = total_students - total_present

    # Update session with final statistics
    session.is_active = False
    session.ended_at = _now_local()
    session.ended_by = ended_by
    session.total_present = total_present
    session.total_absent = total_absent

    # Archive the attendance records
    for record in attendance_records:
        record.session_id = session.id
        record.archived = True
        record.archived_at = _now_local()

    db.commit()
    db.refresh(session)
    return session


# NEW — Archive a completed session (manual archive)
def archive_session(db, session_id: int, archive_notes: str = None):
    session = db.query(AttendanceSession).filter(
        AttendanceSession.id == session_id
    ).first()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )

    if session.archived:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session already archived"
        )

    session.archived = True
    session.archived_at = _now_local()
    session.archive_notes = archive_notes

    # Also archive all attendance records for this session
    attendance_records = db.query(Attendance).filter(
        Attendance.session_date == session.session_date
    ).all()
    
    for record in attendance_records:
        record.archived = True
        record.archived_at = _now_local()
        record.session_id = session.id

    db.commit()
    db.refresh(session)
    return session


# NEW — Get archived sessions
def get_archived_sessions(db):
    return db.query(AttendanceSession).filter(
        AttendanceSession.archived == True
    ).order_by(AttendanceSession.archived_at.desc()).all()


# NEW — Get active sessions (not archived)
def get_active_sessions(db):
    return db.query(AttendanceSession).filter(
        AttendanceSession.archived == False
    ).order_by(AttendanceSession.started_at.desc()).all()


# NEW — Mark attendance with session check (FIXED parameter name)
def mark_attendance(db, roll_no: str, status_value: str, marked_by: str = "scanner"):
    session = get_active_session(db)

    if not session:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Attendance session not active"
        )

    # Get member details
    member = db.query(Member).filter(Member.roll_no == roll_no).first()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Member with roll number {roll_no} not found"
        )

    # Prevent duplicate marking in the same active session.
    existing = db.query(Attendance).filter(
        Attendance.roll_no == roll_no,
        Attendance.archived == False,
        or_(
            Attendance.session_id == session.id,
            and_(Attendance.session_id.is_(None), Attendance.session_date == session.session_date),
        )
    ).first()

    if existing:
        return existing

    record = Attendance(
        roll_no=roll_no,
        name=member.name,
        status=status_value,
        session_date=session.session_date,
        session_id=session.id,
        marked_at=_now_local(),
        marked_by=marked_by
    )

    db.add(record)
    db.commit()
    db.refresh(record)
    return record


# NEW — Get today's attendance (updated to use session_date)
def get_current_attendance(db):
    session = get_active_session(db)
    if session:
        return db.query(Attendance).filter(
            Attendance.archived == False,
            or_(
                Attendance.session_id == session.id,
                and_(Attendance.session_id.is_(None), Attendance.session_date == session.session_date),
            )
        ).all()

    return db.query(Attendance).filter(
        Attendance.session_date == date.today(),
        Attendance.archived == False
    ).all()


# NEW — Get current attendance formatted for UI
def get_current_attendance_ui(db):
    records = get_current_attendance(db)
    return [
        {
            "roll_no": r.roll_no,
            "name": r.name or "",
            "time_scanned": r.marked_at,
            "status": r.status
        }
        for r in records
    ]


# NEW — Get attendance history sorted by date (all records)
def get_attendance_history(db):
    records = db.query(Attendance).order_by(Attendance.session_date.desc()).all()
    return [
        {
            "id": r.id,
            "roll_no": r.roll_no,
            "status": r.status,
            "session_date": str(r.session_date),
            "marked_at": r.marked_at,
            "name": r.name or "",
            "marked_by": r.marked_by or "scanner",
        }
        for r in records
    ]


# NEW — Get attendance by session ID
def get_attendance_by_session_id(db, session_id: int):
    records = db.query(Attendance).filter(
        Attendance.session_id == session_id
    ).all()
    return [
        {
            "id": r.id,
            "roll_no": r.roll_no,
            "status": r.status,
            "session_date": str(r.session_date),
            "marked_at": r.marked_at,
            "name": r.name or "",
            "marked_by": r.marked_by or "scanner",
            "session_id": r.session_id,
        }
        for r in records
    ]


# ---------------------------------------------------------------------------
# Face Detection (YuNet) + Face Recognition (SFace) — OpenCV DNN pipeline
# ---------------------------------------------------------------------------
from models_download import model_path, ensure_models as _ensure_face_models

# Lazy-loaded singletons — initialized on first use.
_face_detector = None
_face_recognizer = None


def _get_detector():
    global _face_detector
    if _face_detector is None:
        _ensure_face_models()
        det_path = str(model_path("face_detection_yunet_2023mar.onnx"))
        _face_detector = cv2.FaceDetectorYN.create(
            det_path,
            "",
            (320, 320),       # default input size, resized per-image later
            score_threshold=0.6,
            nms_threshold=0.3,
            top_k=5000,
        )
    return _face_detector


def _get_recognizer():
    global _face_recognizer
    if _face_recognizer is None:
        _ensure_face_models()
        rec_path = str(model_path("face_recognition_sface_2021dec.onnx"))
        _face_recognizer = cv2.FaceRecognizerSF.create(rec_path, "")
    return _face_recognizer


def _decode_base64_image(image_base64: str) -> np.ndarray:
    raw = image_base64.split(",", 1)[1] if "," in image_base64 else image_base64
    try:
        image_bytes = base64.b64decode(raw, validate=True)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image data"
        )

    if not image_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty image data"
        )

    np_buf = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(np_buf, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported image format"
        )
    return image


def _detect_faces(image_bgr: np.ndarray, max_faces: int = 8):
    """Detect faces using YuNet. Returns list of face info arrays (15 values each)."""
    detector = _get_detector()
    h, w = image_bgr.shape[:2]
    detector.setInputSize((w, h))
    _, raw_detections = detector.detect(image_bgr)

    if raw_detections is None or len(raw_detections) == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No face detected in frame"
        )

    # Sort by confidence (index 14), take top max_faces
    sorted_faces = sorted(raw_detections, key=lambda f: float(f[14]), reverse=True)
    return sorted_faces[:max_faces]


def _embedding_from_face_detection(image_bgr: np.ndarray, face_info) -> list[float]:
    """Align face using landmarks and extract 128-D SFace embedding."""
    recognizer = _get_recognizer()
    aligned = recognizer.alignCrop(image_bgr, face_info)
    feature = recognizer.feature(aligned)
    return feature.flatten().tolist()


def _embeddings_from_image_base64(image_base64: str) -> list[list[float]]:
    """Detect all faces in an image and return their 128-D embeddings."""
    image = _decode_base64_image(image_base64)
    faces = _detect_faces(image)
    return [_embedding_from_face_detection(image, f) for f in faces]


def _faces_and_embeddings_from_image_base64(image_base64: str) -> list[tuple]:
    """Detect all faces in an image and return their info arrays and 128-D embeddings."""
    image = _decode_base64_image(image_base64)
    faces = _detect_faces(image)
    return [(f, _embedding_from_face_detection(image, f)) for f in faces]


def _embedding_from_image_base64(image_base64: str) -> list[float]:
    """Detect the single best face and return its 128-D embedding."""
    return _embeddings_from_image_base64(image_base64)[0]


def _cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    a = np.array(vec_a, dtype=np.float32)
    b = np.array(vec_b, dtype=np.float32)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


def _best_pose_similarity(target: list[float], stored_vecs: list[list[float]]) -> float:
    """Compare target against multiple stored pose vectors, return best similarity."""
    best = -2.0
    for vec in stored_vecs:
        if len(vec) != len(target):
            continue
        sim = _cosine_similarity(target, vec)
        if sim > best:
            best = sim
    return best


def _parse_stored_embedding(embedding_json_str: str) -> list[list[float]]:
    """
    Parse stored embedding JSON. Supports two formats:
    - Old format (flat list):  [0.1, 0.2, ...] → wrapped as [[0.1, 0.2, ...]]
    - New format (list of lists): [[0.1, ...], [0.2, ...], ...]
    """
    parsed = json.loads(embedding_json_str)
    if not parsed:
        return []
    # If first element is a number, it's old flat format → wrap in list
    if isinstance(parsed[0], (int, float)):
        return [parsed]
    # New format: list of lists
    return parsed


def register_biometric_vector(db, roll_no: str, images_base64: list[str], poses: list[str] | None = None):
    member = db.query(Member).filter(Member.roll_no == roll_no).first()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Member with roll number {roll_no} not found"
        )

    if not images_base64:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one enrollment image is required"
        )

    if len(images_base64) > 9:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Too many enrollment images. Max allowed is 9"
        )

    # Extract one embedding per image (each image = one pose)
    embeddings: list[list[float]] = []
    for idx, sample in enumerate(images_base64):
        pose_label = poses[idx] if poses and idx < len(poses) else f"pose_{idx}"
        try:
            embeddings.append(_embedding_from_image_base64(sample))
        except HTTPException as exc:
            raise HTTPException(
                status_code=exc.status_code,
                detail=f"Sample {idx + 1} ({pose_label}): {exc.detail}"
            )

    # Store as list-of-lists (one vector per pose)
    now = _now_local()

    existing = db.query(BiometricVector).filter(BiometricVector.roll_no == roll_no).first()
    if existing:
        existing.embedding_json = json.dumps(embeddings)
        existing.updated_at = now
        db.commit()
        db.refresh(existing)
        return {
            "roll_no": roll_no,
            "name": member.name,
            "vector_size": len(embeddings[0]) if embeddings else 0,
            "samples_used": len(embeddings),
            "poses_stored": len(embeddings),
            "updated_at": existing.updated_at,
        }

    record = BiometricVector(
        roll_no=roll_no,
        embedding_json=json.dumps(embeddings),
        created_at=now,
        updated_at=now,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "roll_no": roll_no,
        "name": member.name,
        "vector_size": len(embeddings[0]) if embeddings else 0,
        "samples_used": len(embeddings),
        "poses_stored": len(embeddings),
        "updated_at": record.updated_at,
    }


def get_biometric_vector_sheet(db):
    members = db.query(Member).order_by(Member.roll_no.asc()).all()
    vectors = db.query(BiometricVector).all()
    by_roll = {v.roll_no: v for v in vectors}

    sheet = []
    for member in members:
        row = by_roll.get(member.roll_no)
        preview = None
        vec_size = None
        if row:
            pose_vecs = _parse_stored_embedding(row.embedding_json)
            if pose_vecs and pose_vecs[0]:
                preview = [round(float(v), 4) for v in pose_vecs[0][:8]]
                vec_size = len(pose_vecs[0])
        sheet.append(
            {
                "roll_no": member.roll_no,
                "name": member.name,
                "has_vector": bool(row),
                "updated_at": row.updated_at if row else None,
                "embedding_preview": preview,
                "vector_size": vec_size,
            }
        )
    return sheet


def match_face_and_mark_attendance(db, image_base64: str, status_value: str = "present"):
    session = get_active_session(db)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Attendance session not active"
        )

    # Gracefully handle "no face detected" — return clean no-match instead of 422
    try:
        face_and_targets = _faces_and_embeddings_from_image_base64(image_base64)
        targets = [ft[1] for ft in face_and_targets]
        face_infos = [ft[0] for ft in face_and_targets]
    except HTTPException as exc:
        if exc.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY:
            return {
                "matched": False,
                "roll_no": None,
                "name": None,
                "similarity": None,
                "attendance": None,
                "match_count": 0,
                "matches": [],
                "faces_detected": 0,
                "face_results": [],
            }
        raise
    vectors = db.query(BiometricVector).all()
    if not vectors:
        return {
            "matched": False,
            "roll_no": None,
            "name": None,
            "similarity": None,
            "attendance": None,
            "match_count": 0,
            "matches": [],
            "faces_detected": len(targets) if targets else 0,
            "face_results": [],
        }

    threshold = 0.70
    min_margin = 0.02

    # Parse stored embeddings (supports old flat format and new multi-pose format)
    parsed_vectors: list[tuple[str, list[list[float]]]] = []
    for vector_row in vectors:
        try:
            pose_vecs = _parse_stored_embedding(vector_row.embedding_json)
        except Exception:
            continue
        if pose_vecs:
            parsed_vectors.append((vector_row.roll_no, pose_vecs))

    if not parsed_vectors:
        return {
            "matched": False,
            "roll_no": None,
            "name": None,
            "similarity": None,
            "attendance": None,
            "match_count": 0,
            "matches": [],
            "faces_detected": len(targets) if targets else 0,
            "face_results": [],
        }

    matched_rolls: dict[str, float] = {}
    best_observed_similarity = -2.0
    face_results = []
    member_names = {m.roll_no: m.name or "" for m in db.query(Member).all()}

    for index, target in enumerate(targets):
        best_roll = None
        best_similarity = -2.0
        second_best_similarity = -2.0
        comparable_count = 0

        for roll_no, pose_vecs in parsed_vectors:
            # Compare against ALL stored pose vectors, take best
            similarity = _best_pose_similarity(target, pose_vecs)
            if similarity <= -1.5:
                continue  # incompatible dimensions
            comparable_count += 1
            if similarity > best_similarity:
                second_best_similarity = best_similarity
                best_similarity = similarity
                best_roll = roll_no
            elif similarity > second_best_similarity:
                second_best_similarity = similarity

        best_observed_similarity = max(best_observed_similarity, best_similarity)

        if comparable_count == 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Stored vectors are from an older model. Re-register student biometrics."
            )

        box_info = face_infos[index]
        box = {"x": float(box_info[0]), "y": float(box_info[1]), "width": float(box_info[2]), "height": float(box_info[3])}

        if (
            best_roll is None or
            best_similarity < threshold or
            (second_best_similarity > -1.5 and (best_similarity - second_best_similarity) < min_margin)
        ):
            face_results.append(
                {
                    "face_index": index + 1,
                    "matched": False,
                    "roll_no": None,
                    "name": None,
                    "similarity": None if best_similarity <= -1.5 else round(best_similarity, 4),
                    "attendance_recorded": False,
                    "box": box,
                }
            )
            continue

        face_results.append(
            {
                "face_index": index + 1,
                "matched": True,
                "roll_no": best_roll,
                "name": member_names.get(best_roll, ""),
                "similarity": round(best_similarity, 4),
                "attendance_recorded": False,
                "box": box,
            }
        )

        existing_similarity = matched_rolls.get(best_roll)
        if existing_similarity is None or best_similarity > existing_similarity:
            matched_rolls[best_roll] = best_similarity

    if not matched_rolls:
        return {
            "matched": False,
            "roll_no": None,
            "name": None,
            "similarity": None if best_observed_similarity <= -1.5 else round(best_observed_similarity, 4),
            "attendance": None,
            "match_count": 0,
            "matches": [],
            "faces_detected": len(targets),
            "face_results": face_results,
        }

    matches = []
    for roll_no, similarity in sorted(matched_rolls.items(), key=lambda item: item[1], reverse=True):
        already_marked = db.query(Attendance).filter(
            Attendance.roll_no == roll_no,
            Attendance.archived == False,
            or_(
                Attendance.session_id == session.id,
                and_(Attendance.session_id.is_(None), Attendance.session_date == session.session_date),
            )
        ).first() is not None

        try:
            record = mark_attendance(
                db,
                roll_no=roll_no,
                status_value=status_value,
                marked_by="face_scanner",
            )
        except HTTPException as exc:
            # Vector can outlive member records; skip only missing members.
            if exc.status_code == status.HTTP_404_NOT_FOUND:
                continue
            raise

        matches.append(
            {
                "roll_no": roll_no,
                "name": record.name or "",
                "similarity": round(similarity, 4),
                "attendance_recorded": not already_marked,
                "attendance": {
                    "id": record.id,
                    "roll_no": record.roll_no,
                    "status": record.status,
                    "session_date": record.session_date,
                    "marked_at": record.marked_at,
                    "marked_by": record.marked_by,
                    "name": record.name or "",
                },
            }
        )

    matched_index_by_roll = {m["roll_no"]: idx for idx, m in enumerate(matches)}
    display_recorded_by_roll: set[str] = set()
    for face_result in face_results:
        if not face_result.get("matched"):
            continue
        roll_no = face_result.get("roll_no")
        match_idx = matched_index_by_roll.get(roll_no)
        if match_idx is None:
            continue
        face_result["name"] = matches[match_idx]["name"]
        recorded_in_this_scan = (
            matches[match_idx]["attendance_recorded"] and
            roll_no not in display_recorded_by_roll
        )
        face_result["attendance_recorded"] = recorded_in_this_scan
        if recorded_in_this_scan:
            display_recorded_by_roll.add(roll_no)

    if not matches:
        return {
            "matched": False,
            "roll_no": None,
            "name": None,
            "similarity": None if best_observed_similarity <= -1.5 else round(best_observed_similarity, 4),
            "attendance": None,
            "match_count": 0,
            "matches": [],
            "faces_detected": len(targets),
            "face_results": face_results,
        }

    top_match = matches[0]

    return {
        "matched": True,
        "roll_no": top_match["roll_no"],
        "name": top_match["name"],
        "similarity": top_match["similarity"],
        "attendance": top_match["attendance"],
        "match_count": len(matches),
        "matches": matches,
        "faces_detected": len(targets),
        "face_results": face_results,
    }


# ---------- Teacher Password Reset ----------
def ensure_default_teacher(db):
    teacher = db.query(Teacher).filter(Teacher.username == "admin").first()
    if teacher:
        return teacher

    # create only FIRST time
    teacher = Teacher(username="admin", password="admin")
    db.add(teacher)
    db.commit()
    db.refresh(teacher)
    return teacher


def reset_teacher_password(db, old_password: str, new_password: str):
    teacher = db.query(Teacher).filter(Teacher.username == "admin").first()

    if not teacher:
        # create only ONCE if missing
        teacher = Teacher(username="admin", password="admin")
        db.add(teacher)
        db.commit()
    db.refresh(teacher)

    # validate old password
    if teacher.password != old_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Old password is incorrect"
        )

    # update and persist
    teacher.password = new_password
    db.commit()
    db.refresh(teacher)

    return teacher


# ---------- Student Password Reset ----------
def set_student_password(db, roll_no: str, new_password: str):
    member = db.query(Member).filter(Member.roll_no == roll_no).first()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found for this roll number"
        )

    record = db.query(StudentAuth).filter(StudentAuth.roll_no == roll_no).first()

    if record:
        record.password = new_password
    else:
        record = StudentAuth(roll_no=roll_no, password=new_password)
        db.add(record)

    db.commit()
    db.refresh(record)
    return record


# ---------- Student Login ----------
def student_login(db, roll_no: str, password: str):
    student = db.query(Member).filter(Member.roll_no == roll_no).first()

    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )

    # default password = roll number
    default_pass = roll_no

    # Check if student has a custom password in StudentAuth
    auth_record = db.query(StudentAuth).filter(StudentAuth.roll_no == roll_no).first()
    
    if auth_record and auth_record.password:
        valid_pass = auth_record.password
    else:
        valid_pass = default_pass

    if password != valid_pass:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid roll number or password"
        )

    return student
