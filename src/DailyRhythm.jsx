import { useState, useEffect, useRef } from "react";

const SB_URL = "https://wgiybgncxnovmsyqccbu.supabase.co";
const STORE_KEY = "rhythm_v1";

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

const DEFAULT_FIXED = {
  Monday:    [{ t:"MPIWG + commute", h:"~8hrs incl. travel", kind:"work" }, { t:"Topology / ML class", h:"in your schedule", kind:"study" }],
  Tuesday:   [{ t:"Topology / ML class", h:"in your schedule", kind:"study" }],
  Wednesday: [{ t:"Topology / ML class", h:"in your schedule", kind:"study" }, { t:"Zoom seminar", h:"2 hrs", kind:"study" }],
  Thursday:  [{ t:"MPIWG + commute", h:"~8hrs incl. travel", kind:"work" }, { t:"Butoh", h:"20:00–22:00", kind:"body" }],
  Friday:    [{ t:"MPIWG + commute", h:"~8hrs incl. travel", kind:"work" }],
  Saturday:  [{ t:"GelisPark", h:"morning/afternoon", kind:"space" }, { t:"Flexibility class", h:"14:30–15:30", kind:"body" }],
  Sunday:    [{ t:"GelisPark", h:"as needed", kind:"space" }],
};

const KIND_STYLE = {
  work:  { bg:"#f0f0f0", text:"#555", dot:"#999",    label:"Work" },
  study: { bg:"#e8f0fe", text:"#1a56db", dot:"#1a56db", label:"Study" },
  body:  { bg:"#e8f7ee", text:"#1a7a45", dot:"#1a7a45", label:"Body" },
  space: { bg:"#fef8e7", text:"#92600a", dot:"#d97706", label:"Space" },
};
const KIND_OPTIONS = ["work","study","body","space"];

const CARE_ANCHORS = [
  "Breakfast — before anything else",
  "Time with Wangwang — 5 to 15 min",
  "Move outside or stretch 10 min",
  "Lunch",
  "Short rest — no screen",
  "Dinner with partner",
  "Pikmin Bloom walk if possible",
  "Wind down — close tasks by 23:00",
];

const FOCUS_OPTIONS = {
  phd:   "PhD — archaeology",
  study: "Topology / ML catch-up",
  admin: "Admin & email",
  space: "GelisPark",
  free:  "Rest / free time",
};

const FOCUS_STYLE = {
  phd:   { bg:"#e8f0fe", text:"#1a56db", border:"#1a56db" },
  study: { bg:"#e8f0fe", text:"#1a56db", border:"#1a56db" },
  admin: { bg:"#f0f0f0", text:"#555",    border:"#999" },
  space: { bg:"#fef8e7", text:"#92600a", border:"#d97706" },
  free:  { bg:"#f0f0f0", text:"#555",    border:"#999" },
};

const DEFAULT_FOCUSES = {
  Monday:"admin", Tuesday:"phd", Wednesday:"phd",
  Thursday:"admin", Friday:"admin", Saturday:"space", Sunday:"phd",
};

function uid() { return "u" + Date.now() + Math.random().toString(36).slice(2, 5); }

function todayName() {
  return DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
}

function isPast(timeStr, day) {
  if (day !== todayName()) return false;
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/);
  if (!match) return false;
  const endHour = parseInt(match[3], 10);
  const endMin = parseInt(match[4], 10);
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const endMinutes = endHour * 60 + endMin;
  return nowMinutes > endMinutes;
}

