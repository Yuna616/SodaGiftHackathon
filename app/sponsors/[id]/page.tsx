"use client";

// 참가자를 포함한 다른 유저가 보는 공개 스폰서 프로필. 고객사 콘솔 대시보드와
// 같은 SponsorProfileView를 viewer="public"으로 그려서, 지갑 잔액/지급 실패 같은
// 콘솔 전용 정보 없이 프로필과 발행된 캠페인 목록만 보여준다.
// 스폰서 콘솔 헤더(/dashboard 링크 등)도, 참가자 앱 하단 탭도 필요 없어서
// 두 route group 밖에 독립 라우트로 뒀다.

import { useEffect, useState } from "react";
import {
  SponsorProfileView,
  type CampaignSummary,
  type ProfileStats,
  type SponsorProfile,
} from "@/app/(sponsor)/_components/SponsorProfileView";

export default function PublicSponsorProfilePage({ params }: { params: { id: string } }) {
  const [sponsor, setSponsor] = useState<SponsorProfile | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/sponsors/${params.id}/profile`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) return setError(data.error);
        setSponsor(data.sponsor);
        setStats(data.stats);
        setCampaigns(data.campaigns ?? []);
      });
  }, [params.id]);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 접근 실패 시 조용히 무시
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-6 py-4">
          <a href="/" className="text-lg font-bold text-brand-600">
            SodaPick
          </a>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
            고객사 프로필
          </span>
          <div className="ml-auto flex items-center gap-3">
            {/* 개발 편의용 — 대시보드에서 "참가자 화면으로 보기"로 넘어온 스폰서가 바로 돌아갈 수 있게 */}
            <a href="/dashboard" className="text-xs text-slate-400 underline hover:text-slate-600">
              고객사 대시보드로
            </a>
            <a href="/" className="text-xs text-slate-400 underline hover:text-slate-600">
              참가자 앱으로
            </a>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <SponsorProfileView
          viewer="public"
          sponsor={sponsor}
          stats={stats}
          campaigns={campaigns}
          error={error ? "존재하지 않는 스폰서예요." : null}
          onShare={handleShare}
          shareLabel={copied ? "복사됨" : "공유"}
        />
      </div>
    </div>
  );
}
