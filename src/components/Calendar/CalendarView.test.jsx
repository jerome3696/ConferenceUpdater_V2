import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CalendarView from './CalendarView';

vi.mock('./YearTimeline', () => ({
  default: ({ rows }) => <div data-testid="year-view">year:{rows.length}</div>,
}));
vi.mock('./MonthGrid', () => ({
  default: ({ rows }) => <div data-testid="month-view">month:{rows.length}</div>,
}));

const ROWS = [
  { id: 'a', full_name: 'A', starred: 1, upcoming: { start_date: '2026-03-05', end_date: '2026-03-08' } },
  { id: 'b', full_name: 'B', starred: 0, upcoming: { start_date: '2026-04-10', end_date: '2026-04-12' } },
  { id: 'c', full_name: 'C', starred: 2, upcoming: { start_date: '2026-05-01' } },
];

describe('CalendarView', () => {
  it('scope=starred: starred 1 이상만 전달', () => {
    render(
      <CalendarView rows={ROWS} filtering={null} scope="starred" subView="year" onChangeSubView={() => {}} />
    );
    expect(screen.getByTestId('year-view').textContent).toBe('year:2');
    expect(screen.getByText(/즐겨찾기/)).toBeInTheDocument();
  });

  it('scope=filter: filtering.filtered 전달', () => {
    const filtering = { filtered: [ROWS[1]] };
    render(
      <CalendarView rows={ROWS} filtering={filtering} scope="filter" subView="year" onChangeSubView={() => {}} />
    );
    expect(screen.getByTestId('year-view').textContent).toBe('year:1');
    expect(screen.getByText(/테이블 필터 결과/)).toBeInTheDocument();
  });

  it('subView 토글 클릭 시 onChangeSubView 호출', () => {
    const onChange = vi.fn();
    render(
      <CalendarView rows={ROWS} filtering={null} scope="starred" subView="year" onChangeSubView={onChange} />
    );
    fireEvent.click(screen.getByText('월간'));
    expect(onChange).toHaveBeenCalledWith('month');
  });

  it('subView=month 일 때 MonthGrid 렌더', () => {
    render(
      <CalendarView rows={ROWS} filtering={null} scope="starred" subView="month" onChangeSubView={() => {}} />
    );
    expect(screen.getByTestId('month-view')).toBeInTheDocument();
    expect(screen.queryByTestId('year-view')).not.toBeInTheDocument();
  });
});
