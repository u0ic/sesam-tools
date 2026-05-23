import { useState, useEffect, useRef } from "react";

const SB_URL = "https://wgiybgncxnovmsyqccbu.supabase.co";

const STORE_KEY = "rhythm_v1";

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

const FIXED = {
  Monday:    [{ t:"MPIWG + commute", h:"~8hrs incl. travel", kind:"work" }, { t:"Topology / ML class", h:"in your schedule", kind:"study" }],
  Tuesday:   [{ t:"Topology / ML class", h:"in your schedule", kind:"study" }],
  Wednesday: [{ t:"Topology / ML class", h:"in your schedule", kind:"study" }, { t:"Zoom seminar", h:"2 hrs", kind:"study" }],
  Thursday:  [{ t:"MPIWG + commute", h:"~8hrs incl. travel", kind:"work" }, { t:"Butoh", h:"20:00–22:00", kind:"body" }],
  Friday:    [{ t:"MPIWG + commute", h:"~8hrs incl. travel", kind:"work" }],
  Saturday:  [{ t:"GelisPark", h:"morning/afternoon", kind:"space" }, { t:"Flexibility class", h:"14:30–15:30", kind:"body" }],
  Sunday:    [{ t:"GelisPark", h:"as needed", kind:"space" }],
};

const KIND_STYLE = {
  work:  { bg:"#f0f0f0", text:"#555", dot:"#999" },
  study: { bg:"#e8f0fe", text:"#1a56db", dot:"#1a56db" },
  body:  { bg:"#e8f7ee", text:"#1a7a45", dot:"#1a7a45" },
  space: { bg:"#fef8e7", text:"#92600a", dot:"#d97706" },
};

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

const NEXT_LOGIC = {
  Monday:    ["Check MPIWG emails first","One admin task, then stop","Eat before leaving"],
  Tuesday:   ["Open the Wang Shixian draft","Write for 45 min before checking anything","Eat lunch before 14:00"],
  Wednesday: ["Zoom seminar prep if needed","One paragraph on Liu Heima","Rest after Zoom"],
  Thursday:  ["MPIWG, then Butoh — that's enough","No PhD work today","Eat before Butoh"],
  Friday:    ["MPIWG only — rest after","No new tasks this evening","Wind down by 23:00"],
  Saturday:  ["GelisPark first","Flexibility class at 14:30","One small admin task max"],
  Sunday:    ["Quiet morning — PhD writing only","No admin today","Rest by evening"],
};

function uid() { return "u" + Date.now() + Math.random().toString(36).slice(2, 5); }
function isPast(timeStr, day) {
  // Only grey out items on today
  if (day !== todayName()) return false;
  // Match HH:MM–HH:MM or HH:MM-HH:MM pattern (en dash or hyphen)
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/);
  if (!match) return false;
  const endHour = parseInt(match[3], 10);
  const endMin = parseInt(match[4], 10);
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const endMinutes = endHour * 60 + endMin;
  return nowMinutes > endMinutes;
}
function todayName() {
  return DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
}