// Compute "What's next?" suggestions based on actual current state
function computeNextSteps(day, fixedAnchors, tasks, taskDone, careDone, focuses) {
  const suggestions = [];
  const isToday = day === todayName();
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const focus = focuses?.[day] || "free";

  // For non-today days: structural overview
  if (!isToday) {
    const anchorCount = (fixedAnchors[day] || []).length;
    const taskCount = (tasks[day] || []).length;
    if (anchorCount > 0) suggestions.push(`${anchorCount} fixed anchor${anchorCount > 1 ? "s" : ""} planned`);
    if (taskCount > 0) suggestions.push(`${taskCount} task${taskCount > 1 ? "s" : ""} planned`);
    suggestions.push(`Focus: ${FOCUS_OPTIONS[focus] || focus}`);
    return suggestions.slice(0, 3);
  }

  // Find next upcoming fixed anchor (starts in <3hrs from now)
  const todayFixed = fixedAnchors[day] || [];
  const upcoming = todayFixed
    .map(f => {
      const m = f.h?.match(/(\d{1,2}):(\d{2})/);
      if (!m) return null;
      const startMin = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
      return { ...f, startMin };
    })
    .filter(f => f && f.startMin > nowMinutes && (f.startMin - nowMinutes) <= 180)
    .sort((a, b) => a.startMin - b.startMin);

  if (upcoming.length > 0) {
    const next = upcoming[0];
    const mins = next.startMin - nowMinutes;
    const timeWord = mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}min`;
    suggestions.push(`${next.t} in ${timeWord}`);
  }

  // Care nudges based on time of day
  const careStatus = (label) => careDone[`${day}:${label}`];
  if (nowMinutes < 13 * 60 && !careStatus("Breakfast — before anything else")) {
    suggestions.push("Eat breakfast before starting anything else");
  } else if (nowMinutes >= 13 * 60 && nowMinutes < 16 * 60 && !careStatus("Lunch")) {
    suggestions.push("Lunch — eat before pushing on");
  } else if (nowMinutes >= 19 * 60 && nowMinutes < 22 * 60 && !careStatus("Dinner with partner")) {
    suggestions.push("Dinner with partner");
  } else if (nowMinutes >= 22 * 60 && !careStatus("Wind down — close tasks by 23:00")) {
    suggestions.push("Start winding down — close work by 23:00");
  }

  // Suggest based on focus + outstanding tasks
  const dayTasks = (tasks[day] || []).filter(t => !taskDone[t.id]);
  if (dayTasks.length > 0 && nowMinutes < 22 * 60) {
    if (focus === "phd") {
      suggestions.push(dayTasks.length === 1 ? `Work on: ${dayTasks[0].label}` : `${dayTasks.length} tasks — pick one to start with`);
    } else if (focus === "study") {
      suggestions.push("Topology / ML — open the notes first, decide what next once they're open");
    } else if (focus === "admin") {
      suggestions.push(dayTasks.length === 1 ? dayTasks[0].label : `${dayTasks.length} tasks today — start with the smallest`);
    } else if (dayTasks.length > 0) {
      suggestions.push(`${dayTasks.length} task${dayTasks.length > 1 ? "s" : ""} pending`);
    }
  }

  // Wangwang nudge — early/midday or evening
  if (!careStatus("Time with Wangwang — 5 to 15 min") && nowMinutes < 22 * 60) {
    suggestions.push("5 minutes with Wangwang — costs nothing");
  }

  // Default if nothing specific
  if (suggestions.length === 0) {
    if (nowMinutes >= 22 * 60) {
      suggestions.push("You've done enough today — rest");
    } else {
      suggestions.push("You're on track. Take a breath.");
    }
  }

  return suggestions.slice(0, 4);
}

export default function DailyRhythm({ token, askSesam }) {
  const SB_HEADERS = { apikey: "sb_publishable_vmYb05jf9S6GH5Sp41Ztiw_q34PUyKb", Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [day, setDay] = useState(todayName());
  const [focuses, setFocuses] = useState(DEFAULT_FOCUSES);
  const [tasks, setTasks] = useState({});
  const [taskDone, setTaskDone] = useState({});
  const [careDone, setCareDone] = useState({});
  const [fixedAnchors, setFixedAnchors] = useState(DEFAULT_FIXED);
  const [newTask, setNewTask] = useState("");
  const [showNext, setShowNext] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState("saved");
  const [editingFixed, setEditingFixed] = useState(null);
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [askingAi, setAskingAi] = useState(false);
  const [, setTick] = useState(0);
  const inputRef = useRef();

  useEffect(() => {
    const interval = setInterval(() => {
      const current = todayName();
      setDay(d => d === current ? d : current);
      setTick(t => t + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${SB_URL}/rest/v1/task_store?key=eq.${STORE_KEY}&select=value`, { headers: SB_HEADERS });
        if (res.ok) {
          const rows = await res.json();
          if (rows.length > 0) {
            const d = JSON.parse(rows[0].value);
            setFocuses(d.focuses || DEFAULT_FOCUSES);
            setTasks(d.tasks || {});
            setTaskDone(d.taskDone || {});
            setCareDone(d.careDone || {});
            setFixedAnchors(d.fixedAnchors || DEFAULT_FIXED);
          }
        }
      } catch {}
      setLoaded(true);
    })();
  }, []);

  // Reset AI suggestion when day changes
  useEffect(() => {
    setAiSuggestion("");
  }, [day]);

  const persist = async (fo, ta, td, cd, fa) => {
    setSyncStatus("saving");
    try {
      const res = await fetch(`${SB_URL}/rest/v1/task_store`, {
        method: "POST",
        headers: { ...SB_HEADERS, Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({
          key: STORE_KEY,
          value: JSON.stringify({ focuses: fo, tasks: ta, taskDone: td, careDone: cd, fixedAnchors: fa }),
          updated_at: new Date().toISOString(),
        }),
      });
      setSyncStatus(res.ok ? "saved" : "error");
    } catch { setSyncStatus("error"); }
  };

  const setFocus = (d, val) => {
    const f = { ...focuses, [d]: val };
    setFocuses(f); persist(f, tasks, taskDone, careDone, fixedAnchors);
  };

  const addTask = () => {
    const label = newTask.trim();
    if (!label) return;
    const id = uid();
    const t = { ...tasks, [day]: [...(tasks[day] || []), { id, label }] };
    setTasks(t); setNewTask(""); persist(focuses, t, taskDone, careDone, fixedAnchors);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const toggleTask = (id) => {
    const td = { ...taskDone, [id]: !taskDone[id] };
    setTaskDone(td); persist(focuses, tasks, td, careDone, fixedAnchors);
  };

  const deleteTask = (id) => {
    const t = { ...tasks, [day]: (tasks[day] || []).filter(t => t.id !== id) };
    const td = { ...taskDone }; delete td[id];
    setTasks(t); setTaskDone(td); persist(focuses, t, td, careDone, fixedAnchors);
  };

  const toggleCare = (key) => {
    const cd = { ...careDone, [key]: !careDone[key] };
    setCareDone(cd); persist(focuses, tasks, taskDone, cd, fixedAnchors);
  };

  const addAnchor = (dayName) => {
    const fa = { ...fixedAnchors, [dayName]: [...(fixedAnchors[dayName] || []), { t: "New item", h: "", kind: "work" }] };
    setFixedAnchors(fa); persist(focuses, tasks, taskDone, careDone, fa);
  };

  const updateAnchor = (dayName, index, field, value) => {
    const fa = { ...fixedAnchors, [dayName]: fixedAnchors[dayName].map((a, i) => i === index ? { ...a, [field]: value } : a) };
    setFixedAnchors(fa); persist(focuses, tasks, taskDone, careDone, fa);
  };

  const deleteAnchor = (dayName, index) => {
    const fa = { ...fixedAnchors, [dayName]: fixedAnchors[dayName].filter((_, i) => i !== index) };
    setFixedAnchors(fa); persist(focuses, tasks, taskDone, careDone, fa);
  };

  const resetAnchorsToDefault = (dayName) => {
    if (!confirm(`Reset ${dayName} anchors to default?`)) return;
    const fa = { ...fixedAnchors, [dayName]: DEFAULT_FIXED[dayName] || [] };
    setFixedAnchors(fa); persist(focuses, tasks, taskDone, careDone, fa);
  };

  const requestAiPlan = async () => {
    if (!askSesam) return;
    setAskingAi(true);
    setAiSuggestion("");
    const prompt = `It's ${new Date().toLocaleString("en-GB", { weekday: "long", hour: "2-digit", minute: "2-digit" })}. Looking at my day, what should I focus on for the next 1-2 hours? Be concrete and brief — 3-5 sentences. No update blocks, no commute lookups, just direct advice. Reference specific items from my fixed anchors, tasks, or care list.`;
    const result = await askSesam(prompt);
    setAiSuggestion(result || "Couldn't reach Sesam right now.");
    setAskingAi(false);
  };

  const dayTasks = tasks[day] || [];
  const doneTasks = dayTasks.filter(t => taskDone[t.id]).length;
  const focusVal = focuses[day] || "free";
  const fixed = fixedAnchors[day] || [];
  const careKeys = CARE_ANCHORS.map(c => `${day}:${c}`);
  const careDoneCount = careKeys.filter(k => careDone[k]).length;
  const nextSteps = computeNextSteps(day, fixedAnchors, tasks, taskDone, careDone, focuses);

  if (!loaded) return <div style={{ padding: "2rem", fontSize: 14, color: "#888" }}>Loading…</div>;

  return (
    <div style={{ fontFamily: "sans-serif", padding: "1rem 0", maxWidth: 520 }}>

      {/* Day selector */}
      <div style={{ display: "flex", gap: 6, marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {DAYS.map(d => {
          const isToday = d === todayName();
          const isSel = d === day;
          return (
            <button key={d} onClick={() => { setDay(d); setShowNext(false); setAiSuggestion(""); }}
              style={{ fontSize: 12, padding: "4px 10px", borderRadius: 8,
                border: isSel ? "0.5px solid #333" : "0.5px solid #ddd",
                background: isSel ? "#f0f0f0" : "none",
                color: isSel ? "#111" : "#888",
                cursor: "pointer", fontWeight: isToday ? 600 : 400,
                textDecoration: isToday ? "underline" : "none" }}>
              {d.slice(0, 3)}
            </button>
          );
        })}
      </div>

      {/* What's next */}
      <div style={{ marginBottom: "1.5rem" }}>
        <button onClick={() => setShowNext(s => !s)}
          style={{ width: "100%", padding: "12px 16px", borderRadius: 12,
            border: "0.5px solid #ddd", background: "#fff",
            cursor: "pointer", fontSize: 14, color: "#111", textAlign: "left",
            display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 500 }}>What's next?</span>
          <span style={{ color: "#aaa" }}>{showNext ? "▾" : "▸"}</span>
        </button>
        {showNext && (
          <div style={{ marginTop: 8, padding: "12px 16px", borderRadius: 12,
            border: "0.5px solid #eee", background: "#fafafa" }}>
            {nextSteps.map((n, i) => (
              <p key={i} style={{ margin: i === 0 ? "0 0 8px" : "8px 0", fontSize: 13, color: "#222", lineHeight: 1.6 }}>
                <span style={{ color: "#bbb", marginRight: 8 }}>{i + 1}.</span>{n}
              </p>
            ))}

            {/* Ask Sesam button + result */}
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "0.5px dashed #ddd" }}>
              {!aiSuggestion && (
                <button onClick={requestAiPlan} disabled={askingAi || !askSesam}
                  style={{ width: "100%", padding: "8px 12px", fontSize: 12, borderRadius: 8,
                    border: "0.5px solid #ddd", background: "none", cursor: "pointer", color: "#666",
                    opacity: askingAi ? 0.6 : 1 }}>
                  {askingAi ? "Sesam is thinking…" : "Ask Sesam for a deeper plan"}
                </button>
              )}
              {aiSuggestion && (
                <div>
                  <p style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>Sesam:</p>
                  <p style={{ fontSize: 13, color: "#222", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>{aiSuggestion}</p>
                  <button onClick={requestAiPlan}
                    style={{ marginTop: 8, fontSize: 11, color: "#888", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    ↻ Ask again
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Focus */}
      <div style={{ marginBottom: "1.5rem" }}>
        <p style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>Today's focus</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {Object.entries(FOCUS_OPTIONS).map(([k, label]) => {
            const s = FOCUS_STYLE[k];
            const sel = focusVal === k;
            return (
              <button key={k} onClick={() => setFocus(day, k)}
                style={{ fontSize: 12, padding: "5px 12px", borderRadius: 8,
                  border: sel ? `0.5px solid ${s.border}` : "0.5px solid #ddd",
                  background: sel ? s.bg : "none",
                  color: sel ? s.text : "#888", cursor: "pointer" }}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Fixed */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <p style={{ fontSize: 12, color: "#888", margin: 0 }}>Fixed today</p>
          <button onClick={() => setEditingFixed(day)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", fontSize: 11, padding: 0 }}>
            Edit
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {fixed.length === 0 && (
            <p style={{ fontSize: 12, color: "#bbb", margin: 0, fontStyle: "italic" }}>Nothing fixed today.</p>
          )}
          {fixed.map((f, i) => {
            const s = KIND_STYLE[f.kind] || KIND_STYLE.work;
            const past = isPast(f.h, day);
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                borderRadius: 8, background: past ? "#f5f5f5" : s.bg, border: "0.5px solid #eee",
                opacity: past ? 0.5 : 1, transition: "opacity 0.3s, background 0.3s" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: past ? "#bbb" : s.dot, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: past ? "#999" : s.text, flex: 1, textDecoration: past ? "line-through" : "none" }}>{f.t}</span>
                <span style={{ fontSize: 12, color: past ? "#bbb" : s.text, opacity: 0.7 }}>{f.h}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tasks */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <p style={{ fontSize: 12, color: "#888", margin: 0 }}>Tasks</p>
          {dayTasks.length > 0 && <span style={{ fontSize: 11, color: "#bbb" }}>{doneTasks}/{dayTasks.length}</span>}
        </div>
        {dayTasks.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ height: 3, background: "#f0f0f0", borderRadius: 99, marginBottom: 8 }}>
              <div style={{ height: 3, borderRadius: 99, background: "#1a7a45", transition: "width 0.3s",
                width: `${Math.round(doneTasks / dayTasks.length * 100)}%` }} />
            </div>
            {dayTasks.map(task => (
              <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "0.5px solid #f0f0f0" }}>
                <input type="checkbox" checked={!!taskDone[task.id]} onChange={() => toggleTask(task.id)}
                  style={{ accentColor: "#1a7a45", width: 15, height: 15, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13, lineHeight: 1.5,
                  color: taskDone[task.id] ? "#bbb" : "#111",
                  textDecoration: taskDone[task.id] ? "line-through" : "none" }}>{task.label}</span>
                <button onClick={() => deleteTask(task.id)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: 14 }}>✕</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 6 }}>
          <input ref={inputRef} value={newTask} onChange={e => setNewTask(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addTask(); }}
            placeholder="Add a task for today…"
            style={{ flex: 1, fontSize: 13, padding: "6px 10px", borderRadius: 8, border: "0.5px solid #ddd", color: "#111" }} />
          <button onClick={addTask}
            style={{ padding: "6px 14px", fontSize: 13, borderRadius: 8, border: "0.5px solid #ddd", background: "#f0f0f0", cursor: "pointer" }}>+</button>
        </div>
      </div>

      {/* Care */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <p style={{ fontSize: 12, color: "#888", margin: 0 }}>Care</p>
          <span style={{ fontSize: 11, color: "#bbb" }}>{careDoneCount}/{CARE_ANCHORS.length}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {CARE_ANCHORS.map((c, i) => {
            const key = `${day}:${c}`;
            const done = !!careDone[key];
            return (
              <div key={i} onClick={() => toggleCare(key)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px",
                  borderRadius: 8, cursor: "pointer",
                  background: done ? "#e8f7ee" : "#fff",
                  border: "0.5px solid #f0f0f0", transition: "background 0.2s" }}>
                <span style={{ fontSize: 15, color: done ? "#1a7a45" : "#ccc" }}>{done ? "✓" : "○"}</span>
                <span style={{ fontSize: 13,
                  color: done ? "#1a7a45" : "#555",
                  textDecoration: done ? "line-through" : "none" }}>{c}</span>
              </div>
            );
          })}
        </div>
      </div>

      <p style={{ fontSize: 11, color: "#bbb", textAlign: "right", margin: 0 }}>
        {syncStatus === "saving" ? "Saving…" : syncStatus === "error" ? "⚠ Sync failed" : "✓ Synced"}
      </p>

      {/* Edit fixed anchors modal */}
      {editingFixed && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setEditingFixed(null); }}>
          <div style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderRadius: 12, border: "1.5px solid #888", padding: "1.25rem", width: "100%", maxWidth: 480, maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: "1rem" }}>
              <span style={{ fontWeight: 500, fontSize: 15, flex: 1 }}>Fixed anchors — {editingFixed}</span>
              <button onClick={() => setEditingFixed(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#888" }}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
              {(fixedAnchors[editingFixed] || []).map((anchor, i) => (
                <div key={i} style={{ padding: "10px", borderRadius: 8, background: "rgba(255,255,255,0.6)", border: "0.5px solid #ddd" }}>
                  <input value={anchor.t} onChange={e => updateAnchor(editingFixed, i, "t", e.target.value)}
                    placeholder="Label (e.g. Butoh)"
                    style={{ width: "100%", fontSize: 13, padding: "5px 8px", borderRadius: 6, border: "0.5px solid #ddd", marginBottom: 6, boxSizing: "border-box" }} />
                  <div style={{ display: "flex", gap: 6 }}>
                    <input value={anchor.h} onChange={e => updateAnchor(editingFixed, i, "h", e.target.value)}
                      placeholder="Time (e.g. 20:00–22:00)"
                      style={{ flex: 2, fontSize: 13, padding: "5px 8px", borderRadius: 6, border: "0.5px solid #ddd", boxSizing: "border-box" }} />
                    <select value={anchor.kind} onChange={e => updateAnchor(editingFixed, i, "kind", e.target.value)}
                      style={{ flex: 1, fontSize: 13, padding: "5px 8px", borderRadius: 6, border: "0.5px solid #ddd" }}>
                      {KIND_OPTIONS.map(k => <option key={k} value={k}>{KIND_STYLE[k].label}</option>)}
                    </select>
                    <button onClick={() => deleteAnchor(editingFixed, i)}
                      style={{ padding: "5px 10px", borderRadius: 6, border: "0.5px solid #fcc", background: "none", cursor: "pointer", color: "#e53e3e", fontSize: 13 }}>✕</button>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={() => addAnchor(editingFixed)}
              style={{ width: "100%", padding: "8px", fontSize: 13, borderRadius: 8, border: "0.5px dashed #ccc", background: "none", cursor: "pointer", color: "#888", marginBottom: 12 }}>
              + Add new anchor
            </button>

            <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
              <button onClick={() => resetAnchorsToDefault(editingFixed)}
                style={{ padding: "7px 14px", fontSize: 12, borderRadius: 8, border: "0.5px solid #ddd", background: "none", cursor: "pointer", color: "#888" }}>
                Reset to default
              </button>
              <button onClick={() => setEditingFixed(null)}
                style={{ padding: "7px 16px", fontSize: 13, borderRadius: 8, border: "0.5px solid #888", background: "#111", cursor: "pointer", color: "#fff", fontWeight: 500 }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}