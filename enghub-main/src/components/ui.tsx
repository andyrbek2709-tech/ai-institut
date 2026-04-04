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
  }, [onClose]);

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
