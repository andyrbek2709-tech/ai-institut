// SVG icon set — Lucide-style, stroke 1.75, line caps round
// Применяется в src/App.tsx (sidebar nav, topbar) согласно design_handoff.

import * as React from 'react';

type IconProps = { s?: number; c?: string };

const SvgWrap = ({ s = 16, c = 'currentColor', children }: IconProps & { children: React.ReactNode }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c}
    strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    {children}
  </svg>
);

export const IconGrid = (p: IconProps) => <SvgWrap {...p}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></SvgWrap>;

export const IconFolder = (p: IconProps) => <SvgWrap {...p}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></SvgWrap>;

export const IconCheckSquare = (p: IconProps) => <SvgWrap {...p}><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></SvgWrap>;

export const IconCalculator = (p: IconProps) => <SvgWrap {...p}><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="8" y2="10"/><line x1="12" y1="10" x2="12" y2="10"/><line x1="16" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="8" y2="18"/><line x1="12" y1="18" x2="12" y2="18"/><line x1="16" y1="18" x2="16" y2="18"/></SvgWrap>;

export const IconFile = (p: IconProps) => <SvgWrap {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></SvgWrap>;

export const IconBook = (p: IconProps) => <SvgWrap {...p}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></SvgWrap>;

export const IconBell = (p: IconProps) => <SvgWrap {...p}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></SvgWrap>;

export const IconSearch = (p: IconProps) => <SvgWrap {...p}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></SvgWrap>;

export const IconPlus = (p: IconProps) => <SvgWrap {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></SvgWrap>;

export const IconArrowLeft = (p: IconProps) => <SvgWrap {...p}><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></SvgWrap>;

// IconTrendingUp removed — KPI cards intentionally show icon + value only (DD-06)

export const IconSun = (p: IconProps) => <SvgWrap {...p}><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></SvgWrap>;

export const IconMoon = (p: IconProps) => <SvgWrap {...p}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></SvgWrap>;

export const IconLogOut = (p: IconProps) => <SvgWrap {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></SvgWrap>;

export const IconActivity = (p: IconProps) => <SvgWrap {...p}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></SvgWrap>;

export const IconArchive = (p: IconProps) => <SvgWrap {...p}><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></SvgWrap>;

// Lookup for nav items by id (sidebar)
export const NavIcon: Record<string, React.FC<IconProps>> = {
  dashboard: IconGrid,
  projects_list: IconFolder,
  tasks: IconCheckSquare,
  calculations: IconCalculator,
  specifications: IconFile,
  normative: IconBook,
};
