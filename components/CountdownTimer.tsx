'use client';

import { useEffect, useState } from 'react';

function formatRemaining(ms: number): string {
  if (ms <= 0) return '마감';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (days > 0) return `${days}일 ${hours}시간 남음`;
  if (hours > 0) return `${hours}시간 ${minutes}분 남음`;
  if (minutes > 0) return `${minutes}분 ${seconds}초 남음`;
  return `${seconds}초 남음`;
}

export default function CountdownTimer({ endAt, className }: { endAt: string; className?: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = new Date(endAt).getTime() - now;
  const closed = remaining <= 0;

  return (
    <span
      className={`${className ?? ''} ${closed ? 'text-gray-400' : 'text-rose-500'} font-semibold tabular-nums`}
    >
      {formatRemaining(remaining)}
    </span>
  );
}
