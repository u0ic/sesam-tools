import { useState, useEffect, useRef } from "react";

const SB_URL = "https://wgiybgncxnovmsyqccbu.supabase.co";

const STORE_KEY = "arch_task_state_v3";

const INIT_PHASES = [
  { id: "phase1", label: "Today – Mon May 26", urgency: "danger", tasks: [
    { id: "t1", label: "Wang Shixian section", detail: "Sharpen the argument — multi-institutional excavation as epistemic/political filter", role: "Case Studies", deadline: "Mon May 26" },
    { id: "t2", label: "Liu Heima section", detail: "Add Majiayuan M21 case; molecular analysis selection as knowledge-production argument", role: "Case Studies", deadline: "Mon May 26" },
  ]},
  { id: "phase2", label: "May 26 – Mid June", urgency: "warning", tasks: [
    { id: "t3", label: "Puppetry project proposal", detail: "Open call — runs parallel to case study work", role: "Parallel", deadline: "Mid June" },
    { id: "t4", label: "Database tracking system", detail: "Externalize out of your head; document column headers, flags, known gaps", role: "Dataset / DH", deadline: "Mid June" },
  ]},
  { id: "phase3", label: "Mid June – End of June", urgency: "info", tasks: [
    { id: "t5", label: "Final draft — both case studies", detail: "Wang Shixian + Liu Heima; share incrementally with Schaefer, not as one drop", role: "Case Studies", deadline: "End of June" },
    { id: "t6", label: "Full dataset explanation for DH", detail: "Draft alongside final case studies. Include source log, interpretive choices, known gaps", role: "Dataset / DH", deadline: "End of June" },
  ]},
];

const INIT_NOTES = {
  t1: "Argument: fragmented 1972–1990 excavation (three institutions, missing records) is not incidental — it reflects how knowledge was produced under specific administrative conditions. Inconsistent textile treatment in 1982 jianbao = a window into a field negotiating what counts as evidence.",
  t2: "Argument: selection of degraded fragments for molecular analysis reveals what archaeological practice values. Silk identification is agricultural, economic, technological presence + national image. Does chronological primacy constrain practice?",
  t3: "",
  t4: "Checklist: consistent column headers, ambiguous entries flagged, source log (record origin, entry date, flags), notes sheet documenting gaps and interpretive choices.",
  t5: "Work from material outward toward framework — not the other way around. Bracketed notes = working hypotheses, not omissions.",
  t6: "Every dataset: source log, self-check on headers, document what the data cannot tell DH collaborators.",
};

const INIT_SUBTASKS = {
  t1: [
    { id: "s1a", label: "Review 1982 jianbao inconsistencies", done: false },
    { id: "s1b", label: "Draft institutional context section", done: false },
    { id: "s1c", label: "Tie to Schaefer fabric-of-time framework", done: false },
  ],
  t2: [
    { id: "s2a", label: "Integrate Majiayuan M21 material", done: false },
    { id: "s2b", label: "Develop molecular analysis selection argument", done: false },
    { id: "s2c", label: "Address chronological primacy critique", done: false },
  ],
  t4: [
    { id: "s4a", label: "Define column headers across all datasets", done: false },
    { id: "s4b", label: "Set up source log template", done: false },
    { id: "s4c", label: "Document known gaps and interpretive choices", done: false },
    { id: "s4d", label: "Flag ambiguous entries visibly", done: false },
  ],
};

const URGENCY_COLOR = { danger: "#e53e3e", warning: "#d97706", info: "#1a56db" };

const ROLE_STYLE = {
  "Case Studies": { bg: "#e8f0fe", text: "#1a56db" },
  "Dataset / DH": { bg: "#e8f7ee", text: "#1a7a45" },
  "Parallel":     { bg: "#fef8e7", text: "#92600a" },
  "Other":        { bg: "#f0f0f0", text: "#555" },
};

const STATUS_STYLE = {
  "Not started": { bg: "#f0f0f0", text: "#555" },
  "In progress": { bg: "#e8f0fe", text: "#1a56db" },
  "Blocked":     { bg: "#fff0f0", text: "#e53e3e" },
  "Done":        { bg: "#e8f7ee", text: "#1a7a45" },
};

