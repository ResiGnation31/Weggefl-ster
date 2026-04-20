import { useState } from "react";
import { supabase } from "./supabase";

export default function Auth({ onLogin }) {
  const [mode, setMode] = useState("login"); // login | register
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const T = {
    bg: "#F5EFE6",
    card: "#FFFFFF",
    accent: "#B25E00",
    text: "#2C1810",
    textMuted: "#8B7355",
    border: "rgba(178,94,0,0.15)",
  };

  async function handleSubmit() {
    setLoading(true);
    setError("");
    setSuccess("");
    if (mode === "login") {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else onLogin(data.user);
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) { setError(error.message); }
      else {
        // Profil anlegen
        await supabase.from("profiles").insert({ id: data.user.id, name });
        setSuccess("Bitte bestätige deine E-Mail-Adresse!");
      }
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:24, fontFamily:"-apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif" }}>
      <div style={{ width:"100%", maxWidth:400 }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <h1 style={{ fontSize:32, fontWeight:700, color:T.accent, fontFamily:"Georgia,serif", margin:0 }}>Weggeflüsterer</h1>
          <p style={{ color:T.textMuted, marginTop:8 }}>Dein persönlicher Reisebegleiter</p>
        </div>

        <div style={{ background:T.card, borderRadius:20, padding:24, boxShadow:"0 4px 24px rgba(0,0,0,0.08)" }}>
          <div style={{ display:"flex", marginBottom:24, background:"rgba(0,0,0,0.05)", borderRadius:12, padding:4 }}>
            {["login","register"].map(m => (
              <button key={m} onClick={() => setMode(m)}
                style={{ flex:1, padding:"10px 0", borderRadius:10, border:"none", cursor:"pointer", fontWeight:600, fontSize:14,
                  background: mode===m ? T.accent : "transparent",
                  color: mode===m ? "#fff" : T.textMuted,
                  transition:"all 0.2s" }}>
                {m === "login" ? "Anmelden" : "Registrieren"}
              </button>
            ))}
          </div>

          {mode === "register" && (
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Dein Name"
              style={{ width:"100%", padding:"14px 16px", borderRadius:12, border:`1px solid ${T.border}`, marginBottom:12, fontSize:16, boxSizing:"border-box", outline:"none", background:"#fafafa" }}/>
          )}

          <input value={email} onChange={e => setEmail(e.target.value)}
            placeholder="E-Mail"
            type="email"
            style={{ width:"100%", padding:"14px 16px", borderRadius:12, border:`1px solid ${T.border}`, marginBottom:12, fontSize:16, boxSizing:"border-box", outline:"none", background:"#fafafa" }}/>

          <input value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Passwort"
            type="password"
            style={{ width:"100%", padding:"14px 16px", borderRadius:12, border:`1px solid ${T.border}`, marginBottom:16, fontSize:16, boxSizing:"border-box", outline:"none", background:"#fafafa" }}/>

          {error && <p style={{ color:"#FF3B30", fontSize:14, marginBottom:12, textAlign:"center" }}>{error}</p>}
          {success && <p style={{ color:"#34C759", fontSize:14, marginBottom:12, textAlign:"center" }}>{success}</p>}

          <button onClick={handleSubmit} disabled={loading}
            style={{ width:"100%", padding:16, borderRadius:14, border:"none", cursor:"pointer", background:T.accent, color:"#fff", fontSize:16, fontWeight:700, opacity:loading?0.7:1 }}>
            {loading ? "Laden..." : mode === "login" ? "Anmelden" : "Konto erstellen"}
          </button>
        </div>
      </div>
    </div>
  );
}
