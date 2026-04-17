import { useState } from 'react';
import { maskToken } from '../../hooks/useGitHubToken';

// 부모(App.jsx)에서 conditional render로 매번 새로 mount → 입력값 자동 리셋.
function GitHubTokenModal({ currentToken, onSave, onClear, onClose }) {
  const [input, setInput] = useState('');
  const [warning, setWarning] = useState('');

  const handleSave = () => {
    const trimmed = input.trim();
    if (!trimmed) {
      setWarning('토큰을 입력해주세요.');
      return;
    }
    // GitHub PAT 형식: ghp_ (classic), github_pat_ (fine-grained)
    if (!trimmed.startsWith('ghp_') && !trimmed.startsWith('github_pat_')) {
      if (!window.confirm('토큰 형식이 일반적이지 않습니다. 그래도 저장할까요?')) {
        return;
      }
    }
    onSave(trimmed);
  };

  const handleClear = () => {
    if (window.confirm('저장된 GitHub 토큰을 삭제할까요?')) {
      onClear();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-slate-800 mb-2">GitHub 연결</h2>
        <p className="text-xs text-slate-500 mb-3">
          편집 내용을 GitHub 저장소에 자동 커밋하기 위한 Personal Access Token입니다.
          토큰은 이 브라우저의 localStorage에만 저장되며 외부로 전송되지 않습니다.
        </p>

        <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-3 text-xs text-amber-800">
          <div className="font-semibold mb-1">Fine-grained PAT 권장</div>
          <ol className="list-decimal ml-4 space-y-0.5">
            <li>
              <a
                href="https://github.com/settings/personal-access-tokens/new"
                target="_blank" rel="noreferrer"
                className="text-blue-600 hover:underline"
              >
                GitHub 토큰 발급 페이지
              </a>
              {' '}접속
            </li>
            <li>Repository access → Only select repositories → <strong>ConferenceUpdater_V2</strong></li>
            <li>Permissions → Repository permissions → <strong>Contents: Read and write</strong></li>
            <li>만료일 설정 후 생성, 토큰 복사 → 아래에 붙여넣기</li>
          </ol>
          <div className="mt-2 text-[11px]">
            ⚠️ 공용 PC에서 사용 후에는 반드시 "삭제" 버튼으로 제거하세요.
          </div>
        </div>

        {currentToken && (
          <div className="mb-3 p-2 bg-slate-50 rounded text-xs text-slate-600">
            현재 저장된 토큰: <span className="font-mono">{maskToken(currentToken)}</span>
          </div>
        )}

        <label className="block text-sm font-medium text-slate-700 mb-1">
          {currentToken ? '새 토큰 입력 (교체)' : 'Personal Access Token'}
        </label>
        <input
          type="password"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setWarning('');
          }}
          placeholder="github_pat_... 또는 ghp_..."
          className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          autoComplete="off"
        />
        {warning && <p className="text-xs text-red-600 mt-1">{warning}</p>}

        <div className="flex justify-end gap-2 mt-5">
          {currentToken && (
            <button
              onClick={handleClear}
              className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded"
            >
              삭제
            </button>
          )}
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

export default GitHubTokenModal;
