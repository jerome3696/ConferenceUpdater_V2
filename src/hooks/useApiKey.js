import { useState } from 'react';

const STORAGE_KEY = 'conferenceFinder.apiKey';

export function useApiKey() {
  const [apiKey, setApiKeyState] = useState(
    () => localStorage.getItem(STORAGE_KEY) || ''
  );

  const setApiKey = (key) => {
    const trimmed = (key || '').trim();
    localStorage.setItem(STORAGE_KEY, trimmed);
    setApiKeyState(trimmed);
  };

  const clearApiKey = () => {
    localStorage.removeItem(STORAGE_KEY);
    setApiKeyState('');
  };

  return {
    apiKey,
    setApiKey,
    clearApiKey,
    hasKey: apiKey.length > 0,
  };
}

export function maskApiKey(key) {
  if (!key) return '';
  if (key.length <= 12) return '****';
  return `${key.slice(0, 7)}****...${key.slice(-4)}`;
}
