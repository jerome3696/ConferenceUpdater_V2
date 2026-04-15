function StarRating({ value = 0, readOnly = false, onChange }) {
  const handleClick = (n) => {
    if (readOnly) return;
    onChange?.(value === n ? 0 : n);
  };

  return (
    <span className="inline-flex leading-none select-none">
      {[1, 2, 3].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => handleClick(n)}
          className={`text-base ${n <= value ? 'text-yellow-500' : 'text-slate-300'} ${readOnly ? 'cursor-default' : 'cursor-pointer hover:text-yellow-400'}`}
          aria-label={`별점 ${n}`}
        >
          ★
        </button>
      ))}
    </span>
  );
}

export default StarRating;
