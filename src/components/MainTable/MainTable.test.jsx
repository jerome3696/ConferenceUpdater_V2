import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MainTable from './MainTable';

vi.mock('./FilterBar', () => ({
  default: ({ onChange, total, filtered }) => (
    <div>
      <span data-testid="count">{filtered}/{total}</span>
      <button data-testid="filter-category" onClick={() => onChange({ category: 'heat', field: '', region: '', query: '' })}>
        filter-category
      </button>
      <button data-testid="filter-field" onClick={() => onChange({ category: '', field: 'HT', region: '', query: '' })}>
        filter-field
      </button>
      <button data-testid="filter-region" onClick={() => onChange({ category: '', field: '', region: 'Asia', query: '' })}>
        filter-region
      </button>
      <button data-testid="filter-query" onClick={() => onChange({ category: '', field: '', region: '', query: 'thermal' })}>
        filter-query
      </button>
      <button data-testid="filter-reset" onClick={() => onChange({ category: '', field: '', region: '', query: '' })}>
        reset
      </button>
    </div>
  ),
}));

vi.mock('./ConferenceFormModal', () => ({
  default: () => null,
}));

vi.mock('../../services/exportService', () => ({
  exportAsJson: vi.fn(),
  exportAsXlsx: vi.fn(),
}));

vi.mock('../common/StarRating', () => ({
  default: ({ value }) => <span data-testid="star">{value}</span>,
}));

const ROW_HEAT = {
  id: 'c1', full_name: 'Thermal Engineering Conf', abbreviation: 'TEC',
  category: 'heat', field: 'HT', region: 'Asia', starred: 3, official_url: null,
  upcoming: { start_date: '2026-09-01', end_date: '2026-09-05', venue: 'Tokyo', link: null, source: 'ai_search' },
  last: null,
};

const ROW_FLUID = {
  id: 'c2', full_name: 'Fluid Dynamics Symposium', abbreviation: 'FDS',
  category: 'fluid', field: 'FM', region: 'EU', starred: 1, official_url: null,
  upcoming: { start_date: '2026-11-01', end_date: '2026-11-03', venue: 'Paris', link: null, source: 'user_input' },
  last: null,
};

const ROW_NO_UPCOMING = {
  id: 'c3', full_name: 'HVAC International', abbreviation: 'HVAC',
  category: 'heat', field: 'HT', region: 'NA', starred: 0, official_url: null,
  upcoming: undefined,
  last: undefined,
};

function makeConferences(rows = [ROW_HEAT, ROW_FLUID]) {
  return {
    rows,
    loading: false,
    error: null,
    data: { conferences: [], editions: [] },
    addConference: vi.fn(),
    updateStarred: vi.fn(),
    saveConferenceEdit: vi.fn(),
    deleteConference: vi.fn(),
  };
}

// --- 렌더링 ---

describe('렌더링', () => {
  it('loading=true일 때 로딩 메시지 표시', () => {
    const conferences = { ...makeConferences(), loading: true };
    render(<MainTable conferences={conferences} />);
    expect(screen.getByText('로딩 중...')).toBeInTheDocument();
  });

  it('error 있을 때 오류 메시지 표시', () => {
    const conferences = { ...makeConferences(), error: new Error('fetch fail') };
    render(<MainTable conferences={conferences} />);
    expect(screen.getByText(/오류/)).toBeInTheDocument();
  });

  it('rows 전부 렌더링', () => {
    render(<MainTable conferences={makeConferences()} />);
    expect(screen.getByText('Thermal Engineering Conf')).toBeInTheDocument();
    expect(screen.getByText('Fluid Dynamics Symposium')).toBeInTheDocument();
  });

  it('isAdmin=false 시 작업 버튼 없음', () => {
    render(<MainTable conferences={makeConferences()} isAdmin={false} />);
    expect(screen.queryByText('전체 업데이트')).not.toBeInTheDocument();
    expect(screen.queryByText('+ 학회 추가')).not.toBeInTheDocument();
  });

  it('isAdmin=true 시 작업 버튼 표시', () => {
    const onRequestUpdateAll = vi.fn();
    render(<MainTable conferences={makeConferences()} isAdmin={true} onRequestUpdateAll={onRequestUpdateAll} />);
    expect(screen.getByText('전체 업데이트')).toBeInTheDocument();
    expect(screen.getByText('+ 학회 추가')).toBeInTheDocument();
  });
});

// --- 필터 동작 ---

