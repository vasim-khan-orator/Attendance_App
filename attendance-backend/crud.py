from models import Teacher, Member, Attendance, QRCode, StudentAuth, AttendanceSession, BiometricVector
from schemas import MemberCreate, AttendanceCreate, QRCodeCreate
from datetime import date, datetime
from fastapi import HTTPException, status
from sqlalchemy import func, and_, or_
from sqlalchemy.exc import IntegrityError
import base64
import json
import math
import cv2
import numpy as np


def _now_local() -> datetime:
    return datetime.now()


def _iou(box_a, box_b) -> float:
    ax, ay, aw, ah = box_a
    bx, by, bw, bh = box_b
    ax2, ay2 = ax + aw, ay + ah
    bx2, by2 = bx + bw, by + bh

    inter_x1 = max(ax, bx)
    inter_y1 = max(ay, by)
    inter_x2 = min(ax2, bx2)
    inter_y2 = min(ay2, by2)

    inter_w = max(0, inter_x2 - inter_x1)
    inter_h = max(0, inter_y2 - inter_y1)
    inter_area = inter_w * inter_h
    if inter_area <= 0:
        return 0.0

    area_a = aw * ah
    area_b = bw * bh
    union = area_a + area_b - inter_area
    if union <= 0:
        return 0.0
    return float(inter_area / union)


def _dedupe_face_boxes(face_boxes: list[tuple[int, int, int, int]], max_faces: int) -> list[tuple[int, int, int, int]]:
    ordered = sorted(face_boxes, key=lambda box: int(box[2] * box[3]), reverse=True)
    kept: list[tuple[int, int, int, int]] = []
    for box in ordered:
        if all(_iou(box, other) < 0.45 for other in kept):
            kept.append(box)
        if len(kept) >= max_faces:
            break
    return kept


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


FACE_CASCADE = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)


def _normalize_embedding(values: list[float]) -> list[float]:
    norm = math.sqrt(sum(v * v for v in values))
    if norm == 0:
        return values
    return [v / norm for v in values]


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


def _extract_face_crops(image_bgr: np.ndarray, max_faces: int = 8) -> list[np.ndarray]:
    if FACE_CASCADE.empty():
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Face detector not initialized"
        )

    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.2, tileGridSize=(8, 8))
    gray_enhanced = clahe.apply(gray)

    candidate_boxes: list[tuple[int, int, int, int]] = []
    detection_passes = [
        (gray_enhanced, 1.1, 5, (60, 60)),
        (gray_enhanced, 1.05, 4, (48, 48)),
        (gray, 1.1, 5, (60, 60)),
    ]

    for source, scale_factor, min_neighbors, min_size in detection_passes:
        detected = FACE_CASCADE.detectMultiScale(
            source,
            scaleFactor=scale_factor,
            minNeighbors=min_neighbors,
            minSize=min_size,
        )
        for box in detected:
            candidate_boxes.append(tuple(int(v) for v in box))

    if len(candidate_boxes) == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No face detected in frame"
        )

    ordered_faces = _dedupe_face_boxes(candidate_boxes, max_faces=max_faces)
    crops: list[np.ndarray] = []

    for x, y, w, h in ordered_faces:
        pad = int(max(w, h) * 0.15)
        x1 = max(0, x - pad)
        y1 = max(0, y - pad)
        x2 = min(gray.shape[1], x + w + pad)
        y2 = min(gray.shape[0], y + h + pad)

        face = gray[y1:y2, x1:x2]
        if face.size == 0:
            continue

        face = cv2.equalizeHist(face)
        crops.append(cv2.resize(face, (128, 128), interpolation=cv2.INTER_AREA))

    if not crops:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Face crop failed"
        )

    return crops


def _extract_face_crop(image_bgr: np.ndarray) -> np.ndarray:
    return _extract_face_crops(image_bgr, max_faces=1)[0]


def _lbp_image(gray: np.ndarray) -> np.ndarray:
    center = gray
    lbp = np.zeros_like(gray, dtype=np.uint8)
    offsets = [
        (-1, -1), (-1, 0), (-1, 1),
        (0, 1), (1, 1), (1, 0),
        (1, -1), (0, -1),
    ]

    for bit, (dy, dx) in enumerate(offsets):
        shifted = np.roll(np.roll(gray, dy, axis=0), dx, axis=1)
        lbp |= ((shifted >= center).astype(np.uint8) << bit)

    return lbp[1:-1, 1:-1]


