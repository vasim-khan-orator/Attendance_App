/**
 * commandParser.js
 *
 * Deterministic natural-language intent parser for the Attendance Command System.
 * STT-ready: pipe any transcript text into parseCommand(text) — nothing else changes.
 */

// ============================================================
//  INTENT DEFINITIONS
// ============================================================

export const INTENTS = {
  // ─── Session / Timer ──────────────────────────────────────
  START_ATTENDANCE:           "START_ATTENDANCE",
  STOP_ATTENDANCE:            "STOP_ATTENDANCE",
  RESET_TIMER:                "RESET_TIMER",
  SET_TIMER:                  "SET_TIMER",

  // ─── Attendance Queries ────────────────────────────────────
  SHOW_CURRENT_ATTENDANCE:    "SHOW_CURRENT_ATTENDANCE",
  SHOW_PREVIOUS_SESSIONS:     "SHOW_PREVIOUS_SESSIONS",
  COUNT_PRESENT:              "COUNT_PRESENT",
  COUNT_ABSENT:               "COUNT_ABSENT",
  CHECK_STUDENT_PRESENT:      "CHECK_STUDENT_PRESENT",

  // ─── Scanner ──────────────────────────────────────────────
  START_FACE_SCANNER:         "START_FACE_SCANNER",
  STOP_FACE_SCANNER:          "STOP_FACE_SCANNER",
  CAPTURE_FRAME:              "CAPTURE_FRAME",

  // ─── Student / Member Management ──────────────────────────
  ADD_STUDENT:                "ADD_STUDENT",
  REGISTER_BIOMETRICS:        "REGISTER_BIOMETRICS",
  REMOVE_STUDENT:             "REMOVE_STUDENT",
  SHOW_STUDENTS:              "SHOW_STUDENTS",
  COUNT_STUDENTS:             "COUNT_STUDENTS",
  SEARCH_STUDENT:             "SEARCH_STUDENT",

  // ─── Password ─────────────────────────────────────────────
  CHANGE_TEACHER_PASSWORD:    "CHANGE_TEACHER_PASSWORD",
  RESET_STUDENT_PASSWORD:     "RESET_STUDENT_PASSWORD",
  OPEN_PASSWORD_SETTINGS:     "OPEN_PASSWORD_SETTINGS",

  // ─── QR ───────────────────────────────────────────────────
  GENERATE_QR_FOR:            "GENERATE_QR_FOR",
  GRANT_QR_ACCESS:            "GRANT_QR_ACCESS",
  GENERATE_QR:                "GENERATE_QR",

  // ─── Navigation ───────────────────────────────────────────
  GO_HOME:                    "GO_HOME",
  SHOW_SHEET:                 "SHOW_SHEET",
  SHOW_VECTOR_SHEET:          "SHOW_VECTOR_SHEET",
  LOGOUT:                     "LOGOUT",

  // ─── System / Meta ────────────────────────────────────────
  SHOW_HELP:                  "SHOW_HELP",
  CLEAR_CHAT:                 "CLEAR_CHAT",

  // ─── Conversational flow ──────────────────────────────────
  CONFIRM:                    "CONFIRM",
  CANCEL:                     "CANCEL",

  UNKNOWN:                    "UNKNOWN",
};

// ============================================================
//  KEYWORD MAPS
// ============================================================