describe('필터 동작', () => {
  it('초기 count: filtered=total', () => {
    render(<MainTable conferences={makeConferences()} />);
    expect(screen.getByTestId('count').textContent).toBe('2/2');
  });

  it('category 필터 → heat만 표시', () => {
    render(<MainTable conferences={makeConferences()} />);
    fireEvent.click(screen.getByTestId('filter-category'));

    expect(screen.getByText('Thermal Engineering Conf')).toBeInTheDocument();
    expect(screen.queryByText('Fluid Dynamics Symposium')).not.toBeInTheDocument();
    expect(screen.getByTestId('count').textContent).toBe('1/2');
  });

  it('field 필터 → HT만 표시', () => {
    render(<MainTable conferences={makeConferences()} />);
    fireEvent.click(screen.getByTestId('filter-field'));

    expect(screen.getByText('Thermal Engineering Conf')).toBeInTheDocument();
    expect(screen.queryByText('Fluid Dynamics Symposium')).not.toBeInTheDocument();
  });

  it('region 필터 → Asia만 표시', () => {
    render(<MainTable conferences={makeConferences()} />);
    fireEvent.click(screen.getByTestId('filter-region'));

    expect(screen.getByText('Thermal Engineering Conf')).toBeInTheDocument();
    expect(screen.queryByText('Fluid Dynamics Symposium')).not.toBeInTheDocument();
  });

  it('query 필터 → full_name에 "thermal" 포함된 것만', () => {
    render(<MainTable conferences={makeConferences()} />);
    fireEvent.click(screen.getByTestId('filter-query'));

    expect(screen.getByText('Thermal Engineering Conf')).toBeInTheDocument();
    expect(screen.queryByText('Fluid Dynamics Symposium')).not.toBeInTheDocument();
  });

  it('필터 리셋 → 전체 다시 표시', () => {
    render(<MainTable conferences={makeConferences()} />);
    fireEvent.click(screen.getByTestId('filter-category'));
    fireEvent.click(screen.getByTestId('filter-reset'));

    expect(screen.getByText('Thermal Engineering Conf')).toBeInTheDocument();
    expect(screen.getByText('Fluid Dynamics Symposium')).toBeInTheDocument();
    expect(screen.getByTestId('count').textContent).toBe('2/2');
  });
});

// --- QA #6, #7 (작업 첫 열, Last/참고 접힘) ---

describe('레이아웃 (QA #6, #7)', () => {
  it('isAdmin 시 작업 그룹 헤더가 첫 열', () => {
    render(<MainTable conferences={makeConferences()} isAdmin={true} />);
    const groupHeaders = screen.getAllByRole('columnheader')
      .filter((th) => th.getAttribute('colspan'));
    expect(groupHeaders[0].textContent).toContain('작업');
    expect(groupHeaders[1].textContent).toContain('학회 마스터');
  });

  it('Last/참고 그룹은 기본 접힘 (▶ 표시)', () => {
    render(<MainTable conferences={makeConferences()} />);
    const lastHeader = screen.getByText((_, el) => el?.tagName === 'TH' && el.textContent.startsWith('Last'));
    const noteHeader = screen.getByText((_, el) => el?.tagName === 'TH' && el.textContent.startsWith('참고'));
    expect(lastHeader.textContent).toContain('▶');
    expect(noteHeader.textContent).toContain('▶');
  });

  it('Last 그룹 클릭 → 펼침 (▼) → 시작일/종료일/장소/링크 헤더 노출', () => {
    render(<MainTable conferences={makeConferences()} />);
    const lastHeader = screen.getByText((_, el) => el?.tagName === 'TH' && el.textContent.startsWith('Last'));
    fireEvent.click(lastHeader);
    expect(lastHeader.textContent).toContain('▼');
    // Upcoming + Last 두 그룹 모두 '시작일' 헤더 가짐 → 2개
    expect(screen.getAllByText('시작일', { selector: 'th' })).toHaveLength(2);
  });
});

// --- 정렬 ---

describe('정렬', () => {
  it('upcoming_start 기준 asc: 빈값 하단, 날짜 있는 것 먼저', () => {
    const rows = [ROW_NO_UPCOMING, ROW_FLUID, ROW_HEAT];
    render(<MainTable conferences={makeConferences(rows)} />);

    const cells = screen.getAllByRole('cell');
    const names = cells
      .filter((c) => ['Thermal Engineering Conf', 'Fluid Dynamics Symposium', 'HVAC International'].includes(c.textContent))
      .map((c) => c.textContent);

    // TEC(09-01) < FDS(11-01) < HVAC(없음)
    expect(names[0]).toBe('Thermal Engineering Conf');
    expect(names[1]).toBe('Fluid Dynamics Symposium');
    expect(names[2]).toBe('HVAC International');
  });

  it('같은 컬럼 헤더 클릭 시 asc → desc 토글', () => {
    const rows = [ROW_HEAT, ROW_FLUID];
    render(<MainTable conferences={makeConferences(rows)} />);

    // Upcoming 그룹의 첫 번째 '시작일' 헤더 (Last 그룹에도 동명 헤더 존재)
    const startHeader = screen.getAllByText('시작일', { selector: 'th' })[0];

    // 첫 클릭: desc
    fireEvent.click(startHeader);
    let cells = screen.getAllByRole('cell');
    let names = cells
      .filter((c) => ['Thermal Engineering Conf', 'Fluid Dynamics Symposium'].includes(c.textContent))
      .map((c) => c.textContent);
    expect(names[0]).toBe('Fluid Dynamics Symposium'); // 11-01이 먼저

    // 두 번째 클릭: asc 복귀
    fireEvent.click(startHeader);
    cells = screen.getAllByRole('cell');
    names = cells
      .filter((c) => ['Thermal Engineering Conf', 'Fluid Dynamics Symposium'].includes(c.textContent))
      .map((c) => c.textContent);
    expect(names[0]).toBe('Thermal Engineering Conf'); // 09-01이 먼저
  });
});
