'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ConsensusBar from '@/components/ConsensusBar';
import ConsensusTrendChart from '@/components/ConsensusTrendChart';
import CountdownTimer from '@/components/CountdownTimer';
import InviteShareSheet from '@/components/InviteShareSheet';
import { track } from '@/lib/track';
import { getSession, setSession, getPendingInvite, clearPendingInvite } from '@/lib/session';
import type { CampaignWithConsensus, ConsensusTrendPoint, Product } from '@/lib/types';

type Stage = 'pick' | 'confirm' | 'submitting' | 'done' | 'already';

function formatPrize(campaign: CampaignWithConsensus): string {
  if (campaign.prize_type === 'amount' && campaign.prize_amount) {
    return `💰 ${campaign.prize_amount.toLocaleString()}원 상당`;
  }
  return `🎁 ${campaign.prize_label}`;
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [campaign, setCampaign] = useState<CampaignWithConsensus | null>(null);
  const [trend, setTrend] = useState<ConsensusTrendPoint[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('pick');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const viewedTracked = useRef(false);

  useEffect(() => {
    if (!id) return;
    const load = () =>
      fetch(`/api/campaigns/${id}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.campaign) setCampaign(data.campaign);
        });
    const loadTrend = () =>
      fetch(`/api/campaigns/${id}/trend`)
        .then((r) => r.json())
        .then((data) => setTrend(data.points ?? []));
    load();
    loadTrend();
    const interval = setInterval(() => {
      load();
      loadTrend();
    }, 7000);
    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    fetch('/api/products?country_code=KR')
      .then((r) => r.json())
      .then((data) => setProducts((data.products ?? []).slice(0, 3)));
  }, []);

  useEffect(() => {
    if (!campaign || viewedTracked.current) return;
    viewedTracked.current = true;
    track('campaign_viewed', { campaignId: campaign.id });

    const session = getSession();
    if (session) {
      setEmail(session.email);
      fetch('/api/participants/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: session.email }),
      })
        .then((r) => r.json())
        .then((data) => {
          const existing = data.predictions?.find((p: { campaign_id: string }) => p.campaign_id === campaign.id);
          if (existing) {
            setSelected(existing.selected_option);
            setParticipantId(data.participant.id);
            setStage('already');
          }
        })
        .catch(() => {});
    }
  }, [campaign]);

  if (!campaign) {
    return (
      <div className="p-4">
        <div className="h-6 w-24 rounded bg-gray-100 animate-pulse mb-4" />
        <div className="h-40 rounded-2xl bg-gray-100 animate-pulse" />
      </div>
    );
  }

  const closed = campaign.status !== 'active' || new Date(campaign.end_at).getTime() < Date.now();

  async function handleSubmit() {
    if (!selected || !email) return;
    setStage('submitting');
    setError(null);
    const inviteToken = getPendingInvite();
    try {
      const res = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: campaign!.id,
          email,
          selectedOption: selected,
          inviteToken: inviteToken ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error === 'CAMPAIGN_CLOSED' ? '이미 마감된 캠페인입니다' : '제출에 실패했습니다');
        setStage('confirm');
        return;
      }
      setSession({ participantId: data.participant.id, email: data.participant.email });
      setParticipantId(data.participant.id);
      if (inviteToken) clearPendingInvite();
      setStage(data.alreadySubmitted ? 'already' : 'done');
      if (data.alreadySubmitted) setSelected(data.prediction.selected_option);
    } catch {
      setError('네트워크 오류가 발생했어요. 다시 시도해주세요');
      setStage('confirm');
    }
  }

  return (
    <div className="pb-6">
      <div className="relative aspect-[16/9] w-full bg-black">
        {campaign.media_type === 'video' ? (
          <video
            src={campaign.media_url}
            className="h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            controls
          />
        ) : (
          <img src={campaign.media_url} alt="" className="h-full w-full object-cover" />
        )}
        <button
          onClick={() => router.push('/')}
          className="absolute top-3 left-3 h-8 w-8 rounded-full bg-black/50 text-white flex items-center justify-center text-sm backdrop-blur"
        >
          ←
        </button>
      </div>

      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-soda-600 bg-soda-50 rounded-full px-2.5 py-1">
            {campaign.sponsor_name} 제공
          </span>
          <span className="text-xs font-semibold text-gray-500 bg-gray-100 rounded-full px-2.5 py-1">
            총 {campaign.winner_count}명 당첨
          </span>
        </div>
        <p className="text-2xl font-extrabold text-gray-900 leading-snug mb-1">{formatPrize(campaign)}</p>
        <h1 className="text-sm text-gray-500 mb-3">{campaign.title}</h1>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {campaign.status === 'active' && !closed ? (
            <CountdownTimer endAt={campaign.end_at} />
          ) : (
            <span className="text-gray-400">참여 마감</span>
          )}
          <span>·</span>
          <span>{campaign.total_predictions}명 참여중</span>
        </div>
      </div>

      <div className="p-4">
        <p className="text-sm text-gray-600 mb-4">{campaign.resolution_criteria}</p>

        <div className="flex flex-col gap-2 mb-4">
          {campaign.options.map((opt) => (
            <ConsensusBar
              key={opt.id}
              label={opt.label}
              percent={campaign.consensus[opt.id] ?? 0}
              selected={selected === opt.id}
              disabled={closed || stage === 'already' || stage === 'done' || stage === 'submitting'}
              onClick={() => {
                setSelected(opt.id);
                setStage('confirm');
              }}
            />
          ))}
        </div>

        <div className="mb-5">
          <p className="text-xs font-semibold text-gray-500 mb-2">선택 비중 추이</p>
          <ConsensusTrendChart options={campaign.options} points={trend} />
        </div>

        {products.length > 0 && stage !== 'done' && stage !== 'already' && (
          <div className="mb-5 rounded-xl bg-gray-50 p-3">
            <p className="text-xs font-semibold text-gray-500 mb-2">당첨 시 받을 수 있는 상품 미리보기</p>
            <div className="flex gap-2 flex-wrap">
              {products.map((p) => (
                <span key={p.id} className="text-xs bg-white border border-gray-200 rounded-full px-2.5 py-1">
                  {p.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {closed && stage !== 'already' && (
          <p className="text-sm text-center text-gray-400 py-6">이미 마감된 캠페인입니다</p>
        )}

        {!closed && stage === 'confirm' && selected && (
          <div className="rounded-2xl border border-gray-200 p-4">
            <p className="text-sm font-medium text-gray-800 mb-3">
              선택하신 예측:{' '}
              <span className="text-soda-600 font-semibold">
                {campaign.options.find((o) => o.id === selected)?.label}
              </span>
            </p>
            <label className="block text-xs font-medium text-gray-500 mb-1">이메일로 참여</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm mb-3 outline-none focus:border-soda-400"
            />
            {error && <p className="text-xs text-rose-500 mb-2">{error}</p>}
            <button
              onClick={handleSubmit}
              disabled={!email}
              className="w-full rounded-xl bg-black text-white font-semibold py-3 text-sm disabled:opacity-40"
            >
              제출하기
            </button>
            <p className="text-[11px] text-gray-400 mt-2 text-center">
              비밀번호나 결제 정보 없이, 이메일만으로 참여할 수 있어요
            </p>
          </div>
        )}

        {stage === 'submitting' && (
          <div className="text-center py-6 text-sm text-gray-400">제출 중이에요...</div>
        )}

        {(stage === 'done' || stage === 'already') && participantId && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl bg-soda-50 border border-soda-100 p-4 text-center">
              <p className="text-sm font-semibold text-soda-700">
                {stage === 'already' ? '이미 참여하셨어요' : '예측 제출 완료!'}
              </p>
              <p className="text-xs text-soda-600 mt-1">
                {campaign.options.find((o) => o.id === selected)?.label}에 예측했어요. 결과는 마이페이지에서
                확인할 수 있어요.
              </p>
              <Link href="/my" className="inline-block mt-3 text-xs font-semibold text-soda-700 underline">
                마이페이지로 이동
              </Link>
            </div>
            {!closed && (
              <InviteShareSheet participantId={participantId} campaignId={campaign.id} campaignTitle={campaign.title} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
