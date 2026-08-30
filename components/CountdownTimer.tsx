'use client';

import { useEffect, useState } from 'react';

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Closed';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (days > 0 || hours > 0) parts.push(`${hours}h`);
  if (days > 0 || hours > 0 || minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`); // 항상 초 단위까지 표기

  return `${parts.join(' ')} left`;
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
