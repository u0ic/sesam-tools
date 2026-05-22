import { useState } from "react";
import DailyRhythm from "./DailyRhythm";
import TaskManager from "./TaskManager";

export default function App() {
  const [view, setView] = useState("rhythm");

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "1rem" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: "1.5rem" }}>
        <button
          onClick={() => setView("rhythm")}
          style={{ flex: 1, padding: "8px", borderRadius: 8, border: "0.5px solid #ccc",
            background: view === "rhythm" ? "#f0f0f0" : "none", cursor: "pointer" }}>
          Daily rhythm
        </button>
        <button
          onClick={() => setView("tasks")}
          style={{ flex: 1, padding: "8px", borderRadius: 8, border: "0.5px solid #ccc",
            background: view === "tasks" ? "#f0f0f0" : "none", cursor: "pointer" }}>
          Archaeology tasks
        </button>
      </div>
      {view === "rhythm" ? <DailyRhythm /> : <TaskManager />}
    </div>
  );
}