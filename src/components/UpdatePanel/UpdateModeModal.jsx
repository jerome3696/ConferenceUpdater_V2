// 전체 업데이트 시작 전 모드 선택 모달.
// - 일반: URL 신뢰도·주기로 차등. 공식 도메인 + 충분히 먼 미래 학회는 pass.
// - 정밀: 앵커 제외 모두 재검증. 호출 수 많지만 누락·오류 복구 목적.

export default function UpdateModeModal({ totalCount, onSelect, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-slate-800 mb-1">전체 업데이트 모드</h2>
        <p className="text-xs text-slate-500 mb-4">
          대상 학회 <span className="font-semibold text-slate-700">{totalCount}</span>건.
          모드에 따라 실제 검색 호출 수가 달라집니다.
        </p>

        <div className="space-y-2">
          <button
            onClick={() => onSelect('general')}
            className="w-full text-left p-3 border border-slate-300 rounded hover:bg-blue-50 hover:border-blue-300"
          >
            <div className="font-semibold text-sm text-slate-800">일반 (권장)</div>
            <div className="text-xs text-slate-500 mt-0.5">
              공식 도메인 + 충분히 먼 미래는 pass. 뉴스·리스팅 링크나 임박한 회차는 재검색.
            </div>
          </button>

          <button
            onClick={() => onSelect('precise')}
            className="w-full text-left p-3 border border-slate-300 rounded hover:bg-amber-50 hover:border-amber-300"
          >
            <div className="font-semibold text-sm text-slate-800">정밀</div>
            <div className="text-xs text-slate-500 mt-0.5">
              앵커 제외 모두 재검증. 호출 수 많음. 큰 오류·누락 의심 시만 사용.
            </div>
          </button>
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
