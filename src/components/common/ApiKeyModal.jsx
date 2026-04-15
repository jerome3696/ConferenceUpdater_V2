import { useEffect, useState } from 'react';
import { maskApiKey } from '../../hooks/useApiKey';

function ApiKeyModal({ isOpen, currentKey, onSave, onClear, onClose }) {
  const [input, setInput] = useState('');
  const [warning, setWarning] = useState('');

  useEffect(() => {
    if (isOpen) {
      setInput('');
      setWarning('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmed = input.trim();
    if (!trimmed) {
      setWarning('키를 입력해주세요.');
      return;
    }
    if (!trimmed.startsWith('sk-ant-')) {
      // soft warning — 형식이 바뀔 수 있으므로 저장은 허용
      if (!window.confirm('키 형식이 일반적이지 않습니다(sk-ant-로 시작하지 않음). 그래도 저장할까요?')) {
        return;
      }
    }
    onSave(trimmed);
  };

  const handleClear = () => {
    if (window.confirm('저장된 API 키를 삭제할까요?')) {
      onClear();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-slate-800 mb-2">Claude API 키 설정</h2>
        <p className="text-xs text-slate-500 mb-4">
          키는 이 브라우저에만 저장되며, 서버로 전송되지 않습니다.
        </p>

        {currentKey && (
          <div className="mb-3 p-2 bg-slate-50 rounded text-xs text-slate-600">
            현재 저장된 키: <span className="font-mono">{maskApiKey(currentKey)}</span>
          </div>
        )}

        <label className="block text-sm font-medium text-slate-700 mb-1">
          {currentKey ? '새 키 입력 (교체)' : 'API 키 입력'}
        </label>
        <input
          type="password"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setWarning('');
          }}
          placeholder="sk-ant-..."
          className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoComplete="off"
        />
        {warning && <p className="text-xs text-red-600 mt-1">{warning}</p>}

        <div className="flex justify-end gap-2 mt-5">
          {currentKey && (
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

export default ApiKeyModal;
