import { useState, useEffect } from "react";
import DailyRhythm from "./DailyRhythm";
import TaskManager from "./TaskManager";

const SB_URL = "https://wgiybgncxnovmsyqccbu.supabase.co";
const SB_KEY = "sb_publishable_vmYb05jf9S6GH5Sp41Ztiw_q34PUyKb";

export default function App() {
  const [view, setView] = useState("rhythm");
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState(null);
  const [signingIn, setSigningIn] = useState(false);

  // On load, check for existing session in localStorage
  useEffect(() => {
    const stored = localStorage.getItem("sb_session");
    if (stored) {
      const s = JSON.parse(stored);
      // Check if token is still valid (not expired)
      if (s.expires_at && Date.now() / 1000 < s.expires_at) {
        setSession(s);
      } else {
        localStorage.removeItem("sb_session");
      }
    }
    setLoading(false);
  }, []);

  const signIn = async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      const res = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SB_KEY,
        },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error_description || data.msg || "Sign in failed");
      } else {
        localStorage.setItem("sb_session", JSON.stringify(data));
        setSession(data);
      }
    } catch (e) {
      setAuthError("Network error — check your connection");
    }
    setSigningIn(false);
  };

  const signOut = () => {
    localStorage.removeItem("sb_session");
    setSession(null);
  };

  if (loading) return (
    <div style={{ padding: "2rem", fontSize: 14, color: "#888" }}>Loading…</div>
  );

  if (!session) return (
    <div style={{ maxWidth: 360, margin: "80px auto", padding: "0 1rem", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>Sesam Tools</h1>
      <p style={{ fontSize: 13, color: "#888", marginBottom: "2rem" }}>Sign in to continue</p>

      <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 3 }}>Email</label>
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") signIn(); }}
        style={{ width: "100%", fontSize: 14, padding: "8px 10px", borderRadius: 8, border: "0.5px solid #ddd", boxSizing: "border-box", marginBottom: 12 }}
      />

      <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 3 }}>Password</label>
      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") signIn(); }}
        style={{ width: "100%", fontSize: 14, padding: "8px 10px", borderRadius: 8, border: "0.5px solid #ddd", boxSizing: "border-box", marginBottom: 16 }}
      />

      {authError && (
        <p style={{ fontSize: 12, color: "#e53e3e", marginBottom: 12 }}>⚠ {authError}</p>
      )}

      <button onClick={signIn} disabled={signingIn}
        style={{ width: "100%", padding: "10px", fontSize: 14, borderRadius: 8, border: "none", background: "#111", color: "#fff", cursor: "pointer", fontWeight: 500 }}>
        {signingIn ? "Signing in…" : "Sign in"}
      </button>
    </div>
  );

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "1rem", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: "1.5rem", alignItems: "center" }}>
        <button onClick={() => setView("rhythm")}
          style={{ flex: 1, padding: "8px", borderRadius: 8, border: "0.5px solid #ddd",
            background: view === "rhythm" ? "#f0f0f0" : "none", cursor: "pointer", fontSize: 13 }}>
          Daily rhythm
        </button>
        <button onClick={() => setView("tasks")}
          style={{ flex: 1, padding: "8px", borderRadius: 8, border: "0.5px solid #ddd",
            background: view === "tasks" ? "#f0f0f0" : "none", cursor: "pointer", fontSize: 13 }}>
          Archaeology tasks
        </button>
        <button onClick={signOut}
          style={{ padding: "8px 12px", borderRadius: 8, border: "0.5px solid #ddd",
            background: "none", cursor: "pointer", fontSize: 12, color: "#aaa" }}>
          Sign out
        </button>
      </div>
      {view === "rhythm"
        ? <DailyRhythm token={session.access_token} />
        : <TaskManager token={session.access_token} />}
    </div>
  );
}