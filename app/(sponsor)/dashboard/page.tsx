"use client";

// PRD 5.1 대시보드 홈. 프로필 사이드바 + 캠페인 목록 렌더링은 SponsorProfileView가
// 맡고, 이 페이지는 스폰서 콘솔 전용 데이터(지갑 잔액/지급 실패 포함)를 가져와
// viewer="owner"로 넘기는 역할만 한다. 참가자가 보는 공개 프로필(/sponsors/:id)은
// 같은 컴포넌트를 viewer="public"으로 쓰되 그 데이터 자체를 안 받는다.

import { useEffect, useState } from "react";
import {
  SponsorProfileView,
  type CampaignSummary,
  type ProfileStats,
  type SponsorProfile,
} from "../_components/SponsorProfileView";
import { DEMO_SPONSOR_ID } from "@/lib/constants";

export default function SponsorDashboard() {
  const [sponsor, setSponsor] = useState<SponsorProfile | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignSummary[] | null>(null);
  const [balance, setBalance] = useState<{ amount: number; currency: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/sponsors/${DEMO_SPONSOR_ID}/campaigns`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) return setError(data.error);
        setSponsor(data.sponsor);
        setStats(data.stats);
        setCampaigns(data.campaigns ?? []);
      });
    fetch("/api/wallet/balance")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setBalance({ amount: data.balance, currency: data.currency });
      });
  }, []);

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "캠페인 삭제에 실패했습니다.");
      return;
    }
    setCampaigns((prev) => (prev ?? []).filter((c) => c.id !== id));
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/sponsors/${DEMO_SPONSOR_ID}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 접근 실패 시 조용히 무시
    }
  };

  return (
    <SponsorProfileView
      viewer="owner"
      sponsor={sponsor}
      stats={stats}
      campaigns={campaigns}
      balance={balance}
      error={error}
      onDelete={handleDelete}
      onCreateCampaign={() => (window.location.href = "/campaigns/new")}
      onShare={handleShare}
      shareLabel={copied ? "복사됨" : "공유"}
      onProfileUpdate={(updated) => setSponsor(updated)}
    />
  );
}