const INTENT_PHRASES = [

  // ── Conversational: CONFIRM / CANCEL (checked first to avoid conflicts) ──
  {
    intent: INTENTS.CONFIRM,
    phrases: [
      "confirm", "yes", "yeah", "yep", "yup", "ok", "okay",
      "do it", "proceed", "go ahead", "sure", "approved",
      "that's right", "correct", "affirmative",
    ],
  },
  {
    intent: INTENTS.CANCEL,
    phrases: [
      "cancel", "no", "nope", "nah", "abort", "stop",
      "never mind", "nevermind", "forget it", "skip it",
      "don't do it", "negative",
    ],
  },

  // ── STOP before START ──────────────────────────────────────
  {
    intent: INTENTS.STOP_ATTENDANCE,
    phrases: [
      "stop attendance", "stop the attendance", "end attendance",
      "end the attendance", "finish attendance", "close attendance",
      "end attendance session", "stop session", "end session",
      "finish session", "close session", "halt attendance",
      "pause attendance", "stop taking attendance", "end class",
    ],
  },
  {
    intent: INTENTS.STOP_FACE_SCANNER,
    phrases: [
      "stop scanner", "stop face scanner", "stop auto scan",
      "stop scanning", "close scanner", "end scanning",
      "disable scanner", "turn off scanner", "deactivate scanner",
      "stop facial recognition", "stop camera",
    ],
  },

  // ── REMOVE before ADD ──────────────────────────────────────
  {
    intent: INTENTS.REMOVE_STUDENT,
    phrases: [
      "remove student", "delete student", "remove member",
      "delete member", "remove a student", "delete a student",
      "kick student", "expel student", "unenroll student",
    ],
  },

  // ── RESET TIMER ────────────────────────────────────────────
  {
    intent: INTENTS.RESET_TIMER,
    phrases: [
      "reset timer", "restart timer", "clear timer",
      "reset the timer", "restart the timer",
    ],
  },

  // ── SET TIMER ──────────────────────────────────────────────
  {
    intent: INTENTS.SET_TIMER,
    phrases: [
      "set timer", "set the timer", "change timer",
      "timer for", "set duration", "change duration",
    ],
  },

  // ── START ATTENDANCE ──────────────────────────────────────
  {
    intent: INTENTS.START_ATTENDANCE,
    phrases: [
      "start attendance", "start the attendance", "begin attendance",
      "begin the attendance", "take attendance", "start today attendance",
      "start attendance session", "begin attendance session",
      "mark attendance", "record attendance", "open attendance",
      "launch attendance", "initiate attendance", "start class", "begin class",
    ],
  },

  // ── BIOMETRIC REGISTRATION ────────────────────────────────
  {
    intent: INTENTS.REGISTER_BIOMETRICS,
    phrases: [
      "register biometrics", "register biometrics for", "start biometric",
      "enroll biometrics", "capture biometrics", "biometric enrollment",
      "face enrollment", "register face for", "enroll face for",
      "capture face for", "start face capture", "begin face capture",
      "facial enrollment for", "facial registration for",
    ],
  },

  // ── ADD STUDENT ───────────────────────────────────────────
  {
    intent: INTENTS.ADD_STUDENT,
    phrases: [
      "add student", "add a student", "add member", "add a member",
      "new student", "create student", "new member", "create member",
      "insert student",
    ],
  },

  // ── FACE SCANNER ─────────────────────────────────────────
  {
    intent: INTENTS.START_FACE_SCANNER,
    phrases: [
      "open face scanner", "start face scanner", "scan attendance",
      "open scanner", "start scanner", "face scanner",
      "launch face scanner", "activate scanner", "enable scanner",
      "start auto scan", "scan faces", "start scanning", "start camera",
    ],
  },

  // ── CAPTURE FRAME ─────────────────────────────────────────
  {
    intent: INTENTS.CAPTURE_FRAME,
    phrases: [
      "take photo", "take a photo", "capture frame",
      "snap photo", "take picture", "take snapshot",
    ],
  },

  // ── ATTENDANCE QUERIES ────────────────────────────────────
  {
    intent: INTENTS.COUNT_PRESENT,
    phrases: [
      "how many present", "count present", "number present",
      "how many students are present", "how many are here",
      "how many showed up", "attendance count", "present count",
      "number of present students",
    ],
  },
  {
    intent: INTENTS.COUNT_ABSENT,
    phrases: [
      "how many absent", "count absent", "number absent",
      "how many students are absent", "how many are missing",
      "absent count", "who is absent", "who is missing",
    ],
  },
  {
    intent: INTENTS.CHECK_STUDENT_PRESENT,
    phrases: [
      "is present", "is here", "check if present",
      "check attendance for", "did attend", "did come",
      "has arrived",
    ],
  },
  {
    intent: INTENTS.SHOW_CURRENT_ATTENDANCE,
    phrases: [
      "show current attendance", "show attendance", "who is present",
      "show present students", "show the attendance status",
      "attendance status", "current attendance", "current status",
      "show today attendance", "who attended", "display attendance",
      "view attendance", "check attendance",
    ],
  },
  {
    intent: INTENTS.SHOW_PREVIOUS_SESSIONS,
    phrases: [
      "show previous attendance", "show attendance history",
      "show previous sessions", "previous attendance", "previous sessions",
      "attendance history", "past sessions", "past attendance",
      "session history", "old sessions",
    ],
  },

  // ── STUDENT QUERIES ───────────────────────────────────────
  {
    intent: INTENTS.COUNT_STUDENTS,
    phrases: [
      "how many students", "total students", "student count",
      "number of students", "how many members", "total members",
      "member count", "class size",
    ],
  },
  {
    intent: INTENTS.SEARCH_STUDENT,
    phrases: [
      "search student", "find student", "look up student",
      "search member", "find member",
    ],
  },
  {
    intent: INTENTS.SHOW_STUDENTS,
    phrases: [
      "show students", "list students", "show members", "list members",
      "view students", "view members", "all students", "display students",
    ],
  },

  // ── PASSWORD ──────────────────────────────────────────────
  {
    intent: INTENTS.CHANGE_TEACHER_PASSWORD,
    phrases: [
      "change teacher password", "change my password",
      "update teacher password", "teacher password",
      "change admin password", "update admin password",
    ],
  },
  {
    intent: INTENTS.RESET_STUDENT_PASSWORD,
    phrases: [
      "reset student password", "change student password",
      "update student password", "student password for",
      "reset password for", "change password for",
    ],
  },
  {
    intent: INTENTS.OPEN_PASSWORD_SETTINGS,
    phrases: [
      "open password", "password settings", "reset password",
      "change password", "forgot password", "update password",
    ],
  },

  // ── QR ────────────────────────────────────────────────────
  {
    intent: INTENTS.GRANT_QR_ACCESS,
    phrases: [
      "grant qr access", "grant qr", "give qr access",
      "allow qr", "enable qr for", "give qr to",
    ],
  },
  {
    intent: INTENTS.GENERATE_QR_FOR,
    phrases: [
      "generate qr for", "create qr for", "make qr for",
      "generate qr code for",
    ],
  },
  {
    intent: INTENTS.GENERATE_QR,
    phrases: [
      "generate qr", "create qr", "open qr generator", "qr generator",
      "generate qr code", "create qr code", "make qr code",
      "open qr", "show qr",
    ],
  },

  // ── NAVIGATION ────────────────────────────────────────────
  {
    intent: INTENTS.GO_HOME,
    phrases: [
      "go home", "go to home", "home", "dashboard",
      "go to dashboard", "main screen", "main page", "back to home",
    ],
  },
  {
    intent: INTENTS.SHOW_SHEET,
    phrases: [
      "show sheet", "open sheet", "attendance sheet",
      "show attendance sheet", "view sheet",
    ],
  },
  {
    intent: INTENTS.SHOW_VECTOR_SHEET,
    phrases: [
      "show vector sheet", "vector sheet", "biometric vectors",
      "show biometric data", "face vectors", "open vector sheet",
    ],
  },
  {
    intent: INTENTS.LOGOUT,
    phrases: [
      "logout", "log out", "sign out", "signout",
      "exit", "log off", "logoff",
    ],
  },

  // ── SYSTEM ────────────────────────────────────────────────
  {
    intent: INTENTS.SHOW_HELP,
    phrases: [
      "help", "show help", "what can you do",
      "show commands", "list commands", "available commands",
      "what commands", "command list", "show all commands",
    ],
  },
  {
    intent: INTENTS.CLEAR_CHAT,
    phrases: [
      "clear chat", "clear history", "clear messages",
      "clear conversation", "reset chat", "new chat", "start fresh",
    ],
  },
];

