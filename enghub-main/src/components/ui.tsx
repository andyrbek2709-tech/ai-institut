import React from 'react';
import { statusMap } from '../constants';

// ===== THEME TOGGLE =====
export function ThemeToggle({ dark, setDark, C }: { dark: boolean; setDark: (v: boolean) => void; C: any }) {
  return (
    <button className="theme-toggle" onClick={() => setDark(!dark)}>
      {dark ? "☀️" : "🌙"} {dark ? "Светлая" : "Тёмная"}
    </button>
  );
}

// ===== MODAL =====
export function Modal({ title, onClose, C, children }: { title: string; onClose: () => void; C: any; children: React.ReactNode }) {
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ===== FIELD =====
export function Field({ label, C, children }: { label: string; C: any; children: React.ReactNode }) {
  return (
    <div>
      <div className="field-label">{label}</div>
      {children}
    </div>
  );
}

// ===== AVATAR =====
export function AvatarComp({ user, size, C }: { user: any; size: number; C: any }) {
  if (!user) return <div className="avatar" style={{ width: size, height: size, background: C.surface2, fontSize: size * 0.4, color: C.textMuted }}>?</div>;
  if (user.avatar_url) {
    return (
      <div className="avatar" style={{ width: size, height: size, overflow: 'hidden', padding: 0 }}>
        <img src={user.avatar_url} alt={user.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    );
  }
  const initials = (user.full_name || "").split(" ").map((s: string) => s[0]).join("").slice(0, 2).toUpperCase();
  const hash = (user.full_name || "").split("").reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
  const colors = ["#4a9eff", "#2ac769", "#a855f7", "#f5a623", "#ff8c42", "#ef4444", "#06b6d4"];
  const bg = colors[hash % colors.length];
  return (
    <div className="avatar" style={{ width: size, height: size, background: bg + "20", fontSize: size * 0.38, color: bg, fontWeight: 700 }}>
      {initials}
    </div>
  );
}

// ===== BADGE =====
export function BadgeComp({ status, C }: { status: string; C: any }) {
  const s = statusMap[status] || { label: status, color: "#8896a8", bg: "#8896a815" };
  return <span className="badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>;
}

// ===== PRIORITY DOT =====
export function PriorityDot({ p, C }: { p: string; C: any }) {
  const c = p === "high" ? "#ef4444" : p === "medium" ? "#f5a623" : "#8896a8";
  return <span className="priority-dot" style={{ background: c }} />;
}

// ===== INPUT STYLE HELPER =====
export function getInp(C: any, extra?: any): React.CSSProperties {
  return {
    width: "100%",
    background: C.surface2,
    border: `1.5px solid ${C.border}`,
    borderRadius: 8,
    padding: "10px 14px",
    color: C.text,
    fontSize: 13,
    outline: "none",
    fontFamily: "inherit",
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
    ...extra,
  };
}

// ===== RU DATE INPUT =====
// Russian-format date input. Displays as ДД.ММ.ГГГГ, emits ISO yyyy-mm-dd
// to keep storage/API contracts unchanged.
export function RuDateInput({
  value,
  onChange,
  C,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  C: any;
  placeholder?: string;
}) {
  const toRu = (iso: string): string => {
    if (!iso) return "";
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(iso)) return iso;
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
  };

  const [text, setText] = React.useState<string>(toRu(value));

  React.useEffect(() => {
    setText(toRu(value));
  }, [value]);

  const handleChange = (raw: string) => {
    let cleaned = raw.replace(/[^\d.]/g, "").slice(0, 10);
    // auto-insert dots after dd and dd.mm if user typed only digits
    if (/^\d{3,}$/.test(cleaned)) {
      cleaned = cleaned.slice(0, 2) + "." + cleaned.slice(2);
    }
    if (/^\d{2}\.\d{3,}$/.test(cleaned)) {
      cleaned = cleaned.slice(0, 5) + "." + cleaned.slice(5);
    }
    cleaned = cleaned.slice(0, 10);
    setText(cleaned);
    const m = cleaned.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (m) {
      onChange(`${m[3]}-${m[2]}-${m[1]}`);
    } else if (cleaned === "") {
      onChange("");
    }
  };

  return (
    <input
      type="text"
      value={text}
      onChange={(e) => handleChange(e.target.value)}
      placeholder={placeholder || "ДД.ММ.ГГГГ"}
      style={getInp(C)}
      inputMode="numeric"
      maxLength={10}
    />
  );
}

// useCountUp — анимация числовых значений в KPI-карточках (T31 redesign)
export function useCountUp(target: number, duration: number = 750): number {
  const [value, setValue] = React.useState(0);
  React.useEffect(() => {
    let start: number | null = null;
    let raf = 0;
    const step = (timestamp: number) => {
      if (start === null) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      setValue(Math.round((1 - Math.pow(1 - progress, 3)) * target));
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

