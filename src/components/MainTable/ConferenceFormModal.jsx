import { useState } from 'react';
import { generateConferenceId } from '../../services/dataManager';
import { CATEGORY_OPTIONS, REGION_OPTIONS } from './conferenceConstants';

const NEW_VALUE = '__new__';
const INPUT_CLASS = 'w-full border border-slate-300 rounded px-2 py-1.5 text-sm';
const SELECT_CLASS = `${INPUT_CLASS} bg-white`;
const LABEL_CLASS = 'block text-xs font-medium text-slate-700 mb-1';

function FieldLabel({ children, required }) {
  return (
    <label className={LABEL_CLASS}>
      {children}{required && <> <span className="text-red-500">*</span></>}
    </label>
  );
}

function TextField({ label, required, colSpan2, mono, type = 'text', ...inputProps }) {
  return (
    <div className={colSpan2 ? 'col-span-2' : undefined}>
      <FieldLabel required={required}>{label}</FieldLabel>
      <input type={type} className={`${INPUT_CLASS}${mono ? ' font-mono' : ''}`} {...inputProps} />
    </div>
  );
}

function TextArea({ label, colSpan2, ...props }) {
  return (
    <div className={colSpan2 ? 'col-span-2' : undefined}>
      <FieldLabel>{label}</FieldLabel>
      <textarea className={INPUT_CLASS} {...props} />
    </div>
  );
}

function FixedSelect({ label, required, value, options, onChange }) {
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={SELECT_CLASS}
      >
        <option value="">(선택)</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

function ComboField({ label, required, value, options, onChange, placeholder }) {
  const isNew = value !== '' && !options.includes(value);
  const [mode, setMode] = useState(isNew ? 'new' : 'existing');
  const [newInput, setNewInput] = useState(isNew ? value : '');

  const handleSelect = (v) => {
    if (v === NEW_VALUE) {
      setMode('new');
      onChange(newInput);
    } else {
      setMode('existing');
      onChange(v);
    }
  };

  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <select
        value={mode === 'new' ? NEW_VALUE : value}
        onChange={(e) => handleSelect(e.target.value)}
        className={SELECT_CLASS}
      >
        <option value="">(선택)</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
        <option value={NEW_VALUE}>+ 새로 입력...</option>
      </select>
      {mode === 'new' && (
        <input
          type="text"
          value={newInput}
          onChange={(e) => { setNewInput(e.target.value); onChange(e.target.value); }}
          placeholder={placeholder}
          className={`${INPUT_CLASS} mt-1`}
        />
      )}
    </div>
  );
}

function EditionSection({ title, edition, onChange, showAnchor }) {
  const update = (k, v) => onChange({ ...edition, [k]: v });
  return (
    <fieldset className="border border-slate-200 rounded p-3">
      <legend className="text-xs font-semibold text-slate-600 px-1">{title}</legend>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="시작일" type="date"
          value={edition.start_date}
          onChange={(e) => update('start_date', e.target.value)}
        />
        <TextField
          label="종료일" type="date"
          value={edition.end_date}
          onChange={(e) => update('end_date', e.target.value)}
        />
        <TextField
          colSpan2 label="장소"
          value={edition.venue}
          onChange={(e) => update('venue', e.target.value)}
        />
        <TextField
          colSpan2 label="링크" type="url"
          value={edition.link}
          onChange={(e) => update('link', e.target.value)}
          placeholder="https://..."
        />
      </div>
      {showAnchor && (
        <label className="flex items-center gap-2 mt-3 text-xs text-slate-700 select-none cursor-pointer">
          <input
            type="checkbox"
            checked={!!edition.anchored}
            onChange={(e) => update('anchored', e.target.checked)}
            className="accent-emerald-600"
          />
          확정으로 표시 (회차 종료까지 자동 재검색 제외)
        </label>
      )}
      <p className="text-[11px] text-slate-400 mt-2">
        모든 항목을 비우면 저장 시 해당 개최 이력이 삭제됩니다.
      </p>
    </fieldset>
  );
}

const emptyEdition = { start_date: '', end_date: '', venue: '', link: '' };

function emptyForm() {
  return {
    full_name: '', abbreviation: '', category: '', field: '', region: '',
    cycle_years: '', duration_days: '', official_url: '', note: '',
    starred: 0,
    upcoming: { ...emptyEdition },
    last: { ...emptyEdition },
  };
}

function buildInitialForm(mode, initial) {
  if (mode === 'edit' && initial) {
    return {
      full_name: initial.full_name || '',
      abbreviation: initial.abbreviation || '',
      category: initial.category || '',
      field: initial.field || '',
      region: initial.region || '',
      cycle_years: initial.cycle_years ?? '',
      duration_days: initial.duration_days ?? '',
      official_url: initial.official_url || '',
      note: initial.note || '',
      starred: initial.starred || 0,
      upcoming: {
        start_date: initial.upcoming?.start_date || '',
        end_date: initial.upcoming?.end_date || '',
        venue: initial.upcoming?.venue || '',
        link: initial.upcoming?.link || '',
        anchored: !!initial.upcoming?.anchored,
      },
      last: {
        start_date: initial.last?.start_date || '',
        end_date: initial.last?.end_date || '',
        venue: initial.last?.venue || '',
        link: initial.last?.link || '',
      },
    };
  }
  return emptyForm();
}