const STATUS_OPTIONS = ["Not started", "In progress", "Blocked", "Done"];
const ROLE_OPTIONS = ["Case Studies", "Dataset / DH", "Parallel", "Other"];
const URGENCY_OPTIONS = [
  { val: "danger",  label: "Urgent (red)" },
  { val: "warning", label: "Upcoming (amber)" },
  { val: "info",    label: "Planned (blue)" },
];

function uid() { return "x" + Date.now() + Math.random().toString(36).slice(2, 5); }

const fld = { width: "100%", fontSize: 13, borderRadius: 8, padding: "7px 10px", boxSizing: "border-box", marginBottom: 8, border: "0.5px solid rgba(0,0,0,0.15)", background: "rgba(255,255,255,0.6)" };
const lbl = { fontSize: 12, color: "#666", display: "block", marginBottom: 3 };

function Modal({ title, onClose, accentColor, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "rgba(255,255,255,0.88)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderRadius: 12, border: `1.5px solid ${accentColor}`, borderTop: `4px solid ${accentColor}`, padding: "1.25rem", width: "100%", maxWidth: 480, boxShadow: "0 2px 24px rgba(0,0,0,0.10)" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: "1rem" }}>
          <span style={{ fontWeight: 500, fontSize: 15, flex: 1 }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#888" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SubtaskRow({ sub, onToggle, onDelete, onRename }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(sub.label);
  const inp = useRef();
  useEffect(() => { if (editing) inp.current?.focus(); }, [editing]);
  const commit = () => { if (val.trim()) onRename(val.trim()); setEditing(false); };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "0.5px solid #f0f0f0" }}>
      <input type="checkbox" checked={sub.done} onChange={onToggle} style={{ accentColor: "#1a7a45", width: 15, height: 15, flexShrink: 0 }} />
      {editing ? (
        <input ref={inp} value={val} onChange={e => setVal(e.target.value)}
          onBlur={commit} onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          style={{ flex: 1, fontSize: 13, padding: "2px 6px", borderRadius: 6, border: "0.5px solid #ddd" }} />
      ) : (
        <span onDoubleClick={() => setEditing(true)} style={{ flex: 1, fontSize: 13, cursor: "text", lineHeight: 1.5, color: sub.done ? "#bbb" : "#111", textDecoration: sub.done ? "line-through" : "none" }}>{sub.label}</span>
      )}
      <button onClick={() => setEditing(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: 12 }}>✎</button>
      <button onClick={onDelete} style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: 13 }}>✕</button>
    </div>
  );
}

