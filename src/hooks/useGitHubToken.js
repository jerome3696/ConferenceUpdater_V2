import { useState } from 'react';

const STORAGE_KEY = 'conferenceFinder.githubToken';

export function useGitHubToken() {
  const [token, setTokenState] = useState(
    () => localStorage.getItem(STORAGE_KEY) || ''
  );

  const setToken = (value) => {
    const trimmed = (value || '').trim();
    localStorage.setItem(STORAGE_KEY, trimmed);
    setTokenState(trimmed);
  };

  const clearToken = () => {
    localStorage.removeItem(STORAGE_KEY);
    setTokenState('');
  };

  return {
    token,
    setToken,
    clearToken,
    hasToken: token.length > 0,
  };
}

export function maskToken(t) {
  if (!t) return '';
  if (t.length <= 10) return '****';
  return `${t.slice(0, 7)}****...${t.slice(-4)}`;
}
