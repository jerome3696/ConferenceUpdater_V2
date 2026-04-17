import { describe, it, expect } from 'vitest';
import { formatLocation } from './locationFormatter';

describe('formatLocation', () => {
  it('US: 3-segment 그대로 USA', () => {
    expect(formatLocation('Chicago, Illinois, USA')).toBe('Chicago, Illinois, USA');
  });

  it('US: "United States" → "USA"', () => {
    expect(formatLocation('Orlando, Florida, United States')).toBe('Orlando, Florida, USA');
  });

  it('US: "U.S.A." → "USA"', () => {
    expect(formatLocation('Boston, Massachusetts, U.S.A.')).toBe('Boston, Massachusetts, USA');
  });

  it('US: "US" → "USA"', () => {
    expect(formatLocation('Cambridge, US')).toBe('Cambridge, USA');
  });

  it('US: "United States of America" → "USA"', () => {
    expect(formatLocation('NYC, NY, United States of America')).toBe('NYC, NY, USA');
  });

  it('비-US: 통과', () => {
    expect(formatLocation('Frankfurt, Germany')).toBe('Frankfurt, Germany');
    expect(formatLocation('Vancouver, Canada')).toBe('Vancouver, Canada');
    expect(formatLocation('Seoul, South Korea')).toBe('Seoul, South Korea');
  });

  it('빈 입력', () => {
    expect(formatLocation('')).toBe('');
    expect(formatLocation(null)).toBe('');
    expect(formatLocation(undefined)).toBe('');
  });

  it('공백·중복 콤마 정리', () => {
    expect(formatLocation('  Tokyo ,  Japan  ')).toBe('Tokyo, Japan');
    expect(formatLocation('Berlin,, Germany')).toBe('Berlin, Germany');
  });

  it('단일 토큰: 그대로 반환', () => {
    expect(formatLocation('Online')).toBe('Online');
  });

  it('소문자 입력 정규화', () => {
    expect(formatLocation('Seattle, Washington, usa')).toBe('Seattle, Washington, USA');
  });
});