export default function TaskManager({ token }) {  
  const SB_HEADERS = { apikey: "sb_publishable_vmYb05jf9S6GH5Sp41Ztiw_q34PUyKb", Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const [phases, setPhases] = useState(INIT_PHASES);
  const [statuses, setStatuses] = useState({});
  const [notes, setNotes] = useState({});
  const [subtasks, setSubtasks] = useState({});
  const [expanded, setExpanded] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState("saved");
  const [newSubtask, setNewSubtask] = useState({});
  const [taskModal, setTaskModal] = useState(null);
  const [phaseModal, setPhaseModal] = useState(null);
  const [taskForm, setTaskForm] = useState({});
  const [phaseForm, setPhaseForm] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${SB_URL}/rest/v1/task_store?key=eq.${STORE_KEY}&select=value`, { headers: SB_HEADERS });
        if (res.ok) {
          const rows = await res.json();
          if (rows.length > 0) {
            const d = JSON.parse(rows[0].value);
            setPhases(d.phases || INIT_PHASES);
            setStatuses(d.statuses || {});
            setNotes(d.notes || INIT_NOTES);
            setSubtasks(d.subtasks || INIT_SUBTASKS);
          } else {
            setNotes(INIT_NOTES); setSubtasks(INIT_SUBTASKS);
          }
        } else {
          setNotes(INIT_NOTES); setSubtasks(INIT_SUBTASKS);
        }
      } catch { setNotes(INIT_NOTES); setSubtasks(INIT_SUBTASKS); }
      setLoaded(true);
    })();
  }, []);

  const persist = async (ph, st, no, sub) => {
    setSyncStatus("saving");
    try {
      const res = await fetch(`${SB_URL}/rest/v1/task_store`, {
        method: "POST",
        headers: { ...SB_HEADERS, Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({ key: STORE_KEY, value: JSON.stringify({ phases: ph, statuses: st, notes: no, subtasks: sub }), updated_at: new Date().toISOString() }),
      });
      setSyncStatus(res.ok ? "saved" : "error");
    } catch { setSyncStatus("error"); }
  };

  const update = (ph, st, no, sub) => { setPhases(ph); setStatuses(st); setNotes(no); setSubtasks(sub); persist(ph, st, no, sub); };
  const setStatus = (id, val) => { const s = { ...statuses, [id]: val }; setStatuses(s); persist(phases, s, notes, subtasks); };
  const setNote = (id, val) => { const n = { ...notes, [id]: val }; setNotes(n); persist(phases, statuses, n, subtasks); };

  const addSubtask = (tid) => {
    const label = (newSubtask[tid] || "").trim();
    if (!label) return;
    const next = { ...subtasks, [tid]: [...(subtasks[tid] || []), { id: uid(), label, done: false }] };
    setSubtasks(next); setNewSubtask(s => ({ ...s, [tid]: "" })); persist(phases, statuses, notes, next);
  };
  const toggleSubtask = (tid, sid) => {
    const next = { ...subtasks, [tid]: subtasks[tid].map(s => s.id === sid ? { ...s, done: !s.done } : s) };
    setSubtasks(next); persist(phases, statuses, notes, next);
  };
  const deleteSubtask = (tid, sid) => {
    const next = { ...subtasks, [tid]: (subtasks[tid] || []).filter(s => s.id !== sid) };
    setSubtasks(next); persist(phases, statuses, notes, next);
  };
  const renameSubtask = (tid, sid, label) => {
    const next = { ...subtasks, [tid]: subtasks[tid].map(s => s.id === sid ? { ...s, label } : s) };
    setSubtasks(next); persist(phases, statuses, notes, next);
  };

  const openAddTask = (phaseId) => { setTaskForm({ label: "", detail: "", role: "Case Studies", deadline: "" }); setTaskModal({ mode: "add", phaseId }); };
  const openEditTask = (phaseId, task) => { setTaskForm({ label: task.label, detail: task.detail, role: task.role, deadline: task.deadline }); setTaskModal({ mode: "edit", phaseId, task }); };
  const saveTask = () => {
    if (!taskForm.label.trim()) return;
    const ph = taskModal.mode === "add"
      ? phases.map(p => p.id === taskModal.phaseId ? { ...p, tasks: [...p.tasks, { id: uid(), ...taskForm }] } : p)
      : phases.map(p => p.id === taskModal.phaseId ? { ...p, tasks: p.tasks.map(t => t.id === taskModal.task.id ? { ...t, ...taskForm } : t) } : p);
    update(ph, statuses, notes, subtasks); setTaskModal(null);
  };
  const deleteTask = (phaseId, taskId) => {
    const ph = phases.map(p => p.id === phaseId ? { ...p, tasks: p.tasks.filter(t => t.id !== taskId) } : p);
    const st = { ...statuses }; delete st[taskId];
    const no = { ...notes }; delete no[taskId];
    const sub = { ...subtasks }; delete sub[taskId];
    update(ph, st, no, sub); setConfirmDelete(null);
  };
  const openAddPhase = () => { setPhaseForm({ label: "", urgency: "info" }); setPhaseModal({ mode: "add" }); };
  const openEditPhase = (ph) => { setPhaseForm({ label: ph.label, urgency: ph.urgency }); setPhaseModal({ mode: "edit", phase: ph }); };
  const savePhase = () => {
    if (!phaseForm.label.trim()) return;
    const ph = phaseModal.mode === "add"
      ? [...phases, { id: uid(), label: phaseForm.label, urgency: phaseForm.urgency, tasks: [] }]
      : phases.map(p => p.id === phaseModal.phase.id ? { ...p, ...phaseForm } : p);
    update(ph, statuses, notes, subtasks); setPhaseModal(null);
  };
  const deletePhase = (phaseId) => {
    const phase = phases.find(p => p.id === phaseId);
    const ph = phases.filter(p => p.id !== phaseId);
    const st = { ...statuses }, no = { ...notes }, sub = { ...subtasks };
    (phase?.tasks || []).forEach(t => { delete st[t.id]; delete no[t.id]; delete sub[t.id]; });
    update(ph, st, no, sub); setConfirmDelete(null);
  };

  const allTasks = phases.flatMap(p => p.tasks);
  const done = allTasks.filter(t => statuses[t.id] === "Done").length;
  const inProg = allTasks.filter(t => statuses[t.id] === "In progress").length;
  const pct = allTasks.length ? Math.round(done / allTasks.length * 100) : 0;

  if (!loaded) return <div style={{ padding: "2rem", fontSize: 14, color: "#888" }}>Loading…</div>;

  return (
    <div style={{ fontFamily: "sans-serif", padding: "1rem 0" }}>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: "1.25rem" }}>
        {[{ label: "Total", val: allTasks.length }, { label: "In progress", val: inProg }, { label: "Done", val: `${done}/${allTasks.length}` }].map(m => (
          <div key={m.label} style={{ background: "#f8f8f8", borderRadius: 8, padding: "12px 14px" }}>
            <p style={{ margin: 0, fontSize: 12, color: "#888" }}>{m.label}</p>
            <p style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 500, color: "#111" }}>{m.val}</p>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div style={{ marginBottom: "1.75rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: "#888" }}>Overall progress</span>
          <span style={{ fontSize: 12, fontWeight: 500 }}>{pct}%</span>
        </div>
        <div style={{ height: 6, background: "#f0f0f0", borderRadius: 99 }}>
          <div style={{ height: 6, width: `${pct}%`, background: "#1a7a45", borderRadius: 99, transition: "width 0.4s" }} />
        </div>
      </div>

      {/* Phases */}
      {phases.map(phase => {
        const phaseDone = phase.tasks.filter(t => statuses[t.id] === "Done").length;
        return (
          <div key={phase.id} style={{ marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 3, height: 18, background: URGENCY_COLOR[phase.urgency], borderRadius: 2, flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>{phase.label}</span>
              <span style={{ fontSize: 12, color: "#aaa", marginLeft: "auto" }}>{phaseDone}/{phase.tasks.length}</span>
              <button onClick={() => openEditPhase(phase)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: 14 }} title="Edit phase">✎</button>
              <button onClick={() => setConfirmDelete({ type: "phase", id: phase.id })} style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: 14 }} title="Delete phase">🗑</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {phase.tasks.map(task => {
                const status = statuses[task.id] || "Not started";
                const isOpen = expanded[task.id];
                const st = STATUS_STYLE[status];
                const rc = ROLE_STYLE[task.role] || ROLE_STYLE["Other"];
                const subs = subtasks[task.id] || [];
                const subsDone = subs.filter(s => s.done).length;
                return (
                  <div key={task.id} style={{ background: "#fff", border: "0.5px solid #eee", borderRadius: 12, overflow: "hidden" }}>
                    <div onClick={() => setExpanded(e => ({ ...e, [task.id]: !e[task.id] }))} style={{ padding: "12px 14px", cursor: "pointer" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ color: "#aaa", fontSize: 13, flexShrink: 0 }}>{isOpen ? "▾" : "▸"}</span>
                        <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{task.label}</span>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: rc.bg, color: rc.text, flexShrink: 0 }}>{task.role}</span>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: st.bg, color: st.text, flexShrink: 0 }}>{status}</span>
                      </div>
                      {!isOpen && subs.length > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                          <div style={{ flex: 1, height: 3, background: "#f0f0f0", borderRadius: 99 }}>
                            <div style={{ height: 3, width: `${Math.round(subsDone / subs.length * 100)}%`, background: "#1a7a45", borderRadius: 99 }} />
                          </div>
                          <span style={{ fontSize: 11, color: "#bbb" }}>{subsDone}/{subs.length}</span>
                        </div>
                      )}
                    </div>

                    {isOpen && (
                      <div style={{ padding: "0 14px 14px", borderTop: "0.5px solid #f0f0f0" }}>
                        {task.detail && <p style={{ margin: "10px 0", fontSize: 13, color: "#666", lineHeight: 1.5 }}>{task.detail}</p>}

                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12, color: "#aaa", flex: 1 }}>📅 {task.deadline || "No deadline"}</span>
                          <button onClick={e => { e.stopPropagation(); openEditTask(phase.id, task); }}
                            style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, border: "0.5px solid #ddd", background: "none", cursor: "pointer", color: "#666" }}>Edit</button>
                          <button onClick={e => { e.stopPropagation(); setConfirmDelete({ type: "task", id: task.id, phaseId: phase.id }); }}
                            style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, border: "0.5px solid #fcc", background: "none", cursor: "pointer", color: "#e53e3e" }}>Delete</button>
                          <select value={status} onChange={e => { e.stopPropagation(); setStatus(task.id, e.target.value); }} onClick={e => e.stopPropagation()}
                            style={{ fontSize: 12, padding: "3px 6px", borderRadius: 6, border: "0.5px solid #ddd" }}>
                            {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                          </select>
                        </div>

                        {/* Subtasks */}
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 500, color: "#888" }}>Subtasks</span>
                            {subs.length > 0 && <span style={{ fontSize: 11, color: "#bbb" }}>{subsDone}/{subs.length}</span>}
                          </div>
                          {subs.length > 0 && (
                            <div style={{ marginBottom: 8 }}>
                              <div style={{ height: 3, background: "#f0f0f0", borderRadius: 99, marginBottom: 8 }}>
                                <div style={{ height: 3, width: `${Math.round(subsDone / subs.length * 100)}%`, background: "#1a7a45", borderRadius: 99, transition: "width 0.3s" }} />
                              </div>
                              {subs.map(sub => (
                                <SubtaskRow key={sub.id} sub={sub}
                                  onToggle={() => toggleSubtask(task.id, sub.id)}
                                  onDelete={() => deleteSubtask(task.id, sub.id)}
                                  onRename={label => renameSubtask(task.id, sub.id, label)} />
                              ))}
                            </div>
                          )}
                          <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                            <input value={newSubtask[task.id] || ""} onChange={e => setNewSubtask(s => ({ ...s, [task.id]: e.target.value }))}
                              onKeyDown={e => { if (e.key === "Enter") addSubtask(task.id); }}
                              placeholder="Add a subtask…"
                              style={{ flex: 1, fontSize: 13, padding: "5px 10px", borderRadius: 8, border: "0.5px solid #ddd" }} />
                            <button onClick={() => addSubtask(task.id)}
                              style={{ padding: "5px 12px", borderRadius: 8, border: "0.5px solid #ddd", background: "#f8f8f8", cursor: "pointer" }}>+</button>
                          </div>
                        </div>

                        <label style={lbl}>Working notes</label>
                        <textarea value={notes[task.id] || ""} onChange={e => setNote(task.id, e.target.value)}
                          onClick={e => e.stopPropagation()} rows={4}
                          style={{ width: "100%", fontSize: 13, resize: "vertical", boxSizing: "border-box", borderRadius: 8, padding: "8px 10px", lineHeight: 1.5, border: "0.5px solid #ddd" }}
                          placeholder="Working notes…" />
                      </div>
                    )}
                  </div>
                );
              })}

              <button onClick={() => openAddTask(phase.id)}
                style={{ border: "0.5px dashed #ddd", borderRadius: 12, background: "none", cursor: "pointer", padding: "10px 14px", fontSize: 13, color: "#aaa", textAlign: "left" }}>
                + Add task
              </button>
            </div>
          </div>
        );
      })}

      <button onClick={openAddPhase}
        style={{ border: "0.5px dashed #ddd", borderRadius: 12, background: "none", cursor: "pointer", padding: "12px 16px", fontSize: 13, color: "#aaa", width: "100%", marginTop: 4 }}>
        + Add phase
      </button>

      <p style={{ fontSize: 11, color: "#bbb", marginTop: "1rem", textAlign: "right" }}>
        {syncStatus === "saving" ? "Saving…" : syncStatus === "error" ? "⚠ Sync failed" : "✓ Synced"}
      </p>

      {/* Task modal */}
      {taskModal && (
        <Modal title={taskModal.mode === "add" ? "Add task" : "Edit task"} onClose={() => setTaskModal(null)} accentColor="#1a56db">
          <label style={lbl}>Task name *</label>
          <input style={fld} value={taskForm.label} onChange={e => setTaskForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Draft introduction" />
          <label style={lbl}>Description</label>
          <textarea style={{ ...fld, resize: "vertical" }} rows={3} value={taskForm.detail} onChange={e => setTaskForm(f => ({ ...f, detail: e.target.value }))} placeholder="What's the argument or deliverable?" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={lbl}>Role</label>
              <select style={fld} value={taskForm.role} onChange={e => setTaskForm(f => ({ ...f, role: e.target.value }))}>
                {ROLE_OPTIONS.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Deadline</label>
              <input style={fld} value={taskForm.deadline} onChange={e => setTaskForm(f => ({ ...f, deadline: e.target.value }))} placeholder="e.g. End of June" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button onClick={() => setTaskModal(null)} style={{ padding: "7px 16px", fontSize: 13, borderRadius: 8, border: "0.5px solid #ddd", background: "none", cursor: "pointer", color: "#666" }}>Cancel</button>
            <button onClick={saveTask} style={{ padding: "7px 16px", fontSize: 13, borderRadius: 8, border: "0.5px solid #1a56db", background: "#e8f0fe", cursor: "pointer", color: "#1a56db", fontWeight: 500 }}>
              {taskModal.mode === "add" ? "Add task" : "Save changes"}
            </button>
          </div>
        </Modal>
      )}

      {/* Phase modal */}
      {phaseModal && (
        <Modal title={phaseModal.mode === "add" ? "Add phase" : "Edit phase"} onClose={() => setPhaseModal(null)} accentColor="#d97706">
          <label style={lbl}>Phase name *</label>
          <input style={fld} value={phaseForm.label} onChange={e => setPhaseForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. July – Submission" />
          <label style={lbl}>Urgency</label>
          <select style={fld} value={phaseForm.urgency} onChange={e => setPhaseForm(f => ({ ...f, urgency: e.target.value }))}>
            {URGENCY_OPTIONS.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
          </select>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button onClick={() => setPhaseModal(null)} style={{ padding: "7px 16px", fontSize: 13, borderRadius: 8, border: "0.5px solid #ddd", background: "none", cursor: "pointer", color: "#666" }}>Cancel</button>
            <button onClick={savePhase} style={{ padding: "7px 16px", fontSize: 13, borderRadius: 8, border: "0.5px solid #d97706", background: "#fef8e7", cursor: "pointer", color: "#92600a", fontWeight: 500 }}>
              {phaseModal.mode === "add" ? "Add phase" : "Save changes"}
            </button>
          </div>
        </Modal>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <Modal title={`Delete this ${confirmDelete.type}?`} onClose={() => setConfirmDelete(null)} accentColor="#e53e3e">
          <p style={{ fontSize: 13, color: "#666", marginBottom: "1.25rem", lineHeight: 1.6 }}>
            {confirmDelete.type === "phase" ? "This will delete the phase and all its tasks. This cannot be undone." : "This will permanently delete the task and its notes. This cannot be undone."}
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setConfirmDelete(null)} style={{ padding: "7px 16px", fontSize: 13, borderRadius: 8, border: "0.5px solid #ddd", background: "none", cursor: "pointer", color: "#666" }}>Cancel</button>
            <button onClick={() => confirmDelete.type === "task" ? deleteTask(confirmDelete.phaseId, confirmDelete.id) : deletePhase(confirmDelete.id)}
              style={{ padding: "7px 16px", fontSize: 13, borderRadius: 8, border: "0.5px solid #fcc", background: "#fff0f0", cursor: "pointer", color: "#e53e3e", fontWeight: 500 }}>
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}