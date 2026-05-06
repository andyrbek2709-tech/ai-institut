import { useState, useEffect } from 'react';
import { DARK, LIGHT } from '../constants';
import { signIn } from '../api/supabase';
import { ThemeToggle, Field, getInp } from '../components/ui';

interface LoginPageProps {
  onLogin: (token: string, email: string) => void;
  dark: boolean;
  setDark: (v: boolean) => void;
}

export function LoginPage({ onLogin, dark, setDark }: LoginPageProps) {
  const C = dark ? DARK : LIGHT;
  useEffect(() => { document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light'); }, [dark]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true); setError("");
    const data = await signIn(email, password);
    if (data.access_token) onLogin(data.access_token, data.user.email);
    else setError("Неверный email или пароль");
    setLoading(false);
  };

  return (
    <div className="login-container">
      <div style={{ position: "absolute", top: 20, right: 20 }}>
        <ThemeToggle dark={dark} setDark={setDark} C={C} />
      </div>
      <div className="login-card">
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 36 }}>
          <div className="sidebar-logo-icon" style={{ width: 44, height: 44, fontSize: 22, borderRadius: 12 }}>⬡</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 22, color: C.text }}>EngHub</div>
            <div style={{ fontSize: 12, color: C.textMuted }}>Инженерная платформа</div>
          </div>
        </div>
        <div className="form-stack">
          <Field label="EMAIL" C={C}>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" style={getInp(C)} />
          </Field>
          <Field label="ПАРОЛЬ" C={C}>
            <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="••••••••"
              onKeyDown={e => e.key === "Enter" && handleLogin()} style={getInp(C)} />
          </Field>
          {error && <div style={{ color: C.red, fontSize: 13, fontWeight: 500, padding: "8px 12px", background: C.red + "10", borderRadius: 8 }}>{error}</div>}
          <button className="btn btn-primary" onClick={handleLogin} disabled={loading}
            style={{ width: "100%", padding: "13px", fontSize: 14 }}>
            {loading ? "Вход..." : "Войти →"}
          </button>
        </div>
      </div>
    </div>
  );
}
