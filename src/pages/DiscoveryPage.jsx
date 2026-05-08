import { useNavigate } from 'react-router-dom';
import DiscoveryPanel from '../components/Discovery/DiscoveryPanel';

// PLAN-033: 발굴 화면을 모달이 아닌 페이지로.
// onClose 가 라우터 뒤로가기로 동작.
export default function DiscoveryPage({ existingConferences, onAccept, onAbsorb }) {
  const navigate = useNavigate();
  return (
    <div className="p-6 max-w-4xl mx-auto bg-white rounded-lg shadow-sm border border-slate-200">
      <DiscoveryPanel
        existingConferences={existingConferences}
        onAccept={onAccept}
        onAbsorb={onAbsorb}
        onClose={() => navigate('/')}
      />
    </div>
  );
}
