'use client';

import { useState } from 'react';

const MOCK_ACCOUNTS = [
  { name: '김소다', email: 'soda.demo1@gmail.com', color: 'bg-soda-500' },
  { name: '박픽', email: 'pick.demo2@gmail.com', color: 'bg-amber-400' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z" />
    </svg>
  );
}

export default function GoogleAccountPicker({
  onSelect,
  onClose,
}: {
  onSelect: (email: string) => void;
  onClose: () => void;
}) {
  const [customMode, setCustomMode] = useState(false);
  const [customEmail, setCustomEmail] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-phone rounded-t-3xl bg-white p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-4">
          <GoogleMark />
          <p className="text-sm font-semibold text-gray-900">계정 선택</p>
        </div>
        <p className="text-xs text-gray-400 mb-4">SodaPick(으)로 이동할 계정을 선택하세요 (데모용 mock 로그인)</p>

        <div className="flex flex-col gap-1 mb-3">
          {MOCK_ACCOUNTS.map((acc) => (
            <button
              key={acc.email}
              onClick={() => onSelect(acc.email)}
              className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-gray-50 active:bg-gray-100"
            >
              <span
                className={`h-9 w-9 shrink-0 rounded-full ${acc.color} text-white flex items-center justify-center text-sm font-semibold`}
              >
                {acc.name[0]}
              </span>
              <span>
                <span className="block text-sm text-gray-900">{acc.name}</span>
                <span className="block text-xs text-gray-400">{acc.email}</span>
              </span>
            </button>
          ))}
        </div>

        {!customMode ? (
          <button
            onClick={() => setCustomMode(true)}
            className="w-full rounded-xl border border-gray-200 py-2.5 text-sm text-gray-600"
          >
            다른 이메일 사용
          </button>
        ) : (
          <div className="flex gap-2">
            <input
              type="email"
              autoFocus
              value={customEmail}
              onChange={(e) => setCustomEmail(e.target.value)}
              placeholder="you@example.com"
              className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-soda-400"
            />
            <button
              onClick={() => EMAIL_RE.test(customEmail) && onSelect(customEmail)}
              disabled={!EMAIL_RE.test(customEmail)}
              className="rounded-xl bg-black px-4 text-sm font-semibold text-white disabled:opacity-40"
            >
              확인
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
