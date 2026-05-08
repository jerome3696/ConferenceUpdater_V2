import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

// PLAN-033: 헤더 사용자 메뉴 드롭다운.
// 클릭하면 펼쳐지는 메뉴 — 메인/라이브러리/DB 검색/설정/관리자/로그아웃.
// Link 클릭 또는 외부 클릭 시 닫힘.
const NAV_ITEMS = [
  { to: '/', label: '메인' },
  { to: '/libraries', label: '라이브러리' },
  { to: '/db', label: 'DB 검색' },
  { to: '/settings', label: '설정' },
  { to: '/admin', label: '관리자' },
];

export default function UserMenu({ userEmail, onSignOut }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const location = useLocation();

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-50 text-slate-700 inline-flex items-center gap-1"
        title={userEmail || '메뉴'}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        메뉴
        <span className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden>▾</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded shadow-md z-50 py-1 text-sm"
        >
          {userEmail && (
            <div className="px-3 py-1.5 text-[11px] text-slate-500 border-b border-slate-100 truncate">
              {userEmail}
            </div>
          )}
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={`block px-3 py-1.5 hover:bg-slate-50 ${location.pathname === item.to ? 'text-slate-900 font-semibold' : 'text-slate-700'}`}
              role="menuitem"
            >
              {item.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => { setOpen(false); onSignOut?.(); }}
            className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 border-t border-slate-100"
            role="menuitem"
          >
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}
