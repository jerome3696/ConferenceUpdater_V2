// 즐겨찾기 단일 토글. value는 0|1 만 사용 (과거 0~3 시스템은 PLAN-010에서 이진으로 단순화).
function StarRating({ value = 0, readOnly = false, onChange }) {
  const on = !!value;
  const handleClick = () => {
    if (readOnly) return;
    onChange?.(on ? 0 : 1);
  };
  return (
    <button
      type="button"
      disabled={readOnly}
      onClick={handleClick}
      className={`text-base leading-none ${on ? 'text-yellow-500' : 'text-slate-300'} ${readOnly ? 'cursor-default' : 'cursor-pointer hover:text-yellow-400'}`}
      aria-label={on ? '즐겨찾기 해제' : '즐겨찾기 추가'}
      aria-pressed={on}
    >
      ★
    </button>
  );
}

export default StarRating;