// ============================================================
//  FILLER WORDS (stripped before matching)
// ============================================================

const FILLER_WORDS = [
  "please", "kindly", "can you", "could you", "would you",
  "let's", "lets", "i want to", "i need to", "i'd like to",
  "can we", "now", "immediately", "quickly", "the", "a", "an",
  "me", "my",
];

// ============================================================
//  NORMALIZER
// ============================================================

function normalizeText(text) {
  if (!text || typeof text !== "string") return "";
  let n = text.toLowerCase().trim();
  n = n.replace(/[^a-z0-9\s']/g, " ").replace(/\s+/g, " ").trim();
  for (const f of FILLER_WORDS) {
    const re = new RegExp(`\\b${f.replace(/\s+/g, "\\s+")}\\b`, "gi");
    n = n.replace(re, " ");
  }
  return n.replace(/\s+/g, " ").trim();
}

// ============================================================
//  PARAMETER EXTRACTORS
// ============================================================

/** Roll number: alphanumeric (22CS101) or pure numeric after "roll" */
function extractRollNo(normalized) {
  const alphaNum = normalized.match(/\b([a-z]{1,5}\d{2,}[a-z0-9]*)\b/i);
  if (alphaNum) return alphaNum[1].toUpperCase();
  const numOnly = normalized.match(/\broll\s+(\d+)\b/i);
  if (numOnly) return numOnly[1];
  // bare number after "for" or "student"
  const bareNum = normalized.match(/(?:for|student)\s+(\d+)\b/i);
  if (bareNum) return bareNum[1];
  return null;
}

/** Student name from "for/named John Doe" before "roll/id/to" */
function extractName(originalText) {
  const namedMatch = originalText.match(/named?\s+([A-Za-z\s]+?)(?:\s+roll|\s+id|\s+to|\s*$)/i);
  if (namedMatch) return namedMatch[1].trim();
  const addMatch = originalText.match(
    /(?:add|create|new|register|remove|for)\s+(?:student|member)?\s*([A-Za-z\s]{2,})(?:\s+roll|\s+id|\s*$)/i
  );
  if (addMatch) return addMatch[1].trim();
  return null;
}

/** Hours / minutes from "set timer to 2 hours" */
function extractHours(n) { const m = n.match(/(\d+)\s*(?:hour|hr|h)\b/); return m ? parseInt(m[1], 10) : null; }
function extractMinutes(n) { const m = n.match(/(\d+)\s*(?:minute|min|m)\b/); return m ? parseInt(m[1], 10) : null; }

/** Password change: "from X to Y" */
function extractPasswordChange(originalText) {
  const m = originalText.match(/from\s+(\S+)\s+to\s+(\S+)/i);
  if (m) return { oldPass: m[1], newPass: m[2] };
  // "to X" only (new password only)
  const toOnly = originalText.match(/(?:to|as)\s+(\S+)\s*$/i);
  if (toOnly) return { newPass: toOnly[1] };
  return {};
}

/** Student password reset: "for ROLL to NEWPASS" */
function extractStudentPasswordReset(originalText) {
  // "for 22CS101 to newpass"
  const m = originalText.match(/for\s+([A-Za-z0-9]+)\s+to\s+(\S+)/i);
  if (m) return { rollNo: m[1], newPass: m[2] };
  // fall back to separate extractors
  return {};
}

/** Search query after search/find */
function extractSearchQuery(normalized) {
  const m = normalized.match(/(?:search|find|look up)\s+(?:student|member)?\s*(.+)/i);
  return m ? m[1].trim() : null;
}

// ============================================================
//  MAIN PARSER
// ============================================================

export function parseCommand(text) {
  const originalText = (text || "").trim();
  const normalized = normalizeText(originalText);

  if (!normalized) {
    return { intent: INTENTS.UNKNOWN, confidence: 0, parameters: {}, originalText };
  }

  // Sort candidates: longer phrase = more specific = higher priority
  const candidates = [];
  for (const { intent, phrases } of INTENT_PHRASES) {
    for (const phrase of phrases) {
      candidates.push({ intent, phrase: phrase.toLowerCase() });
    }
  }
  candidates.sort((a, b) => b.phrase.length - a.phrase.length);

  for (const { intent, phrase } of candidates) {
    if (normalized.includes(phrase)) {
      const parameters = {};

      switch (intent) {
        case INTENTS.ADD_STUDENT: {
          const name = extractName(originalText);
          const roll = extractRollNo(normalized);
          if (name) parameters.name = name;
          if (roll) parameters.rollNo = roll;
          break;
        }
        case INTENTS.REMOVE_STUDENT: {
          const roll = extractRollNo(normalized);
          const name = extractName(originalText);
          if (roll) parameters.rollNo = roll;
          if (name) parameters.name = name;
          break;
        }
        case INTENTS.REGISTER_BIOMETRICS: {
          const roll = extractRollNo(normalized);
          const name = extractName(originalText);
          if (roll) parameters.rollNo = roll;
          if (name) parameters.name = name;
          break;
        }
        case INTENTS.SET_TIMER: {
          const hours = extractHours(normalized);
          const minutes = extractMinutes(normalized);
          if (hours !== null) parameters.hours = hours;
          if (minutes !== null) parameters.minutes = minutes;
          break;
        }
        case INTENTS.CHECK_STUDENT_PRESENT: {
          const roll = extractRollNo(normalized);
          const name = extractName(originalText);
          if (roll) parameters.rollNo = roll;
          if (name) parameters.name = name;
          if (!roll && !name) {
            const m = originalText.match(/\bis\s+([a-z0-9]+)\s+(?:present|here)/i);
            if (m) parameters.query = m[1];
          }
          break;
        }
        case INTENTS.SEARCH_STUDENT: {
          const q = extractSearchQuery(normalized);
          if (q) parameters.query = q;
          break;
        }
        case INTENTS.CHANGE_TEACHER_PASSWORD: {
          const pc = extractPasswordChange(originalText);
          Object.assign(parameters, pc);
          break;
        }
        case INTENTS.RESET_STUDENT_PASSWORD: {
          const sp = extractStudentPasswordReset(originalText);
          if (sp.rollNo) parameters.rollNo = sp.rollNo;
          if (sp.newPass) parameters.newPass = sp.newPass;
          // fallback: just roll number
          if (!sp.rollNo) {
            const roll = extractRollNo(normalized);
            if (roll) parameters.rollNo = roll;
          }
          break;
        }
        case INTENTS.GENERATE_QR_FOR:
        case INTENTS.GRANT_QR_ACCESS: {
          const roll = extractRollNo(normalized);
          const name = extractName(originalText);
          if (roll) parameters.rollNo = roll;
          if (name) parameters.name = name;
          break;
        }
        default:
          break;
      }

      return { intent, confidence: 1, parameters, originalText };
    }
  }

  return { intent: INTENTS.UNKNOWN, confidence: 0, parameters: {}, originalText };
}

export function intentLabel(intent) {
  return (intent || "UNKNOWN").replace(/_/g, " ");
}

export function getAllCommands() {
  return {
    "Session": [
      "start attendance", "stop attendance",
      "reset timer", "set timer to 2 hours",
    ],
    "Attendance": [
      "show attendance", "who is present",
      "how many present", "how many absent",
      "is John present", "show previous sessions",
    ],
    "Scanner": [
      "open face scanner", "stop scanner", "take photo",
    ],
    "Students": [
      "add student John Doe roll 22CS101",
      "register biometrics for 22CS101",
      "remove student 22CS101",
      "show students", "how many students",
      "search student John",
    ],
    "QR": [
      "generate qr for 22CS101",
      "grant qr access to 22CS101",
      "open qr generator",
    ],
    "Password": [
      "change teacher password from admin to newpass",
      "reset student password for 22CS101 to newpass",
    ],
    "Navigation": [
      "go home", "show sheet", "show vector sheet", "logout",
    ],
    "Conversation": [
      "confirm  (approve a pending action)",
      "cancel   (abort a pending action)",
    ],
    "System": [
      "help", "clear chat",
    ],
  };
}

export function getExampleCommands() {
  return [
    "start attendance", "stop attendance",
    "add student John roll 22CS101",
    "register biometrics for 22CS101",
    "how many present", "generate qr for 22CS101",
    "confirm", "cancel", "help",
  ];
}
