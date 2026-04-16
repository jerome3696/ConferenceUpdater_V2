import { useEffect, useState } from 'react';
import { generateConferenceId } from '../../services/dataManager';

const NEW_VALUE = '__new__';

export const CATEGORY_OPTIONS = ['학회', '박람회'];
export const REGION_OPTIONS = ['세계', '미주', '유럽', '아시아'];

function FixedSelect({ label, required, value, options, onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white"
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
      <label className="block text-xs font-medium text-slate-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        value={mode === 'new' ? NEW_VALUE : value}
        onChange={(e) => handleSelect(e.target.value)}
        className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white"
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
          className="w-full mt-1 border border-slate-300 rounded px-2 py-1.5 text-sm"
        />
      )}
    </div>
  );
}

function EditionSection({ title, edition, onChange }) {
  const update = (k, v) => onChange({ ...edition, [k]: v });
  return (
    <fieldset className="border border-slate-200 rounded p-3">
      <legend className="text-xs font-semibold text-slate-600 px-1">{title}</legend>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">시작일</label>
          <input
            type="date"
            value={edition.start_date}
            onChange={(e) => update('start_date', e.target.value)}
            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">종료일</label>
          <input
            type="date"
            value={edition.end_date}
            onChange={(e) => update('end_date', e.target.value)}
            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-700 mb-1">장소</label>
          <input
            type="text"
            value={edition.venue}
            onChange={(e) => update('venue', e.target.value)}
            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-700 mb-1">링크</label>
          <input
            type="url"
            value={edition.link}
            onChange={(e) => update('link', e.target.value)}
            placeholder="https://..."
            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
          />
        </div>
      </div>
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

function ConferenceFormModal({
  isOpen, mode, initial, onClose, onSubmit, onDelete, existingFields,
}) {
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (mode === 'edit' && initial) {
      setForm({
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
        },
        last: {
          start_date: initial.last?.start_date || '',
          end_date: initial.last?.end_date || '',
          venue: initial.last?.venue || '',
          link: initial.last?.link || '',
        },
      });
    } else {
      setForm(emptyForm());
    }
    setError('');
  }, [isOpen, mode, initial]);

  if (!isOpen) return null;

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
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              학회명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => update('full_name', e.target.value)}
              className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">약칭</label>
            <input
              type="text"
              value={form.abbreviation}
              onChange={(e) => update('abbreviation', e.target.value)}
              className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm font-mono"
            />
          </div>

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

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">주기(년)</label>
            <input
              type="number" min="0"
              value={form.cycle_years}
              onChange={(e) => update('cycle_years', e.target.value)}
              className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">기간(일)</label>
            <input
              type="number" min="0"
              value={form.duration_days}
              onChange={(e) => update('duration_days', e.target.value)}
              className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">공식 홈페이지</label>
            <input
              type="url"
              value={form.official_url}
              onChange={(e) => update('official_url', e.target.value)}
              placeholder="https://..."
              className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">메모</label>
            <textarea
              value={form.note}
              onChange={(e) => update('note', e.target.value)}
              rows={2}
              className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
            />
          </div>

          {mode === 'edit' && (
            <>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">중요도</label>
                <div className="flex gap-1">
                  {[1, 2, 3].map((n) => (
                    <button
                      key={n} type="button"
                      onClick={() => update('starred', form.starred === n ? 0 : n)}
                      className={`text-2xl leading-none ${n <= form.starred ? 'text-yellow-500' : 'text-slate-300'} hover:text-yellow-400`}
                    >
                      ★
                    </button>
                  ))}
                  <span className="text-xs text-slate-500 self-center ml-2">({form.starred}/3)</span>
                </div>
              </div>

              <div className="col-span-2">
                <EditionSection
                  title="Upcoming"
                  edition={form.upcoming}
                  onChange={(v) => update('upcoming', v)}
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