export default function DailyRhythm({ token }) {
  const SB_HEADERS = { apikey: "sb_publishable_vmYb05jf9S6GH5Sp41Ztiw_q34PUyKb", Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [day, setDay] = useState(todayName());
  const [focuses, setFocuses] = useState(DEFAULT_FOCUSES);
  const [tasks, setTasks] = useState({});
  const [taskDone, setTaskDone] = useState({});
  const [careDone, setCareDone] = useState({});
  const [newTask, setNewTask] = useState("");
  const [showNext, setShowNext] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState("saved");
  const [, setTick] = useState(0);
  const inputRef = useRef();

  // Check day change and force re-render every minute
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
        const res = await fetch(
          `${SB_URL}/rest/v1/task_store?key=eq.${STORE_KEY}&select=value`,
          { headers: SB_HEADERS }
        );
        if (res.ok) {
          const rows = await res.json();
          if (rows.length > 0) {
            const d = JSON.parse(rows[0].value);
            setFocuses(d.focuses || DEFAULT_FOCUSES);
            setTasks(d.tasks || {});
            setTaskDone(d.taskDone || {});
            setCareDone(d.careDone || {});
          }
        }
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const persist = async (fo, ta, td, cd) => {
    setSyncStatus("saving");
    try {
      const res = await fetch(`${SB_URL}/rest/v1/task_store`, {
        method: "POST",
        headers: { ...SB_HEADERS, Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({
          key: STORE_KEY,
          value: JSON.stringify({ focuses: fo, tasks: ta, taskDone: td, careDone: cd }),
          updated_at: new Date().toISOString(),
        }),
      });
      setSyncStatus(res.ok ? "saved" : "error");
    } catch {
      setSyncStatus("error");
    }
  };

  const setFocus = (d, val) => {
    const f = { ...focuses, [d]: val };
    setFocuses(f); persist(f, tasks, taskDone, careDone);
  };

  const addTask = () => {
    const label = newTask.trim();
    if (!label) return;
    const id = uid();
    const t = { ...tasks, [day]: [...(tasks[day] || []), { id, label }] };
    setTasks(t); setNewTask(""); persist(focuses, t, taskDone, careDone);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const toggleTask = (id) => {
    const td = { ...taskDone, [id]: !taskDone[id] };
    setTaskDone(td); persist(focuses, tasks, td, careDone);
  };

  const deleteTask = (id) => {
    const t = { ...tasks, [day]: (tasks[day] || []).filter(t => t.id !== id) };
    const td = { ...taskDone }; delete td[id];
    setTasks(t); setTaskDone(td); persist(focuses, t, td, careDone);
  };

  const toggleCare = (key) => {
    const cd = { ...careDone, [key]: !careDone[key] };
    setCareDone(cd); persist(focuses, tasks, taskDone, cd);
  };

  const dayTasks = tasks[day] || [];
  const doneTasks = dayTasks.filter(t => taskDone[t.id]).length;
  const focusVal = focuses[day] || "free";
  const fixed = FIXED[day] || [];
  const careKeys = CARE_ANCHORS.map(c => `${day}:${c}`);
  const careDoneCount = careKeys.filter(k => careDone[k]).length;

  if (!loaded) return <div style={{ padding: "2rem", fontSize: 14, color: "#888" }}>Loading…</div>;

  return (
    <div style={{ fontFamily: "sans-serif", padding: "1rem 0", maxWidth: 520 }}>

      {/* Day selector */}
      <div style={{ display: "flex", gap: 6, marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {DAYS.map(d => {
          const isToday = d === todayName();
          const isSel = d === day;
          return (
            <button key={d} onClick={() => { setDay(d); setShowNext(false); }}
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
            {NEXT_LOGIC[day].map((n, i) => (
              <p key={i} style={{ margin: i === 0 ? "0 0 8px" : "8px 0", fontSize: 13, color: "#222", lineHeight: 1.6 }}>
                <span style={{ color: "#bbb", marginRight: 8 }}>{i + 1}.</span>{n}
              </p>
            ))}
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
      {fixed.length > 0 && (
        <div style={{ marginBottom: "1.5rem" }}>
          <p style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>Fixed today</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {fixed.map((f, i) => {
                const s = KIND_STYLE[f.kind];
                const past = isPast(f.h, day);
                return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10,
                        padding: "8px 12px", borderRadius: 8,
                        background: past ? "#f5f5f5" : s.bg, border: "0.5px solid #eee",
                        opacity: past ? 0.5 : 1, transition: "opacity 0.3s, background 0.3s" }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: past ? "#bbb" : s.dot, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: past ? "#999" : s.text, flex: 1, textDecoration: past ? "line-through" : "none" }}>{f.t}</span>
                        <span style={{ fontSize: 12, color: past ? "#bbb" : s.text, opacity: 0.7 }}>{f.h}</span>
                    </div>
                );
            })}
          </div>
        </div>
      )}

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
              <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 8,
                padding: "7px 0", borderBottom: "0.5px solid #f0f0f0" }}>
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
            style={{ flex: 1, fontSize: 13, padding: "6px 10px", borderRadius: 8,
              border: "0.5px solid #ddd", color: "#111" }} />
          <button onClick={addTask}
            style={{ padding: "6px 14px", fontSize: 13, borderRadius: 8,
              border: "0.5px solid #ddd", background: "#f0f0f0", cursor: "pointer" }}>+</button>
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
    </div>
  );
}