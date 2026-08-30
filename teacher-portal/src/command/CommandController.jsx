/**
 * CommandController.jsx
 *
 * A floating, draggable, glassmorphic AI-assistant widget that accepts typed
 * natural-language commands and controls the Attendance App.
 *
 * Features:
 *  • Glassmorphism transparent panel (backdrop blur)
 *  • Drag to reposition by clicking and dragging the header
 *  • User / Intent / Assistant / Error / Confirmation message bubbles
 *  • Session-local command history
 *  • Inline confirmation for destructive actions
 *  • STT-ready: just call submitCommand(text) from any external source
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { parseCommand, intentLabel, getExampleCommands, INTENTS } from "./commandParser";
import { executeCommand, executeConfirmed } from "./commandExecutor";

// ─── Message types ────────────────────────────────────────────────────────────
const MSG = {
  USER:         "user",
  INTENT:       "intent",
  ASSISTANT:    "assistant",
  ERROR:        "error",
  CONFIRMATION: "confirmation",
};

// ─── Initial welcome message ──────────────────────────────────────────────────
const WELCOME = {
  id: "welcome",
  type: MSG.ASSISTANT,
  text: "👋 Hi! I'm your Attendance Assistant.\n\nType a command and I'll handle it for you.\n\nTry: **start attendance**, **open face scanner**, or **show students**.",
  ts: new Date(),
};

// ─── Unique ID helper ─────────────────────────────────────────────────────────
let _uid = 0;
const uid = () => `msg-${++_uid}`;

// ─── Default panel position (bottom-right) ────────────────────────────────────
const DEFAULT_POS = { x: null, y: null }; // null = use CSS default (bottom/right)

// =============================================================================
export default function CommandController({ navigateTo, members = [], currentAttendance = [] }) {
  const [isOpen, setIsOpen]             = useState(false);
  const [input, setInput]               = useState("");
  const [messages, setMessages]         = useState([WELCOME]);
  const [isProcessing, setIsProcessing] = useState(false);

  // ── Drag state ──────────────────────────────────────────────────────────────
  const [pos, setPos]           = useState(DEFAULT_POS);
  const dragRef                 = useRef({ active: false, startX: 0, startY: 0, startPanelX: 0, startPanelY: 0 });
  const panelRef                = useRef(null);

  // ── Pending action (for CONFIRM / CANCEL voice flow) ────────────────────────
  // Stores { eventName, eventDetail } from the last requiresConfirmation result.
  const pendingActionRef = useRef(null);

  const bottomRef               = useRef(null);
  const inputRef                = useRef(null);

  // Scroll to the latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 120);
  }, [isOpen]);

  // Listen for clear-chat event from executor
  useEffect(() => {
    const onClear = () => setMessages([WELCOME]);
    window.addEventListener("command-clear-chat", onClear);
    return () => window.removeEventListener("command-clear-chat", onClear);
  }, []);

  // ── Drag handlers ───────────────────────────────────────────────────────────
  const onHeaderMouseDown = useCallback((e) => {
    if (e.button !== 0) return; // left button only
    e.preventDefault();

    const panel = panelRef.current;
    if (!panel) return;

    const rect = panel.getBoundingClientRect();
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startPanelX: rect.left,
      startPanelY: rect.top,
    };

    const onMouseMove = (e) => {
      if (!dragRef.current.active) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;

      let newX = dragRef.current.startPanelX + dx;
      let newY = dragRef.current.startPanelY + dy;

      // Clamp within viewport
      const W = window.innerWidth;
      const H = window.innerHeight;
      const pw = panel.offsetWidth;
      const ph = panel.offsetHeight;
      newX = Math.max(0, Math.min(W - pw, newX));
      newY = Math.max(0, Math.min(H - ph, newY));

      setPos({ x: newX, y: newY });
    };

    const onMouseUp = () => {
      dragRef.current.active = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, []);

  // Reset position when panel is closed
  const handleClose = () => {
    setIsOpen(false);
    setPos(DEFAULT_POS);
  };

  // ── Message push ─────────────────────────────────────────────────────────
  const pushMsg = useCallback((msgs) => {
    const arr = Array.isArray(msgs) ? msgs : [msgs];
    setMessages((prev) => [...prev, ...arr.map((m) => ({ id: uid(), ts: new Date(), ...m }))]);
  }, []);

  // ── Core command handler ─────────────────────────────────────────────────
  const submitCommand = useCallback(async (rawText) => {
    if (!rawText?.trim() || isProcessing) return;
    setIsProcessing(true);

    const parsed = parseCommand(rawText);

    // ── CONFIRM intercept ─────────────────────────────────
    // If the user says "confirm" / "yes" and there's a pending action,
    // dispatch the stored event instead of going to the executor.
    if (parsed.intent === INTENTS.CONFIRM) {
      pushMsg({ type: MSG.USER, text: rawText.trim() });
      if (pendingActionRef.current) {
        const { eventName, eventDetail = {} } = pendingActionRef.current;
        window.dispatchEvent(new CustomEvent(eventName, { detail: eventDetail }));
        pendingActionRef.current = null;
        pushMsg({ type: MSG.ASSISTANT, text: "✓ Action confirmed and executed." });
      } else {
        pushMsg({ type: MSG.ASSISTANT, text: "Nothing pending to confirm." });
      }
      setIsProcessing(false);
      return;
    }

    // ── CANCEL intercept ──────────────────────────────────
    if (parsed.intent === INTENTS.CANCEL) {
      pushMsg({ type: MSG.USER, text: rawText.trim() });
      if (pendingActionRef.current) {
        pendingActionRef.current = null;
        pushMsg({ type: MSG.ASSISTANT, text: "❌ Action cancelled." });
      } else {
        pushMsg({ type: MSG.ASSISTANT, text: "Nothing pending to cancel." });
      }
      setIsProcessing(false);
      return;
    }

    // ── Normal command flow ───────────────────────────────
    pushMsg({ type: MSG.USER, text: rawText.trim() });

    if (parsed.intent !== INTENTS.UNKNOWN) {
      pushMsg({
        type: MSG.INTENT,
        text: intentLabel(parsed.intent),
        raw: parsed.intent,
        parameters: parsed.parameters,
      });
    }

    if (parsed.intent === INTENTS.UNKNOWN) {
      pushMsg({
        type: MSG.ERROR,
        text: "I didn't understand that command.",
        suggestions: getExampleCommands(),
      });
      setIsProcessing(false);
      return;
    }

    const result = await executeCommand(parsed, { navigateTo, members, currentAttendance });

    if (result.requiresConfirmation) {
      // Store the pending action so voice "confirm" can trigger it
      pendingActionRef.current = result.confirmationPayload;
      pushMsg({
        type: MSG.CONFIRMATION,
        text: result.message,
        payload: result.confirmationPayload,
      });
      setIsProcessing(false);
      return;
    }

    pushMsg({
      type: result.success ? MSG.ASSISTANT : MSG.ERROR,
      text: result.message || "Something went wrong.",
      ...(result.success ? {} : { suggestions: getExampleCommands() }),
    });

    setIsProcessing(false);
  }, [isProcessing, navigateTo, members, currentAttendance, pushMsg]);

  // ── Confirmation button handlers (UI buttons in bubble) ─────────────────
  const handleConfirm = useCallback(async (payload) => {
    setIsProcessing(true);
    pushMsg({ type: MSG.USER, text: "Confirmed." });
    // Use the event-dispatch system
    if (payload?.eventName) {
      window.dispatchEvent(new CustomEvent(payload.eventName, { detail: payload.eventDetail || {} }));
      pendingActionRef.current = null;
      pushMsg({ type: MSG.ASSISTANT, text: "✓ Action confirmed and executed." });
    } else {
      const result = await executeConfirmed(payload);
      pushMsg({ type: result.success ? MSG.ASSISTANT : MSG.ERROR, text: result.message });
    }
    setIsProcessing(false);
  }, [pushMsg]);

  const handleCancel = useCallback((msgId) => {
    pendingActionRef.current = null;
    setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, cancelled: true } : m));
    pushMsg({ type: MSG.ASSISTANT, text: "❌ Action cancelled." });
  }, [pushMsg]);

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!input.trim()) return;
    submitCommand(input.trim());
    setInput("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  // ── Panel position style ─────────────────────────────────────────────────
  const panelPositionStyle = pos.x !== null
    ? { top: pos.y, left: pos.x, bottom: "unset", right: "unset" }
    : { bottom: 104, right: 28 };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      {/* FAB */}
      <button
        id="cmd-controller-fab"
        onClick={() => setIsOpen((o) => !o)}
        style={fabStyle}
        title="Open Attendance Assistant"
        aria-label="Open Attendance Assistant"
      >
        {isOpen
          ? <span style={{ fontSize: 22 }}>✕</span>
          : <>
              <span style={{ fontSize: 24 }}>⌨</span>
              <span style={fabLabelStyle}>Commands</span>
            </>
        }
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div
          id="cmd-controller-panel"
          ref={panelRef}
          style={{ ...panelStyle, ...panelPositionStyle }}
        >
          {/* Header — drag handle */}
          <div
            style={headerStyle}
            onMouseDown={onHeaderMouseDown}
          >
            <div style={headerTitleStyle}>
              <span style={{ fontSize: 18 }}>🤖</span>
              <span>Attendance Assistant</span>
              <span style={headerBadgeStyle}>TEXT MODE</span>
              <span style={dragHintStyle}>⠿ drag</span>
            </div>
            <button onClick={handleClose} style={closeBtnStyle} title="Close">✕</button>
          </div>

          {/* Messages */}
          <div style={messagesContainerStyle}>
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
              />
            ))}
            {isProcessing && (
              <div style={thinkingStyle}>
                <span style={dotStyle(0)} />
                <span style={dotStyle(1)} />
                <span style={dotStyle(2)} />
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <form onSubmit={handleSubmit} style={inputBarStyle}>
            <input
              ref={inputRef}
              id="cmd-controller-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a command…"
              style={inputStyle}
              disabled={isProcessing}
              autoComplete="off"
              spellCheck="false"
            />
            <button
              id="cmd-controller-submit"
              type="submit"
              disabled={isProcessing || !input.trim()}
              style={sendBtnStyle(isProcessing || !input.trim())}
            >
              ↵
            </button>
          </form>
        </div>
      )}
    </>
  );
}