function ConferenceFormModal({
  mode, initial, onClose, onSubmit, onDelete, existingFields,
}) {
  // 부모(MainTable.jsx)에서 conditional render + key prop으로 리셋 보장.
  // useState lazy init으로 mount 시 1회만 계산.
  const [form, setForm] = useState(() => buildInitialForm(mode, initial));
  const [error, setError] = useState('');

  const update = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = () => {
    if (!form.full_name.trim()) {
      setError('학회명은 필수 항목입니다.');
      return;
    }
    const master = {
      category: form.category.trim(),
      field: form.field.trim(),
      abbreviation: form.abbreviation.trim(),
      full_name: form.full_name.trim(),
      cycle_years: form.cycle_years === '' ? 0 : Number(form.cycle_years) || 0,
      duration_days: form.duration_days === '' ? 0 : Number(form.duration_days) || 0,
      region: form.region.trim(),
      official_url: form.official_url.trim(),
      note: form.note.trim(),
    };

    if (mode === 'add') {
      onSubmit({
        conference: {
          id: generateConferenceId(),
          starred: 0,
          ...master,
          source: 'user_input',
        },
      });
    } else {
      onSubmit({
        master,
        starred: form.starred,
        upcoming: form.upcoming,
        last: form.last,
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-slate-800 mb-4">
          {mode === 'add' ? '학회 추가' : '학회 편집'}
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <TextField
            colSpan2 required label="학회명"
            value={form.full_name}
            onChange={(e) => update('full_name', e.target.value)}
          />

          <TextField
            mono label="약칭"
            value={form.abbreviation}
            onChange={(e) => update('abbreviation', e.target.value)}
          />

          <FixedSelect
            label="분류" options={CATEGORY_OPTIONS}
            value={form.category} onChange={(v) => update('category', v)}
          />

          <ComboField
            label="분야" options={existingFields}
            value={form.field} onChange={(v) => update('field', v)}
            placeholder="새 분야 입력"
          />

          <FixedSelect
            label="지역" options={REGION_OPTIONS}
            value={form.region} onChange={(v) => update('region', v)}
          />

          <TextField
            label="주기(년)" type="number" min="0"
            value={form.cycle_years}
            onChange={(e) => update('cycle_years', e.target.value)}
          />

          <TextField
            label="기간(일)" type="number" min="0"
            value={form.duration_days}
            onChange={(e) => update('duration_days', e.target.value)}
          />

          <TextField
            colSpan2 label="공식 홈페이지" type="url"
            value={form.official_url}
            onChange={(e) => update('official_url', e.target.value)}
            placeholder="https://..."
          />

          <TextArea
            colSpan2 label="메모"
            value={form.note}
            onChange={(e) => update('note', e.target.value)}
            rows={2}
          />

          {mode === 'edit' && (
            <>
              <div className="col-span-2">
                <FieldLabel>즐겨찾기</FieldLabel>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => update('starred', form.starred ? 0 : 1)}
                    className={`text-2xl leading-none ${form.starred ? 'text-yellow-500' : 'text-slate-300'} hover:text-yellow-400`}
                    aria-pressed={!!form.starred}
                    aria-label={form.starred ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                  >
                    ★
                  </button>
                  <span className="text-xs text-slate-500">{form.starred ? '즐겨찾기' : '일반'}</span>
                </div>
              </div>

              <div className="col-span-2">
                <EditionSection
                  title="Upcoming"
                  edition={form.upcoming}
                  onChange={(v) => update('upcoming', v)}
                  showAnchor
                />
              </div>
              <div className="col-span-2">
                <EditionSection
                  title="Last (지난 개최)"
                  edition={form.last}
                  onChange={(v) => update('last', v)}
                />
              </div>
            </>
          )}
        </div>

        {error && <p className="text-xs text-red-600 mt-3">{error}</p>}

        <div className="flex justify-between items-center mt-5">
          <div>
            {mode === 'edit' && onDelete && (
              <button
                onClick={() => {
                  const name = initial?.full_name || '이 학회';
                  if (window.confirm(`"${name}"을(를) 삭제할까요?\n관련된 개최 이력도 함께 삭제되며, 이 작업은 되돌릴 수 없습니다.`)) {
                    onDelete();
                    onClose();
                  }
                }}
                className="px-3 py-1.5 text-sm text-red-600 border border-red-200 hover:bg-red-50 rounded"
              >
                삭제
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded"
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded"
            >
              {mode === 'add' ? '추가' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConferenceFormModal;
