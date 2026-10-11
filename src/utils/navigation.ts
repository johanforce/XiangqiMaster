import React from 'react';

export type MainTab = 'home' | 'ai' | 'ranked' | 'viewer' | 'leaderboard' | 'admin';

export function navigateUrl(url: string, replace = false) {
  const current = window.location.pathname + window.location.search;
  if (current === url) return;
  if (replace) {
    window.history.replaceState({}, '', url);
  } else {
    window.history.pushState({}, '', url);
  }
  window.dispatchEvent(new Event('app:locationchange'));
}

export function handleLinkClick(
  e: React.MouseEvent<HTMLAnchorElement>,
  url: string,
  customAction?: () => void
) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
    return;
  }
  e.preventDefault();
  navigateUrl(url);
  if (customAction) customAction();
}

export function getMainTabFromPath(pathname: string): MainTab {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/' || clean === '/home') return 'home';
  if (clean.startsWith('/ai')) return 'ai';
  if (clean.startsWith('/ranked')) return 'ranked';
  if (clean.startsWith('/viewer')) return 'viewer';
  if (clean.startsWith('/leaderboard')) return 'leaderboard';
  if (clean.startsWith('/admin')) return 'admin';
  return 'home';
}