def _lbp_grid_hist(gray: np.ndarray, grid: tuple[int, int] = (4, 4), bins: int = 16) -> list[float]:
    lbp = _lbp_image(gray)
    h, w = lbp.shape
    gh, gw = grid
    cell_h = max(1, h // gh)
    cell_w = max(1, w // gw)
    features: list[float] = []

    quant_step = 256 // bins
    for gy in range(gh):
        for gx in range(gw):
            y1 = gy * cell_h
            y2 = h if gy == gh - 1 else (gy + 1) * cell_h
            x1 = gx * cell_w
            x2 = w if gx == gw - 1 else (gx + 1) * cell_w
            cell = lbp[y1:y2, x1:x2]
            quantized = (cell // quant_step).astype(np.int32)
            hist = np.bincount(quantized.ravel(), minlength=bins).astype(np.float32)
            if hist.sum() > 0:
                hist /= hist.sum()
            features.extend(hist.tolist())

    return features


def _dct_lowfreq(gray: np.ndarray, size: int = 8) -> list[float]:
    matrix = np.float32(gray) / 255.0
    dct = cv2.dct(matrix)
    block = dct[:size, :size].flatten()
    if block.size:
        block[0] = 0.0  # drop DC component
    norm = float(np.linalg.norm(block))
    if norm > 0:
        block = block / norm
    return block.tolist()


def _gradient_hist(gray: np.ndarray, bins: int = 32) -> list[float]:
    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    mag, ang = cv2.cartToPolar(gx, gy, angleInDegrees=True)
    bin_idx = np.int32((ang / 360.0) * bins) % bins
    hist = np.bincount(bin_idx.ravel(), weights=mag.ravel(), minlength=bins).astype(np.float32)
    if hist.sum() > 0:
        hist /= hist.sum()
    return hist.tolist()


def _embedding_from_face(face: np.ndarray) -> list[float]:
    features = []
    features.extend(_lbp_grid_hist(face, grid=(4, 4), bins=16))
    features.extend(_dct_lowfreq(face, size=8))
    features.extend(_gradient_hist(face, bins=32))
    return _normalize_embedding(features)


def _embeddings_from_image_base64(image_base64: str) -> list[list[float]]:
    image = _decode_base64_image(image_base64)
    faces = _extract_face_crops(image)
    return [_embedding_from_face(face) for face in faces]


def _embedding_from_image_base64(image_base64: str) -> list[float]:
    return _embeddings_from_image_base64(image_base64)[0]


def _mean_embedding(embeddings: list[list[float]]) -> list[float]:
    matrix = np.array(embeddings, dtype=np.float32)
    mean_vec = np.mean(matrix, axis=0)
    return _normalize_embedding(mean_vec.tolist())


def _cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    return float(sum(a * b for a, b in zip(vec_a, vec_b)))


def register_biometric_vector(db, roll_no: str, images_base64: list[str]):
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

    if len(images_base64) > 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Too many enrollment images. Max allowed is 6"
        )

    embeddings: list[list[float]] = []
    for idx, sample in enumerate(images_base64):
        try:
            embeddings.append(_embedding_from_image_base64(sample))
        except HTTPException as exc:
            raise HTTPException(
                status_code=exc.status_code,
                detail=f"Sample {idx + 1}: {exc.detail}"
            )

    vector = _mean_embedding(embeddings)
    now = _now_local()

    existing = db.query(BiometricVector).filter(BiometricVector.roll_no == roll_no).first()
    if existing:
        existing.embedding_json = json.dumps(vector)
        existing.updated_at = now
        db.commit()
        db.refresh(existing)
        return {
            "roll_no": roll_no,
            "name": member.name,
            "vector_size": len(vector),
            "samples_used": len(embeddings),
            "updated_at": existing.updated_at,
        }

    record = BiometricVector(
        roll_no=roll_no,
        embedding_json=json.dumps(vector),
        created_at=now,
        updated_at=now,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "roll_no": roll_no,
        "name": member.name,
        "vector_size": len(vector),
        "samples_used": len(embeddings),
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
        if row:
            parsed = json.loads(row.embedding_json)
            preview = [round(float(v), 4) for v in parsed[:8]]
        sheet.append(
            {
                "roll_no": member.roll_no,
                "name": member.name,
                "has_vector": bool(row),
                "updated_at": row.updated_at if row else None,
                "embedding_preview": preview,
                "vector_size": len(parsed) if row else None,
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

    targets = _embeddings_from_image_base64(image_base64)
    vectors = db.query(BiometricVector).all()
    if not vectors:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No biometric vectors registered"
        )

    threshold = 0.80
    min_margin = 0.015

    parsed_vectors: list[tuple[str, list[float]]] = []
    for vector_row in vectors:
        try:
            registered = [float(v) for v in json.loads(vector_row.embedding_json)]
        except Exception:
            continue
        parsed_vectors.append((vector_row.roll_no, registered))

    if not parsed_vectors:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No valid biometric vectors registered"
        )

    matched_rolls: dict[str, float] = {}
    best_observed_similarity = -2.0
    face_results = []
    member_names = {m.roll_no: m.name or "" for m in db.query(Member).all()}

    for index, target in enumerate(targets):
        best_roll = None
        best_similarity = -2.0
        second_best_similarity = -2.0
        comparable_count = 0

        for roll_no, registered in parsed_vectors:
            if len(registered) != len(target):
                continue
            comparable_count += 1
            similarity = _cosine_similarity(target, registered)
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
