import { useState, useEffect, useRef } from "react";
import DailyRhythm from "./DailyRhythm";
import TaskManager from "./TaskManager";

const SB_URL = "https://wgiybgncxnovmsyqccbu.supabase.co";
const SB_KEY = "sb_publishable_vmYb05jf9S6GH5Sp41Ztiw_q34PUyKb";

// Blue pikmin as inline SVG-ish — we use the uploaded image as a data approach
// Instead we'll use an emoji placeholder and replace with actual image
const PIKMIN_IMG = "/pikmin.png";

export default function App() {
  const [view, setView] = useState("rhythm");
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState(null);
  const [signingIn, setSigningIn] = useState(false);

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [rhythmData, setRhythmData] = useState(null);
  const [taskData, setTaskData] = useState(null);
  const chatEndRef = useRef();
  const inputRef = useRef();

  useEffect(() => {
    const stored = localStorage.getItem("sb_session");
    if (stored) {
      const s = JSON.parse(stored);
      if (s.expires_at && Date.now() / 1000 < s.expires_at) {
        setSession(s);
      } else {
        localStorage.removeItem("sb_session");
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (chatOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [chatOpen]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, thinking]);

  // Load rhythm and task data for context
  useEffect(() => {
  if (!session?.access_token) return;
  const headers = {
    apikey: SB_KEY,
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };
  const load = async () => {
    try {
      const r1 = await fetch(`${SB_URL}/rest/v1/task_store?key=eq.rhythm_v1&select=value`, { headers });
      if (r1 && r1.ok) {
        const d = await r1.json();
        if (d?.[0]) setRhythmData(JSON.parse(d[0].value));
      }
    } catch {}
    try {
      const r2 = await fetch(`${SB_URL}/rest/v1/task_store?key=eq.arch_task_state_v3&select=value`, { headers });
      if (r2 && r2.ok) {
        const d = await r2.json();
        if (d?.[0]) setTaskData(JSON.parse(d[0].value));
      }
    } catch {}
  };
  load();
}, [session]);

  const signIn = async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      const res = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SB_KEY },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error_description || data.msg || "Sign in failed");
      } else {
        localStorage.setItem("sb_session", JSON.stringify(data));
        setSession(data);
      }
    } catch {
      setAuthError("Network error — check your connection");
    }
    setSigningIn(false);
  };

  const signOut = () => { localStorage.removeItem("sb_session"); setSession(null); };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || thinking) return;
    const userMsg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setThinking(true);

    try {
      const res = await console.log("Sending data:", { rhythmData, taskData }); fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: newMessages,
          rhythmData,
          taskData,
        }),
      });

      const data = await res.json();
      const raw = data.content?.[0]?.text || "Sorry, something went wrong.";

      // Parse update blocks
      const updateMatch = raw.match(/```update\n([\s\S]*?)```/);
      const responseText = raw.replace(/```update\n[\s\S]*?```/, "").trim();

      setMessages(m => [...m, { role: "assistant", content: responseText }]);

      if (updateMatch) {
        try {
          const action = JSON.parse(updateMatch[1]);
          await applyAction(action);
        } catch {
          console.error("Error parsing update block:", e);
        }
      }
    } catch (e) {
      setMessages(m => [...m, { role: "assistant", content: `Error: ${e.message}` }]);
    }
    setThinking(false);
  };

  const applyAction = async (action) => {
    if (!taskData && !rhythmData) return;
    const headers = {
      apikey: SB_KEY,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    };

    if (action.action === "complete_subtask" && taskData) {
      const updated = {
        ...taskData,
        subtasks: {
          ...taskData.subtasks,
          [action.taskId]: (taskData.subtasks[action.taskId] || []).map(s =>
            s.id === action.subtaskId ? { ...s, done: true } : s
          ),
        },
      };
      setTaskData(updated);
      await fetch(`${SB_URL}/rest/v1/task_store`, {
        method: "POST", headers,
        body: JSON.stringify({ key: "arch_task_state_v3", value: JSON.stringify(updated), updated_at: new Date().toISOString() }),
      });
    }

    if (action.action === "set_task_status" && taskData) {
      const updated = { ...taskData, statuses: { ...taskData.statuses, [action.taskId]: action.status } };
      setTaskData(updated);
      await fetch(`${SB_URL}/rest/v1/task_store`, {
        method: "POST", headers,
        body: JSON.stringify({ key: "arch_task_state_v3", value: JSON.stringify(updated), updated_at: new Date().toISOString() }),
      });
    }

    if (action.action === "complete_care" && rhythmData) {
      const key = `${action.day}:${action.care}`;
      const updated = { ...rhythmData, careDone: { ...rhythmData.careDone, [key]: true } };
      setRhythmData(updated);
      await fetch(`${SB_URL}/rest/v1/task_store`, {
        method: "POST", headers,
        body: JSON.stringify({ key: "rhythm_v1", value: JSON.stringify(updated), updated_at: new Date().toISOString() }),
      });
    }

    if (action.action === "add_task" && taskData) {
      const newTask = { id: "t" + Date.now(), label: action.label, detail: action.detail || "", role: action.role || "Other", deadline: action.deadline || "" };
      const updated = {
        ...taskData,
        phases: taskData.phases.map(p => p.id === action.phaseId ? { ...p, tasks: [...p.tasks, newTask] } : p),
      };
      setTaskData(updated);
      await fetch(`${SB_URL}/rest/v1/task_store`, {
        method: "POST", headers,
        body: JSON.stringify({ key: "arch_task_state_v3", value: JSON.stringify(updated), updated_at: new Date().toISOString() }),
      });
    }
  };

  if (loading) return <div style={{ padding: "2rem", fontSize: 14, color: "#888" }}>Loading…</div>;

  if (!session) return (
    <div style={{ maxWidth: 360, margin: "80px auto", padding: "0 1rem", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>Sesam Tools</h1>
      <p style={{ fontSize: 13, color: "#888", marginBottom: "2rem" }}>Sign in to continue</p>
      <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 3 }}>Email</label>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") signIn(); }}
        style={{ width: "100%", fontSize: 14, padding: "8px 10px", borderRadius: 8, border: "0.5px solid #ddd", boxSizing: "border-box", marginBottom: 12 }} />
      <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 3 }}>Password</label>
      <input type="password" value={password} onChange={e => setPassword(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") signIn(); }}
        style={{ width: "100%", fontSize: 14, padding: "8px 10px", borderRadius: 8, border: "0.5px solid #ddd", boxSizing: "border-box", marginBottom: 16 }} />
      {authError && <p style={{ fontSize: 12, color: "#e53e3e", marginBottom: 12 }}>⚠ {authError}</p>}
      <button onClick={signIn} disabled={signingIn}
        style={{ width: "100%", padding: "10px", fontSize: 14, borderRadius: 8, border: "none", background: "#111", color: "#fff", cursor: "pointer", fontWeight: 500 }}>
        {signingIn ? "Signing in…" : "Sign in"}
      </button>
    </div>
  );

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "1rem", fontFamily: "sans-serif" }}>
      {/* Nav */}
      <div style={{ display: "flex", gap: 8, marginBottom: "1.5rem", alignItems: "center" }}>
        <button onClick={() => setView("rhythm")}
          style={{ flex: 1, padding: "8px", borderRadius: 8, border: "0.5px solid #ddd", background: view === "rhythm" ? "#f0f0f0" : "none", cursor: "pointer", fontSize: 13 }}>
          Daily rhythm
        </button>
        <button onClick={() => setView("tasks")}
          style={{ flex: 1, padding: "8px", borderRadius: 8, border: "0.5px solid #ddd", background: view === "tasks" ? "#f0f0f0" : "none", cursor: "pointer", fontSize: 13 }}>
          Archaeology tasks
        </button>
        <button onClick={signOut}
          style={{ padding: "8px 12px", borderRadius: 8, border: "0.5px solid #ddd", background: "none", cursor: "pointer", fontSize: 12, color: "#aaa" }}>
          Sign out
        </button>
      </div>

      {view === "rhythm" ? <DailyRhythm token={session.access_token} /> : <TaskManager token={session.access_token} />}

      {/* Floating pikmin button */}
      <button onClick={() => setChatOpen(o => !o)}
        style={{ position: "fixed", bottom: 24, right: 24, width: 56, height: 56, borderRadius: "50%", border: "none", background: "transparent", cursor: "pointer", padding: 0, zIndex: 50 }}>
        <img src={PIKMIN_IMG} alt="Open Sesam" style={{ width: 56, height: 56, objectFit: "contain", filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.25))" }} />
      </button>

      {/* Chat panel */}
      {chatOpen && (
        <div style={{ position: "fixed", bottom: 90, right: 24, width: 340, maxHeight: "70vh", borderRadius: 16, background: "rgba(255,255,255,0.88)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "0.5px solid #e0e0e0", boxShadow: "0 4px 32px rgba(0,0,0,0.12)", display: "flex", flexDirection: "column", zIndex: 50 }}>
          {/* Header */}
          <div style={{ padding: "12px 16px", borderBottom: "0.5px solid #eee", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Sesam</span>
            <button onClick={() => setChatOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", fontSize: 16 }}>✕</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.length === 0 && (
              <p style={{ fontSize: 13, color: "#aaa", margin: 0, lineHeight: 1.6 }}>
                Hi. I have your full task and rhythm data. Tell me what's going on or ask what to do next.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: "82%", padding: "8px 12px", borderRadius: 12, fontSize: 13, lineHeight: 1.6, background: m.role === "user" ? "#111" : "#f0f0f0", color: m.role === "user" ? "#fff" : "#111", borderBottomRightRadius: m.role === "user" ? 4 : 12, borderBottomLeftRadius: m.role === "assistant" ? 4 : 12 }}>
                  {m.content}
                </div>
              </div>
            ))}
            {thinking && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{ padding: "8px 12px", borderRadius: 12, borderBottomLeftRadius: 4, fontSize: 13, background: "#f0f0f0", color: "#aaa" }}>…</div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "10px 12px", borderTop: "0.5px solid #eee", display: "flex", gap: 8 }}>
            <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Ask Sesam…"
              style={{ flex: 1, fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid #ddd", background: "#fff" }} />
            <button onClick={sendMessage} disabled={thinking}
              style={{ padding: "7px 12px", borderRadius: 8, border: "none", background: "#111", color: "#fff", cursor: "pointer", fontSize: 13 }}>↑</button>
          </div>
        </div>
      )}
    </div>
  );
}