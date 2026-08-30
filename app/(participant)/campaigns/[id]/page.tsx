'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ConsensusBar from '@/components/ConsensusBar';
import ConsensusTrendChart from '@/components/ConsensusTrendChart';
import CountdownTimer from '@/components/CountdownTimer';
import InviteShareSheet from '@/components/InviteShareSheet';
import FloatingPickBar, { type PickBarVariant } from '@/components/FloatingPickBar';
import GoogleAccountPicker from '@/components/GoogleAccountPicker';
import { track } from '@/lib/track';
import { toDisplayProducts } from '@/lib/products';
import { getSession, setSession, getPendingInvite, clearPendingInvite } from '@/lib/session';
import type { PublicCampaignWithConsensus, ConsensusTrendPoint, Product } from '@/lib/types';
import type { SodaProduct } from '@/lib/soda/client';

type Stage = 'pick' | 'confirm' | 'submitting' | 'done' | 'already';
type PendingAction = 'submit' | 'visit' | null;

function formatPrizeLine(campaign: PublicCampaignWithConsensus): string {
  const reward =
    campaign.prize_type === 'amount' && campaign.prize_amount
      ? `${campaign.prize_currency ?? 'KRW'} ${campaign.prize_amount.toLocaleString()}`
      : `🎁 ${campaign.prize_label}`;
  return campaign.winner_count !== null ? `${reward} · up to ${campaign.winner_count} winners` : reward;
}

export default function CampaignDetailPage() {
  return (
    <Suspense fallback={<div className="p-4"><div className="h-40 rounded-2xl bg-gray-100 animate-pulse" /></div>}>
      <CampaignDetailContent />
    </Suspense>
  );
}

function CampaignDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedOption = searchParams.get('option');

  const [campaign, setCampaign] = useState<PublicCampaignWithConsensus | null>(null);
  const [trend, setTrend] = useState<ConsensusTrendPoint[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('pick');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [gateCleared, setGateCleared] = useState(false);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [pendingAfterLogin, setPendingAfterLogin] = useState<PendingAction>(null);
  const [missionHighlight, setMissionHighlight] = useState(false);
  const viewedTracked = useRef(false);
  const optionsRef = useRef<HTMLDivElement>(null);
  const inviteRef = useRef<HTMLDivElement>(null);
  const missionSectionRef = useRef<HTMLDivElement>(null);

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
    // 미리보기는 스폰서가 실제로 고른 캠페인 카탈로그 기준으로 보여준다(전체 상품 중 아무거나
    // 3개가 아니라). CREDIT 모드는 상품 카탈로그가 없어서(당첨 후 브랜드를 직접 고르는 방식) 스킵.
    if (!campaign || campaign.prize_type !== 'item') return;
    Promise.all([
      fetch('/api/products').then((r) => r.json()),
      fetch(`/api/campaigns/${campaign.id}/catalog`).then((r) => r.json()),
    ]).then(([productsData, catalogData]) => {
      const allProducts = (productsData.products ?? []) as SodaProduct[];
      const allowedIds = new Set((catalogData.items ?? []).map((i: { product_id: string }) => i.product_id));
      setProducts(toDisplayProducts(allProducts).filter((p) => allowedIds.has(p.id)));
    });
  }, [campaign]);

  useEffect(() => {
    if (!campaign || viewedTracked.current) return;
    viewedTracked.current = true;
    track('campaign_viewed', { campaignId: campaign.id });

    const applyPreselectedOption = () => {
      if (campaign.status !== 'active') return;
      if (preselectedOption && campaign.options.some((o) => o.id === preselectedOption)) {
        setSelected(preselectedOption);
        setStage('confirm');
      }
    };

    const session = getSession();
    if (session) {
      setEmail(session.email);
      setParticipantId(session.participantId);
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
            return;
          }
          applyPreselectedOption();
          if (campaign.mission_url) {
            fetch(`/api/campaigns/${campaign.id}/missions/status?participant_id=${session.participantId}`)
              .then((r) => r.json())
              .then((status) => setGateCleared(!!status.completed))
              .catch(() => {});
          }
        })
        .catch(() => {});
    } else {
      applyPreselectedOption();
    }
  }, [campaign, preselectedOption]);

  if (!campaign) {
    return (
      <div className="p-4">
        <div className="h-6 w-24 rounded bg-gray-100 animate-pulse mb-4" />
        <div className="h-40 rounded-2xl bg-gray-100 animate-pulse" />
      </div>
    );
  }

  const closed = campaign.status !== 'active';

  async function handleSubmit(emailArg?: string) {
    const submitEmail = emailArg ?? email;
    if (!selected || !submitEmail) return;
    setStage('submitting');
    setError(null);
    const inviteToken = getPendingInvite();
    try {
      const res = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: campaign!.id,
          email: submitEmail,
          selectedOption: selected,
          inviteToken: inviteToken ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'MISSION_REQUIRED') {
          if (data.participantId) setParticipantId(data.participantId);
          setGateCleared(false);
          setStage('confirm');
          focusMissionSection();
          return;
        }
        setError(data.error === 'CAMPAIGN_CLOSED' ? 'This campaign has already closed' : 'Submission failed');
        setStage('confirm');
        return;
      }
      setSession({ participantId: data.participant.id, email: data.participant.email });
      setParticipantId(data.participant.id);
      if (inviteToken) clearPendingInvite();
      setStage(data.alreadySubmitted ? 'already' : 'done');
      if (data.alreadySubmitted) setSelected(data.prediction.selected_option);
    } catch {
      setError('A network error occurred. Please try again');
      setStage('confirm');
    }
  }

  function focusMissionSection() {
    setMissionHighlight(true);
    missionSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => setMissionHighlight(false), 2200);
  }

  async function ensureParticipantId(currentEmail: string): Promise<string> {
    if (participantId) return participantId;
    const res = await fetch('/api/participants/identify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: currentEmail }),
    });
    const data = await res.json();
    setParticipantId(data.participant.id);
    setSession({ participantId: data.participant.id, email: currentEmail });
    return data.participant.id;
  }

  async function doMissionVisit(currentEmail: string) {
    const pid = await ensureParticipantId(currentEmail);
    window.open(`/api/campaigns/${campaign!.id}/missions/visit?participant_id=${pid}`, '_blank', 'noopener,noreferrer');
    setGateCleared(true);
    track('mission_completed', { participantId: pid, campaignId: campaign!.id });
  }

  async function checkMissionAndProceed(currentEmail: string) {
    if (!campaign!.mission_url) {
      handleSubmit(currentEmail);
      return;
    }
    const pid = await ensureParticipantId(currentEmail);
    const res = await fetch(`/api/campaigns/${campaign!.id}/missions/status?participant_id=${pid}`);
    const data = await res.json();
    if (!data.completed) {
      setGateCleared(false);
      focusMissionSection();
      return;
    }
    setGateCleared(true);
    handleSubmit(currentEmail);
  }

  function handlePickAttempt() {
    if (email) {
      checkMissionAndProceed(email);
    } else {
      setPendingAfterLogin('submit');
      setShowAccountPicker(true);
    }
  }

  function handleMissionVisitClick() {
    if (email) {
      doMissionVisit(email);
    } else {
      setPendingAfterLogin('visit');
      setShowAccountPicker(true);
    }
  }

  function handleAccountPicked(pickedEmail: string) {
    setEmail(pickedEmail);
    setShowAccountPicker(false);
    if (pendingAfterLogin === 'visit') {
      setPendingAfterLogin(null);
      doMissionVisit(pickedEmail);
    } else {
      setPendingAfterLogin(null);
      checkMissionAndProceed(pickedEmail);
    }
  }

  // 플로팅 바: 지금 이 화면에서 참가자가 다음으로 해야 할 단 하나의 행동을 항상 보여준다.
  // 스크롤 위치와 무관하게 하단에 늘 떠 있어야 하므로, 마감된 캠페인이라도 숨기지 않고
  // 상태에 맞는 안내 문구로 채운다 (variant: 'hidden'은 이제 안 쓰지만 타입은 유지).
  // 미션 게이트는 이 바의 기본 라벨을 가리지 않는다 — 항상 "PICK"이고, 미완료 상태에서
  // 누르면 하단 미션 섹션으로 포커스만 이동한다.
  function pickBarProps(): { variant: PickBarVariant; label: string; subtext?: string; onClick: () => void } {
    if (closed) {
      if (stage === 'done' || stage === 'already') {
        return {
          variant: 'muted',
          label: 'Check the results on My Page',
          onClick: () => router.push('/my'),
        };
      }
      return { variant: 'muted', label: 'This campaign has already closed', onClick: () => {} };
    }
    if (stage === 'done' || stage === 'already') {
      return {
        variant: 'invite',
        label: 'Invite friends to boost your multiplier',
        onClick: () => inviteRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
      };
    }
    if (stage === 'submitting') {
      return { variant: 'muted', label: 'Submitting...', onClick: () => {} };
    }
    if (!selected) {
      return {
        variant: 'muted',
        label: 'Please select an option',
        onClick: () => optionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
      };
    }
    return {
      variant: 'primary',
      label: 'PICK',
      onClick: handlePickAttempt,
    };
  }

  const barProps = pickBarProps();

  return (
    <div className="pb-28">
      <div className="relative aspect-[16/9] w-full bg-black">
        {campaign.media_url ? (
          campaign.media_type === 'video' ? (
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
            // eslint-disable-next-line @next/next/no-img-element
            <img src={campaign.media_url} alt="" className="h-full w-full object-cover" />
          )
        ) : null}
        <button
          onClick={() => router.back()}
          className="absolute top-3 left-3 h-8 w-8 rounded-full bg-black/50 text-white flex items-center justify-center text-sm backdrop-blur"
        >
          ←
        </button>
      </div>

      <div className="p-4 border-b border-gray-100">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-soda-600 bg-soda-50 rounded-full px-2.5 py-1">
          Presented by {campaign.sponsor_name}
        </span>
        <h1 className="text-2xl font-extrabold text-gray-900 leading-snug mt-2 mb-1">{campaign.title}</h1>
        <p className="text-sm text-gray-500 text-right mb-3">{formatPrizeLine(campaign)}</p>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {campaign.status === 'active' ? (
            <CountdownTimer endAt={campaign.end_at} />
          ) : (
            <span className="text-gray-400">Closed</span>
          )}
          <span>·</span>
          <span>{campaign.total_predictions} participating</span>
        </div>
      </div>

      <div className="p-4">
        <p className="text-sm text-gray-600 mb-4">{campaign.resolution_criteria}</p>

        <div ref={optionsRef} className="flex flex-col gap-2 mb-4">
          {campaign.options.map((opt) => (
            <ConsensusBar
              key={opt.id}
              label={opt.label}
              percent={campaign.consensus[opt.id] ?? 0}
              count={campaign.counts[opt.id] ?? 0}
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
          <p className="text-xs font-semibold text-gray-500 mb-2">Pick share over time</p>
          <ConsensusTrendChart options={campaign.options} points={trend} />
        </div>

        {campaign.mission_url && (
          <div
            ref={missionSectionRef}
            className={`mb-5 rounded-2xl border p-4 transition ${
              missionHighlight ? 'border-rose-400 ring-2 ring-rose-200' : 'border-gray-200'
            }`}
          >
            {gateCleared ? (
              <>
                <p className="text-sm font-semibold text-gray-900 mb-3">
                  ✓ You've visited {campaign.sponsor_name}'s page
                </p>
                <button disabled className="w-full rounded-xl bg-gray-100 text-gray-400 font-semibold py-3 text-sm">
                  Page visit complete
                </button>
              </>
            ) : (
              <>
                <p className={`text-sm mb-3 ${missionHighlight ? 'text-rose-600 font-semibold' : 'text-gray-700'}`}>
                  {missionHighlight
                    ? 'You need to visit this page to participate'
                    : `Visit the page ${campaign.sponsor_name} prepared to join the PICK`}
                </p>
                <button
                  onClick={handleMissionVisitClick}
                  className="w-full rounded-xl border border-gray-300 bg-white py-3 text-sm font-semibold text-gray-700"
                >
                  Visit {campaign.sponsor_name}'s event page
                </button>
              </>
            )}
          </div>
        )}

        {stage !== 'done' && stage !== 'already' && campaign.prize_type === 'amount' && (
          <div className="mb-5 rounded-2xl bg-soda-50 border border-soda-100 p-4">
            <p className="text-sm font-bold text-soda-700 mb-1.5">🎉 Reward if you win</p>
            <p className="text-base text-gray-800 leading-relaxed">
              Winners split{' '}
              <span className="font-extrabold text-soda-600">
                {campaign.prize_currency} {campaign.prize_amount?.toLocaleString()}
              </span>
              {' '}evenly.
            </p>
          </div>
        )}

        {products.length > 0 && stage !== 'done' && stage !== 'already' && campaign.prize_type === 'item' && (
          <div className="mb-5 rounded-2xl bg-soda-50 border border-soda-100 p-4">
            <p className="text-sm font-bold text-soda-700 mb-2">🎉 Preview of prizes if you win</p>
            <div className="flex gap-2 flex-wrap">
              {products.map((p) => (
                <span
                  key={p.id}
                  className="text-sm font-medium bg-white border border-soda-200 text-gray-800 rounded-full px-3 py-1.5"
                >
                  {p.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {!closed && stage === 'confirm' && error && (
          <p className="text-xs text-center text-rose-500 mb-4">{error}</p>
        )}

        {stage === 'submitting' && (
          <div className="text-center py-6 text-sm text-gray-400">Submitting...</div>
        )}

        {(stage === 'done' || stage === 'already') && participantId && (
          <div ref={inviteRef} className="flex flex-col gap-4">
            <div className="rounded-2xl bg-soda-50 border border-soda-100 p-4 text-center">
              <p className="text-sm font-semibold text-soda-700">
                {stage === 'already' ? "You've already participated" : 'Prediction submitted!'}
              </p>
              <p className="text-xs text-soda-600 mt-1">
                You predicted {campaign.options.find((o) => o.id === selected)?.label}. Check the results on
                My Page.
              </p>
              <Link href="/my" className="inline-block mt-3 text-xs font-semibold text-soda-700 underline">
                Go to My Page
              </Link>
            </div>
            {!closed && (
              <InviteShareSheet participantId={participantId} campaignId={campaign.id} campaignTitle={campaign.title} />
            )}
          </div>
        )}
      </div>

      <FloatingPickBar {...barProps} />

      {showAccountPicker && (
        <GoogleAccountPicker
          onSelect={handleAccountPicked}
          onClose={() => {
            setShowAccountPicker(false);
            setPendingAfterLogin(null);
          }}
        />
      )}
    </div>
  );
}
