'use client';

const KEY = 'sodapick_session';

export interface SodapickSession {
  participantId: string;
  email: string;
}

export function getSession(): SodapickSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SodapickSession) : null;
  } catch {
    return null;
  }
}

export function setSession(session: SodapickSession) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(KEY);
}

const REF_KEY = 'sodapick_ref_token';

export function setPendingInvite(token: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(REF_KEY, token);
}

export function getPendingInvite(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(REF_KEY);
}

export function clearPendingInvite() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(REF_KEY);
}