// =============================================================================
//  MessageBubble
// =============================================================================
function MessageBubble({ msg, onConfirm, onCancel }) {
  const { type, text, suggestions, payload, parameters, raw, cancelled } = msg;

  if (type === MSG.USER) return (
    <div style={rowStyle("flex-end")}>
      <div style={bubbleStyle("rgba(30,41,59,0.75)", "#fff", "12px 0 12px 12px")}>
        <span style={labelStyle("rgba(148,163,184,0.9)")}>You</span>
        <div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{text}</div>
      </div>
    </div>
  );

  if (type === MSG.INTENT) return (
    <div style={rowStyle("flex-start")}>
      <div style={{ ...bubbleStyle("rgba(15,23,42,0.6)", "rgba(148,163,184,0.9)", "0 12px 12px 12px"), fontSize: 12 }}>
        <span style={labelStyle("rgba(71,85,105,0.9)")}>Intent Detected</span>
        <div style={{ marginTop: 4, color: "#22d3ee", fontFamily: "monospace", fontWeight: 700, fontSize: 13 }}>{raw}</div>
        {parameters && Object.keys(parameters).length > 0 && (
          <div style={{ marginTop: 4, color: "rgba(100,116,139,0.9)", fontSize: 11 }}>params: {JSON.stringify(parameters)}</div>
        )}
      </div>
    </div>
  );

  if (type === MSG.ASSISTANT) return (
    <div style={rowStyle("flex-start")}>
      <div style={bubbleStyle("rgba(6,78,59,0.65)", "#d1fae5", "0 12px 12px 12px")}>
        <span style={labelStyle("rgba(110,231,183,0.9)")}>Assistant</span>
        <div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}
          dangerouslySetInnerHTML={{ __html: renderMarkdownBasic(text) }} />
      </div>
    </div>
  );

  if (type === MSG.ERROR) return (
    <div style={rowStyle("flex-start")}>
      <div style={bubbleStyle("rgba(69,10,10,0.7)", "#fecaca", "0 12px 12px 12px")}>
        <span style={labelStyle("rgba(252,165,165,0.9)")}>Assistant</span>
        <div style={{ marginTop: 4 }}>{text}</div>
        {suggestions?.length > 0 && (
          <div style={{ marginTop: 10, borderTop: "1px solid rgba(127,29,29,0.5)", paddingTop: 8 }}>
            <div style={{ fontSize: 11, color: "rgba(252,165,165,0.9)", marginBottom: 6 }}>Try one of these:</div>
            {suggestions.map((s) => (
              <div key={s} style={{ fontSize: 12, color: "#f87171", marginBottom: 3 }}>• {s}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (type === MSG.CONFIRMATION) return (
    <div style={rowStyle("flex-start")}>
      <div style={bubbleStyle("rgba(67,20,7,0.7)", "#fed7aa", "0 12px 12px 12px")}>
        <span style={labelStyle("rgba(251,146,60,0.9)")}>Confirmation Required</span>
        <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}
          dangerouslySetInnerHTML={{ __html: renderMarkdownBasic(text) }} />
        {!cancelled && (
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button id={`cmd-confirm-${msg.id}`} onClick={() => onConfirm(payload)} style={confirmBtnStyle("#16a34a")}>✓ Confirm</button>
            <button id={`cmd-cancel-${msg.id}`} onClick={() => onCancel(msg.id)} style={confirmBtnStyle("#dc2626")}>✕ Cancel</button>
          </div>
        )}
        {cancelled && <div style={{ marginTop: 8, fontSize: 12, color: "#9a3412" }}>Action cancelled.</div>}
      </div>
    </div>
  );

  return null;
}

// =============================================================================
//  Markdown helper
// =============================================================================
function renderMarkdownBasic(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br/>");
}

// =============================================================================
//  STYLES
// =============================================================================

const fabStyle = {
  position: "fixed",
  bottom: 28,
  right: 28,
  zIndex: 9999,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 2,
  width: 64,
  height: 64,
  borderRadius: "50%",
  background: "linear-gradient(135deg, rgba(22,163,74,0.85) 0%, rgba(6,95,70,0.85) 100%)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.15)",
  cursor: "pointer",
  boxShadow: "0 4px 24px rgba(22,163,74,0.4)",
  transition: "transform 0.15s, box-shadow 0.15s",
};

const fabLabelStyle = {
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
};

const panelStyle = {
  position: "fixed",
  zIndex: 9998,
  width: 380,
  maxHeight: "70vh",
  display: "flex",
  flexDirection: "column",
  borderRadius: 16,
  overflow: "hidden",
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.1)",
  boxShadow: "0 8px 48px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07)",
  fontFamily: "'Segoe UI', system-ui, sans-serif",
  // Smooth position transitions while dragging
  transition: "box-shadow 0.15s",
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 16px",
  background: "linear-gradient(90deg, rgba(6,95,70,0.6) 0%, rgba(15,23,42,0.4) 100%)",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  cursor: "grab",
  userSelect: "none",
};

const headerTitleStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "rgba(240,253,244,0.95)",
  fontSize: 14,
  fontWeight: 700,
};

const headerBadgeStyle = {
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: "0.1em",
  background: "rgba(22,101,52,0.7)",
  color: "#86efac",
  padding: "2px 6px",
  borderRadius: 4,
  border: "1px solid rgba(134,239,172,0.2)",
};

const dragHintStyle = {
  fontSize: 10,
  color: "rgba(148,163,184,0.5)",
  letterSpacing: "0.05em",
  marginLeft: 4,
};

const closeBtnStyle = {
  background: "transparent",
  border: "none",
  color: "rgba(148,163,184,0.8)",
  cursor: "pointer",
  fontSize: 16,
  padding: "2px 6px",
  borderRadius: 4,
};

const messagesContainerStyle = {
  flex: 1,
  overflowY: "auto",
  padding: "12px 14px",
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const inputBarStyle = {
  display: "flex",
  gap: 8,
  padding: "12px 14px",
  borderTop: "1px solid rgba(255,255,255,0.07)",
  background: "rgba(15,23,42,0.35)",
};

const inputStyle = {
  flex: 1,
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(30,41,59,0.55)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  color: "#f1f5f9",
  fontSize: 14,
  outline: "none",
};

const sendBtnStyle = (disabled) => ({
  padding: "10px 16px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.1)",
  background: disabled ? "rgba(51,65,85,0.5)" : "rgba(22,163,74,0.75)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  color: disabled ? "rgba(100,116,139,0.8)" : "#fff",
  cursor: disabled ? "not-allowed" : "pointer",
  fontWeight: 700,
  fontSize: 18,
  transition: "background 0.15s",
});

const rowStyle = (justifyContent) => ({
  display: "flex",
  justifyContent,
  width: "100%",
});

const bubbleStyle = (bg, color, borderRadius) => ({
  maxWidth: "88%",
  padding: "10px 14px",
  borderRadius,
  background: bg,
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  border: "1px solid rgba(255,255,255,0.08)",
  color,
  fontSize: 13,
  lineHeight: 1.55,
  wordBreak: "break-word",
});

const labelStyle = (color) => ({
  fontSize: 10,
  fontWeight: 700,
  color,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  display: "block",
});

const confirmBtnStyle = (bg) => ({
  padding: "7px 14px",
  background: bg,
  color: "#fff",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13,
});

const thinkingStyle = {
  display: "flex",
  gap: 6,
  padding: "8px 12px",
  alignItems: "center",
};

const dotStyle = (i) => ({
  display: "inline-block",
  width: 7,
  height: 7,
  borderRadius: "50%",
  background: "#16a34a",
  animation: `cmd-dot-bounce 1.2s ${i * 0.2}s ease-in-out infinite`,
});

// Inject keyframes + scrollbar styles once
if (typeof document !== "undefined" && !document.getElementById("cmd-controller-styles")) {
  const style = document.createElement("style");
  style.id = "cmd-controller-styles";
  style.textContent = `
    @keyframes cmd-dot-bounce {
      0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
      40%            { transform: translateY(-6px); opacity: 1; }
    }
    #cmd-controller-panel ::-webkit-scrollbar { width: 4px; }
    #cmd-controller-panel ::-webkit-scrollbar-track { background: transparent; }
    #cmd-controller-panel ::-webkit-scrollbar-thumb { background: rgba(51,65,85,0.6); border-radius: 4px; }
    #cmd-controller-fab:hover { transform: scale(1.08); box-shadow: 0 6px 32px rgba(22,163,74,0.55); }
    #cmd-controller-panel [style*="cursor: grab"]:active { cursor: grabbing; }
  `;
  document.head.appendChild(style);
}
