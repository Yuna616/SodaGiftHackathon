'use client';

import { useEffect, useState } from 'react';
import { track } from '@/lib/track';

export default function InviteShareSheet({
  participantId,
  campaignId,
  campaignTitle,
}: {
  participantId: string;
  campaignId: string;
  campaignTitle: string;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId, campaignId }),
    })
      .then((r) => r.json())
      .then((data) => {
        setToken(data.token);
        setCompletedCount(data.completedCount);
        setMultiplier(data.multiplier);
      });
  }, [participantId, campaignId]);

  if (!token) {
    return <div className="h-24 rounded-2xl bg-gray-100 animate-pulse" />;
  }

  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${token}`;
  const shareText = `SodaPick에서 "${campaignTitle}" 예측 중! 같이 참여하면 나는 배수가 올라가요`;

  async function handleShare() {
    track('invite_link_shared', { participantId, campaignId });
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'SodaPick', text: shareText, url: shareUrl });
        return;
      } catch {
        // 사용자가 공유를 취소한 경우, 아래 클립보드 복사로 대체
      }
    }
    await handleCopy();
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드 접근 불가 시 조용히 무시
    }
  }

  return (
    <div className="rounded-2xl border border-soda-100 bg-soda-50/60 p-4">
      <p className="text-sm font-semibold text-gray-900 mb-1">친구를 초대하면 배수가 올라가요</p>
      <p className="text-xs text-gray-500 mb-3">
        친구 {completedCount}명 초대 완료 → 현재 <span className="text-soda-600 font-semibold">x{multiplier}</span>
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleShare}
          className="flex-1 rounded-xl bg-black text-white text-sm font-semibold py-2.5 active:scale-[0.98] transition"
        >
          링크 공유하기
        </button>
        <button
          onClick={handleCopy}
          className="rounded-xl border border-gray-200 text-gray-600 text-sm font-medium px-3.5 py-2.5"
        >
          {copied ? '복사됨' : '링크 복사'}
        </button>
      </div>
    </div>
  );
}
