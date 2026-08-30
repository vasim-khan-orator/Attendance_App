/**
 * commandExecutor.js
 *
 * Receives a parsed intent and executes the corresponding action.
 *
 * ─── Confirmation System ─────────────────────────────────────────────────────
 * When an action needs confirmation before executing (e.g. form submit, delete),
 * the executor returns:
 *   { success: true, requiresConfirmation: true, message: "…", confirmationPayload: { … } }
 *
 * confirmationPayload shape:
 *   {
 *     eventName: "command-submit-add-member",   // window event to dispatch on CONFIRM
 *     eventDetail: { name: "John", rollNo: "22" }, // detail for that event
 *   }
 *
 * CommandController stores this as pendingAction. When the user says "confirm" /
 * "cancel", it dispatches that event (or clears the pending action).
 *
 * ─── Timer Events ────────────────────────────────────────────────────────────
 * command-start-timer, command-stop-timer, command-reset-timer, command-set-timer
 * are handled in DashboardContent (always mounted). Timer.jsx just displays.
 */

import axios from "axios";
import { API_BASE_URL } from "../config";
import { INTENTS, getAllCommands } from "./commandParser";

// ============================================================
//  HELPERS
// ============================================================

async function apiGet(path) {
  const res = await axios.get(`${API_BASE_URL}${path}`);
  return res.data;
}

function dispatch(eventName, detail = {}) {
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
}

function err(msg) { return { success: false, message: msg }; }
function ok(msg) { return { success: true, message: msg }; }

function extractErrorMsg(e) {
  if (!e) return "";
  if (e.response?.data?.detail) return e.response.data.detail;
  return e.message || "Check that the backend is running.";
}

/** Resolve a roll number from context members using name match */
function resolveRollNo(parameters, members = []) {
  if (parameters.rollNo) return parameters.rollNo;
  if (parameters.name && members.length) {
    const q = parameters.name.toLowerCase();
    const found = members.find((m) =>
      (m.name || m.roll_no || "").toLowerCase().includes(q)
    );
    return found ? (found.roll_no || found.rollNo) : null;
  }
  return null;
}

// ============================================================
//  EXECUTOR
// ============================================================

