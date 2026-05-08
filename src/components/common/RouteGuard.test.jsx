import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import RouteGuard from './RouteGuard';

// PLAN-033: RouteGuard — 인증·관리자 가드 리다이렉트 동작 검증.

function setup(initialPath, { authenticated, isAdmin = false, adminOnly = false }) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        {/* 일반 인증 가드 — / 는 adminOnly 없이 진입 가능 */}
        <Route element={<RouteGuard authenticated={authenticated} />}>
          <Route path="/" element={<div>HOME</div>} />
        </Route>
        {/* admin 가드 — /admin 은 adminOnly 적용 */}
        <Route element={<RouteGuard authenticated={authenticated} isAdmin={isAdmin} adminOnly={adminOnly} />}>
          <Route path="/admin" element={<div>ADMIN</div>} />
        </Route>
        <Route path="/login" element={<div>LOGIN</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('RouteGuard', () => {
  it('인증되면 children 렌더 (HOME)', () => {
    setup('/', { authenticated: true });
    expect(screen.getByText('HOME')).toBeInTheDocument();
  });

  it('비인증이면 /login 으로 리다이렉트', () => {
    setup('/', { authenticated: false });
    expect(screen.getByText('LOGIN')).toBeInTheDocument();
  });

  it('adminOnly + isAdmin=true 면 ADMIN 렌더', () => {
    setup('/admin', { authenticated: true, isAdmin: true, adminOnly: true });
    expect(screen.getByText('ADMIN')).toBeInTheDocument();
  });

  it('adminOnly + isAdmin=false 면 / 로 리다이렉트', () => {
    setup('/admin', { authenticated: true, isAdmin: false, adminOnly: true });
    expect(screen.getByText('HOME')).toBeInTheDocument();
  });
});
