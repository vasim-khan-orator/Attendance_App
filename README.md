# 📋 Attendance App

A full-stack web application for managing classroom attendance using **QR codes** and **facial biometrics**. The system features a teacher portal for session management and a student-facing interface for self-check-in.

---

## 🏗️ Architecture

```
Attendance_App/
├── attendance-backend/   # Python FastAPI REST API + SQLite database
└── teacher-portal/       # React + Vite frontend (teacher & student UI)
```

---

## ✨ Features

### 👩‍🏫 Teacher Portal
- **Session Management** — Start and stop attendance sessions with live timers
- **QR Code Generator** — Generate unique, per-student QR tokens to grant check-in access
- **Facial Biometric Registration** — Enroll student faces via webcam capture
- **Webcam Scanner** — Real-time face recognition to auto-mark attendance
- **Current Status View** — Live dashboard of who is present/absent in an active session
- **Previous Sessions** — Browse and review archived attendance history by date
- **Member Management** — Add or remove students (with name, roll number, department, year)
- **Vector Sheet** — View stored facial embedding data per student
- **Password Reset** — Teacher and student credential management

### 🧑‍🎓 Student Portal
- **QR Code Check-in** — Scan the teacher-generated QR code to mark attendance
- **Student Dashboard** — View personal attendance history

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, React Router v7, Vite 7 |
| **QR Codes** | `qrcode.react`, `html5-qrcode`, `jsqr` |
| **HTTP Client** | Axios |
| **Backend** | Python, FastAPI, Uvicorn |
| **Database** | SQLite (via SQLAlchemy ORM) |
| **Computer Vision** | OpenCV (`opencv-python-headless`), NumPy, Pillow |
| **Data Validation** | Pydantic |

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.10+**
- **Node.js 18+** and **npm**

---

### Backend Setup (`attendance-backend`)

```bash
cd attendance-backend

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`.

#### Environment Variables (optional)

Create a `.env` file in `attendance-backend/` to override defaults:

```env
SERVER_IP=127.0.0.1
PORT=8000
```

> The default teacher credentials are **`admin` / `admin`** and are created automatically on first startup.

---

### Frontend Setup (`teacher-portal`)

```bash
cd teacher-portal

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The frontend will be available at `http://localhost:5173`.

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Health check |
| `POST` | `/login/teacher` | Teacher authentication |
| `POST` | `/login/student` | Student authentication |
| `GET` | `/members` | List all students |
| `POST` | `/members` | Add a student |
| `DELETE` | `/members/{roll_no}` | Remove a student |
| `POST` | `/attendance/session/start` | Start an attendance session |
| `POST` | `/attendance/session/stop` | Stop the active session |
| `GET` | `/attendance/session/active` | Get the currently active session |
| `GET` | `/attendance/current` | Get live attendance for the active session |
| `POST` | `/attendance/mark` | Manually mark a student present/absent |
| `GET` | `/attendance/history` | Full attendance history |
| `GET` | `/attendance/history/date?date_str=YYYY-MM-DD` | Attendance records for a specific date |
| `GET` | `/attendance/sessions/archived` | List all archived sessions |
| `POST` | `/qr/grant-access` | Generate a unique QR token for a student |
| `GET` | `/qr/check-access/{roll_no}` | Check if a student has a valid QR token |
| `POST` | `/biometric/register` | Enroll student face embeddings |
| `POST` | `/biometric/scan` | Scan a face and auto-mark attendance |
| `GET` | `/biometric/vectors` | View all stored facial embedding vectors |
| `POST` | `/teacher/reset-password` | Reset teacher password |
| `POST` | `/student/reset-password` | Reset student password |

---

## 🗄️ Database Schema

| Table | Description |
|---|---|
| `teachers` | Teacher login credentials |
| `members` | Enrolled students (name, roll number, department, year) |
| `attendance` | Individual attendance records per student per session |
| `attendance_sessions` | Session metadata (start/end times, totals, archive status) |
| `qr_codes` | Student-specific QR tokens |
| `student_auth` | Student login credentials |
| `biometric_vectors` | Stored face embedding JSON per student |

---

## 🔐 Authentication

- **Teachers** log in with username/password. Default credentials: `admin` / `admin`.
- **Students** log in with their roll number as both username and default password. Passwords can be changed via the reset endpoint.
- Students require a teacher-granted QR token to check in to a session.

---

## 📁 Project Structure

```
teacher-portal/src/
├── pages/
│   ├── auth/
│   │   └── LoginSwitcher.jsx         # Unified login page (teacher/student toggle)
│   └── student/
│       └── StudentDashboard.jsx      # Student attendance view
├── teacher/
│   ├── TeacherDashboard.jsx          # Main teacher layout + routing
│   ├── Navbar.jsx
│   ├── Sidebar.jsx
│   └── components/
│       ├── AddMember.jsx             # Enroll new students
│       ├── RemoveMember.jsx          # Remove students
│       ├── CurrentStatus.jsx         # Live attendance view
│       ├── PreviousStatus.jsx        # Historical session viewer
│       ├── QRGenerator.jsx           # QR token generator
│       ├── WebcamScanner.jsx         # Face recognition scanner
│       ├── BiometricRegistration.jsx # Student face enrollment
│       ├── Sheet.jsx                 # Attendance sheet export
│       ├── VectorSheet.jsx           # Biometric vector viewer
│       ├── Timer.jsx                 # Session timer
│       └── PasswordReset.jsx         # Password management
└── api/                              # Axios API client utilities
```

---

## 📝 Notes

- The SQLite database (`attendance.db`) is created automatically on first run.
- The backend performs automatic schema migrations on startup to handle column additions in existing databases.
- Biometric face embeddings are stored as JSON arrays in the database.
- CORS is configured to allow all origins by default (`"*"`); restrict this in production via the `CORS_ORIGINS` config for security.