export async function executeCommand(parsed, context = {}) {
  const { intent, parameters } = parsed;
  const { navigateTo, members = [], currentAttendance = [] } = context;

  switch (intent) {

    // ── SESSION / TIMER ─────────────────────────────────────
    case INTENTS.START_ATTENDANCE:
      dispatch("command-start-timer");
      return ok("✓ Attendance session started. Timer is now running.");

    case INTENTS.STOP_ATTENDANCE:
      dispatch("command-stop-timer");
      return ok("✓ Attendance session stopped and archived.");

    case INTENTS.RESET_TIMER:
      dispatch("command-reset-timer");
      return ok("✓ Timer reset to default (10 hours).");

    case INTENTS.SET_TIMER: {
      const { hours = 0, minutes = 0 } = parameters;
      const secs = hours * 3600 + minutes * 60;
      if (secs <= 0) return err("Specify a duration — e.g. **set timer to 2 hours** or **45 minutes**.");
      dispatch("command-set-timer", { seconds: secs });
      const label = hours > 0 && minutes > 0 ? `${hours}h ${minutes}m`
        : hours > 0 ? `${hours}h` : `${minutes}m`;
      return ok(`✓ Timer set to ${label}.`);
    }

    // ── ATTENDANCE QUERIES ──────────────────────────────────
    case INTENTS.SHOW_CURRENT_ATTENDANCE:
      if (navigateTo) navigateTo("Status", "CurrentStatus");
      try {
        const data = await apiGet("/attendance/current");
        const n = Array.isArray(data) ? data.length : "?";
        return ok(`✓ Current attendance — **${n} student(s) present**.`);
      } catch { return ok("✓ Navigated to Current Status."); }

    case INTENTS.SHOW_PREVIOUS_SESSIONS:
      if (navigateTo) navigateTo("Status", "PreviousStatus");
      return ok("✓ Opened Previous Sessions.");

    case INTENTS.COUNT_PRESENT: {
      try {
        const data = await apiGet("/attendance/current");
        return ok(`📋 **${Array.isArray(data) ? data.length : 0} student(s)** currently present.`);
      } catch (e) { return err(`Could not fetch attendance. ${extractErrorMsg(e)}`); }
    }

    case INTENTS.COUNT_ABSENT: {
      try {
        const [att, mem] = await Promise.all([apiGet("/attendance/current"), apiGet("/members")]);
        const present = Array.isArray(att) ? att.length : 0;
        const total   = Array.isArray(mem) ? mem.length : 0;
        return ok(`📋 **${total - present} absent** out of ${total} (${present} present).`);
      } catch (e) { return err(`Could not fetch data. ${extractErrorMsg(e)}`); }
    }

    case INTENTS.CHECK_STUDENT_PRESENT: {
      const q = parameters.rollNo || parameters.name || parameters.query;
      if (!q) return err("Specify a student — e.g. **is 22CS101 present** or **is John here**.");
      try {
        const data = await apiGet("/attendance/current");
        const ql = q.toLowerCase();
        const found = Array.isArray(data) && data.find(
          (r) => (r.roll_no || "").toLowerCase().includes(ql) || (r.name || "").toLowerCase().includes(ql)
        );
        return ok(found
          ? `✅ **${found.name || found.roll_no}** is **present**.`
          : `❌ **${q}** is **not present** (or not in today's session).`
        );
      } catch (e) { return err(`Could not check. ${extractErrorMsg(e)}`); }
    }

    // ── SCANNER ─────────────────────────────────────────────
    case INTENTS.START_FACE_SCANNER:
      dispatch("command-start-scanner");
      return ok("✓ Face scanner activated. Make sure the timer is running first.");

    case INTENTS.STOP_FACE_SCANNER:
      dispatch("command-stop-scanner");
      return ok("✓ Face scanner stopped.");

    case INTENTS.CAPTURE_FRAME:
      dispatch("command-capture-frame");
      return ok("✓ Capture triggered.");

    // ── ADD STUDENT ──────────────────────────────────────────
    case INTENTS.ADD_STUDENT: {
      if (navigateTo) navigateTo("Members", "AddMember");
      const { name, rollNo } = parameters;

      if (name && rollNo) {
        // Fill the form — do NOT auto-submit; ask for confirmation first
        setTimeout(() => dispatch("command-fill-add-member", { name, rollNo }), 150);
        return {
          success: true,
          requiresConfirmation: true,
          message: `Ready to add **${name}** (roll: **${rollNo}**).\nConfirm to submit the form.`,
          confirmationPayload: {
            eventName: "command-submit-add-member",
            eventDetail: {},
          },
        };
      }

      if (name || rollNo) {
        // Partial info — fill what we have, ask user to say "confirm" when ready
        setTimeout(() => dispatch("command-fill-add-member", { name: name || "", rollNo: rollNo || "" }), 150);
        return ok(`✓ Partially filled Add Member form (${name ? `name: **${name}**` : ""}${rollNo ? ` roll: **${rollNo}**` : ""}). Fill the rest and say **confirm** to submit.`);
      }

      return ok("✓ Opened Add Member form. Say the name and roll number.");
    }

    // ── REGISTER BIOMETRICS ──────────────────────────────────
    case INTENTS.REGISTER_BIOMETRICS: {
      if (navigateTo) navigateTo("Members", "BiometricRegistration");
      const rollNo = resolveRollNo(parameters, members);

      if (rollNo) {
        // Fill roll number and auto-start capture after mount delay
        setTimeout(() => dispatch("command-start-biometric", { rollNo }), 400);
        return ok(`✓ Opening Biometric Registration for **${rollNo}**.\nCamera will auto-start the 3-pose capture — please look at the camera.`);
      }

      return ok("✓ Opened Biometric Registration. Say the roll number, e.g. **register biometrics for 22CS101**.");
    }

    // ── REMOVE STUDENT ──────────────────────────────────────
    case INTENTS.REMOVE_STUDENT: {
      const rollNo = resolveRollNo(parameters, members);

      if (rollNo) {
        if (navigateTo) navigateTo("Members", "RemoveMember");
        setTimeout(() => dispatch("command-fill-remove-member", { rollNo }), 150);
        return {
          success: true,
          requiresConfirmation: true,
          message: `⚠️ About to remove student **${rollNo}**.\nThis will delete their record and revoke login access. Confirm?`,
          confirmationPayload: {
            eventName: "command-submit-remove-member",
            eventDetail: { rollNo },
          },
        };
      }

      if (navigateTo) navigateTo("Members", "RemoveMember");
      return ok("✓ Opened Remove Member. Say the roll number, e.g. **remove student 22CS101**.");
    }

    // ── STUDENT QUERIES ─────────────────────────────────────
    case INTENTS.SHOW_STUDENTS:
      if (navigateTo) navigateTo("Members", "Sheet");
      return ok("✓ Opened Members Sheet.");

    case INTENTS.COUNT_STUDENTS: {
      try {
        const data = await apiGet("/members");
        return ok(`👥 Total registered students: **${Array.isArray(data) ? data.length : 0}**.`);
      } catch { return ok(`👥 Total students (cached): **${members.length}**.`); }
    }

    case INTENTS.SEARCH_STUDENT: {
      if (navigateTo) navigateTo("Members", "Sheet");
      if (parameters.query) {
        setTimeout(() => dispatch("command-search-student", { query: parameters.query }), 150);
        return ok(`✓ Searching for **"${parameters.query}"** in Members Sheet.`);
      }
      return ok("✓ Opened Members Sheet. Type in the search box to filter.");
    }

    // ── PASSWORD ────────────────────────────────────────────
    case INTENTS.CHANGE_TEACHER_PASSWORD: {
      if (navigateTo) navigateTo("Settings", "Password");
      const { oldPass, newPass } = parameters;

      if (oldPass && newPass) {
        setTimeout(() => dispatch("command-fill-teacher-password", { oldPass, newPass }), 150);
        return {
          success: true,
          requiresConfirmation: true,
          message: `🔐 Ready to change teacher password.\nOld: **${oldPass}** → New: **${newPass}**\nConfirm to submit.`,
          confirmationPayload: {
            eventName: "command-submit-teacher-password",
            eventDetail: {},
          },
        };
      }

      return ok("✓ Opened Password Settings. Say: **change teacher password from [old] to [new]**.");
    }

    case INTENTS.RESET_STUDENT_PASSWORD: {
      if (navigateTo) navigateTo("Settings", "Password");
      const { rollNo, newPass } = parameters;

      if (rollNo && newPass) {
        setTimeout(() => dispatch("command-fill-student-password", { rollNo, newPass }), 150);
        return {
          success: true,
          requiresConfirmation: true,
          message: `🔐 Ready to reset password for **${rollNo}** → New: **${newPass}**\nConfirm to submit.`,
          confirmationPayload: {
            eventName: "command-submit-student-password",
            eventDetail: {},
          },
        };
      }

      if (rollNo) {
        setTimeout(() => dispatch("command-fill-student-password", { rollNo, newPass: "" }), 150);
        return ok(`✓ Student roll **${rollNo}** filled. Now say the new password.`);
      }

      return ok("✓ Opened Password Settings. Say: **reset student password for [roll] to [newpass]**.");
    }

    case INTENTS.OPEN_PASSWORD_SETTINGS:
      if (navigateTo) navigateTo("Settings", "Password");
      return ok("✓ Opened Password Settings.");

    // ── QR ──────────────────────────────────────────────────
    case INTENTS.GENERATE_QR_FOR: {
      if (navigateTo) navigateTo("Settings", "QRGenerator");
      const rollNo = resolveRollNo(parameters, members);
      if (rollNo) {
        setTimeout(() => dispatch("command-generate-qr", { rollNo }), 150);
        return ok(`✓ Generating QR code for **${rollNo}**…`);
      }
      return ok("✓ Opened QR Generator. Say **generate qr for [roll]** to generate.");
    }

    case INTENTS.GRANT_QR_ACCESS: {
      if (navigateTo) navigateTo("Settings", "QRGenerator");
      const rollNo = resolveRollNo(parameters, members);
      if (rollNo) {
        setTimeout(() => dispatch("command-grant-qr-access", { rollNo }), 150);
        return ok(`✓ Granting QR access to **${rollNo}**…`);
      }
      return ok("✓ Opened QR Generator. Say **grant qr access to [roll]** to grant access.");
    }

    case INTENTS.GENERATE_QR:
      if (navigateTo) navigateTo("Settings", "QRGenerator");
      return ok("✓ Opened QR Generator.");

    // ── NAVIGATION ──────────────────────────────────────────
    case INTENTS.GO_HOME:
      if (navigateTo) navigateTo("Status", "CurrentStatus");
      return ok("✓ Back to Home.");

    case INTENTS.SHOW_SHEET:
      if (navigateTo) navigateTo("Members", "Sheet");
      return ok("✓ Opened Attendance Sheet.");

    case INTENTS.SHOW_VECTOR_SHEET:
      if (navigateTo) navigateTo("Members", "VectorSheet");
      return ok("✓ Opened Vector Sheet.");

    case INTENTS.LOGOUT:
      dispatch("command-logout");
      return ok("✓ Logging out…");

    // ── SYSTEM ──────────────────────────────────────────────
    case INTENTS.SHOW_HELP: {
      const groups = getAllCommands();
      const lines = Object.entries(groups)
        .map(([s, cmds]) => `**${s}:**\n${cmds.map((c) => `  • ${c}`).join("\n")}`)
        .join("\n\n");
      return ok(`Here's everything I can do:\n\n${lines}`);
    }

    case INTENTS.CLEAR_CHAT:
      dispatch("command-clear-chat");
      return ok("✓ Chat cleared.");

    // ── CONFIRM / CANCEL (handled in CommandController) ──────
    // These intents never reach here — CommandController intercepts them first.
    // They're listed here only as documentation / fallback.
    case INTENTS.CONFIRM:
      return err("Nothing to confirm right now.");

    case INTENTS.CANCEL:
      return ok("Nothing pending to cancel.");

    default:
      return { success: false, message: null };
  }
}

// ============================================================
//  CONFIRMED DESTRUCTIVE ACTIONS (legacy keep for safety)
// ============================================================

export async function executeConfirmed(payload) {
  // New system uses event dispatch — this is kept for any legacy callers
  if (payload.eventName) {
    dispatch(payload.eventName, payload.eventDetail || {});
    return ok("✓ Action dispatched.");
  }
  return { success: false, message: "Nothing to confirm." };
}
