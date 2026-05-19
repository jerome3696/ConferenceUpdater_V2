-- PLAN-037: invitations 코드 기반 초대 시스템 폐기
-- 게이팅은 Supabase 기본 초대(자율가입 OFF + 대시보드 Invite user)로 대체한다.
-- 코드 기반 invitations 테이블·generate_invite_code 함수는 미사용 → 제거.
-- 의존: 20260515000002_invitations.sql (이 마이그레이션이 만든 것을 되돌림)
--
-- ⚠️ DROP TABLE — 파괴적. invitations 데이터는 운영상 의미 없음(로그인이 검사한 적 없음).
--    적용 전 백업 불요. 사용자가 Supabase 에 직접 적용.

DROP TABLE IF EXISTS public.invitations;
DROP FUNCTION IF EXISTS public.generate_invite_code();

-- ============================================================
-- 롤백 — 20260515000002_invitations.sql 재적용
-- ============================================================
