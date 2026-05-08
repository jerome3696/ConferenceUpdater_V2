import LoginScreen from '../components/LoginScreen';

// PLAN-033: 기존 LoginScreen 을 페이지 라우트로 진입할 수 있게 wrap.
// LoginScreen 자체는 자기 완결적 (auth 처리). 부가 prop 불요.
export default function LoginPage() {
  return <LoginScreen />;
}
