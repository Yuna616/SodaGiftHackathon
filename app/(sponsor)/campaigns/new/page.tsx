"use client";

// PRD 5.2 캠페인 생성 마법사: 카드 정보 → 상세 화면 → 보상 설정(카탈로그 포함) → 예산 확인 → 발행
//
// 1단계(카드 정보)는 참가자 홈 피드 카드에 필요한 것만 — 제목/카테고리/이미지/
// 질문/옵션/기간. 2단계(상세 화면)는 카드를 눌러 들어갔을 때만 보이는 것 —
// 판정 기준, 참여 미션 URL. "어떻게 보상할지"(방식/금액/카탈로그)는 3단계에서
// 따로 다룬다 — 카탈로그 구성도 별도 단계가 아니라 PRODUCT 보상을 고른 라운드가
// 있을 때만 보상 설정 단계 안에 이어서 나온다(CREDIT만 쓰면 카탈로그 자체가 안 보임).

import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Callout, Card, Field, Input, Select } from "../../_components/ui";
import CampaignCard from "@/components/CampaignCard";
import { CampaignDetailPreview } from "../../_components/CampaignDetailPreview";
import type { CampaignOption, PublicCampaignWithConsensus } from "@/lib/types";

// TODO: 인증 붙기 전까지 seed된 데모 스폰서 id 하드코딩 (supabase에 직접 심어둔 값)
const DEMO_SPONSOR_ID = "72495905-2368-41a3-8eba-fef7a07fcc21";

type RewardMode = "PRODUCT" | "CREDIT";

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 8;

type RoundDraft = {
  round_number: number;
  question_text: string;
  options: string[];
  resolution_criteria: string;
  reward_mode: RewardMode;
  expected_winner_count: number; // PRODUCT 모드: 스폰서 직접 입력값
  credit_pool_amount: number; // CREDIT 모드: 라운드에 걸 고정 풀 금액
  credit_currency: string; // CREDIT 모드: 이 통화 안에서 당첨자가 브랜드를 직접 고름
  opens_at: string;
  closes_at: string;
};

type Product = {
  id: number;
  name: string;
  name_ko?: string | null;
  amount: number | null;
  min_amount?: number | null;
  max_amount?: number | null;
  currency: string;
  image_url: string | null;
  type: string;
};

// 소다기프트 원본 category(브랜드 카테고리)는 7개로 너무 잘게 갈려서 UX상 안 씀.
// type 기준 3분류 고정 (lib/soda/client.ts PRODUCT_TYPE_LABELS와 동일하게 유지)
const PRODUCT_TYPE_LABELS: Record<string, string> = {
  GIFT_CARD: "디지털 기프트 카드",
  DIGITAL_VOUCHER: "디지털 바우처",
  MERCHANDISE: "실물상품",
};
const PRODUCT_TYPE_ORDER = ["GIFT_CARD", "DIGITAL_VOUCHER", "MERCHANDISE"];
const PAGE_SIZE = 12;
const STEP_LABELS = ["카드 정보", "상세 화면", "보상 설정", "예산 확인", "발행"];

// 소다기프트 카탈로그에 실제로 등장하는 통화들(ISO 4217 코드 → 한글 이름).
// "USD"/"GBP" 코드만 보여주면 스폰서가 뭔지 못 알아봐서 괄호로 병기한다.
const CURRENCY_LABELS: Record<string, string> = {
  USD: "미국 달러",
  GBP: "영국 파운드",
  SGD: "싱가포르 달러",
  CAD: "캐나다 달러",
  KRW: "한국 원",
  VND: "베트남 동",
  CNY: "중국 위안",
  HKD: "홍콩 달러",
  JPY: "일본 엔",
  PHP: "필리핀 페소",
  AUD: "호주 달러",
  IDR: "인도네시아 루피아",
  TWD: "대만 달러",
  EUR: "유로",
};
function currencyLabel(code: string): string {
  return CURRENCY_LABELS[code] ? `${code} (${CURRENCY_LABELS[code]})` : code;
}

// 참가자 앱 카테고리 탭(components/CategoryTabs.tsx)과 값이 같아야 필터링에 걸린다.
const CATEGORY_OPTIONS = [
  { id: "kpop", label: "K팝" },
  { id: "esports", label: "e스포츠" },
  { id: "variety", label: "예능" },
  { id: "drama", label: "드라마" },
];

function groupByType(products: Product[]): Map<string, Product[]> {
  const groups = new Map<string, Product[]>();
  for (const p of products) {
    const list = groups.get(p.type) ?? [];
    list.push(p);
    groups.set(p.type, list);
  }
  return groups;
}

function formatPrice(p: Product): string {
  if (p.amount !== null) return `${p.amount} ${p.currency}`;
  if (p.min_amount != null && p.max_amount != null) {
    return `${p.min_amount}~${p.max_amount} ${p.currency}`;
  }
  return `가격 미정 (${p.currency})`;
}

// <input type="datetime-local">에 넣을 수 있는 "YYYY-MM-DDTHH:mm" 형식으로 변환
function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function emptyRound(n: number): RoundDraft {
  const now = new Date();
  const weekLater = new Date(now.getTime() + 7 * 86400000);
  return {
    round_number: n,
    question_text: "",
    options: ["", ""],
    resolution_criteria: "",
    reward_mode: "PRODUCT",
    expected_winner_count: 100,
    credit_pool_amount: 100,
    credit_currency: "",
    opens_at: toDatetimeLocalValue(now),
    closes_at: toDatetimeLocalValue(weekLater),
  };
}

function StepHeader({
  step,
  maxStepReached,
  onStepClick,
}: {
  step: number;
  maxStepReached: number;
  onStepClick: (n: number) => void;
}) {
  return (
    <div className="mb-8 flex items-center">
      {STEP_LABELS.map((label, i) => {
        const n = i + 1;
        const state = n < step ? "done" : n === step ? "active" : "todo";
        // 이미 한 번 검증을 통과해서 가본 단계만 눌러서 다시 갈 수 있다.
        // 아직 못 가본 단계는(다음 단계 필수 입력값을 안 채웠을 수 있으니) 못 누른다.
        const clickable = n <= maxStepReached && n !== step;
        return (
          <div key={label} className="flex flex-1 items-center last:flex-none">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onStepClick(n)}
              className="flex flex-col items-center gap-1.5 disabled:cursor-default"
            >
              <div
                className={
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors " +
                  (state === "done"
                    ? "bg-brand-600 text-white" + (clickable ? " hover:bg-brand-700" : "")
                    : state === "active"
                      ? "bg-brand-100 text-brand-700 ring-2 ring-brand-600"
                      : "bg-slate-100 text-slate-400")
                }
              >
                {state === "done" ? "✓" : n}
              </div>
              <span
                className={
                  "text-[11px] font-medium " + (state === "todo" ? "text-slate-400" : "text-slate-700")
                }
              >
                {label}
              </span>
            </button>
            {n < STEP_LABELS.length && (
              <div className={"mx-2 h-px flex-1 " + (state === "done" ? "bg-brand-600" : "bg-slate-200")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function NewCampaignWizard() {
  const [step, setStep] = useState(1);
  // 이미 검증을 통과해서 한 번이라도 도달한 단계 — 상단 스텝 번호를 눌러서
  // 다시 그 단계로 이동할 수 있는 범위를 결정한다. 아직 못 가본 단계로
  // 건너뛰는 건 막는다(필수 입력값 검증 없이 넘어가면 안 되니까).
  const [maxStepReached, setMaxStepReached] = useState(1);
  const goToStep = (n: number) => {
    setStep(n);
    setMaxStepReached((m) => Math.max(m, n));
  };
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 버튼 연타/이중 클릭으로 같은 요청이 여러 번 나가는 것 방지 (예: 캠페인 draft 중복 생성)
  const [submitting, setSubmitting] = useState(false);

  // step 1
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(""); // 선택 사항 — 빈 값이면 참가자 앱에서 "캠페인"으로 표시됨
  const [missionUrl, setMissionUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);

  // step 2
  const [rounds, setRounds] = useState<RoundDraft[]>([emptyRound(1)]);

  // step 3
  const [products, setProducts] = useState<Product[]>([]); // 전체 통화 그대로 (CREDIT 통화 선택기가 필요로 함)
  const [walletCurrency, setWalletCurrency] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [activeType, setActiveType] = useState<string | null>(null);
  const [catalogPage, setCatalogPage] = useState(0);

  // 미리보기 카드용 — 참가자 홈/상세에 그대로 쓰이는 CampaignCard가 요구하는
  // sponsor_name을 채우려고 한 번만 가져온다.
  const [sponsorName, setSponsorName] = useState("");
  useEffect(() => {
    fetch(`/api/sponsors/${DEMO_SPONSOR_ID}/profile`)
      .then((r) => r.json())
      .then((data) => {
        if (data.sponsor?.name) setSponsorName(data.sponsor.name);
      })
      .catch(() => {});
  }, []);

  // step 4
  const [budget, setBudget] = useState<{
    expected_winner_count_total: number;
    avg_reward_value: number;
    product_mode_total: number;
    credit_mode_total: number;
    credit_currencies: string[];
    currency_mismatch: boolean;
    estimated_total: number;
    balance: number;
    currency: string;
    sufficient: boolean;
  } | null>(null);

  // 참가자 앱 카드는 항상 1번 라운드 기준(앱 전체 가정)이라 미리보기도 rounds[0]만 본다.
  const previewCampaign: PublicCampaignWithConsensus = useMemo(() => {
    const r = rounds[0];
    const options: CampaignOption[] = r.options.map((label, i) => ({
      id: String(i),
      label: label || `옵션 ${i + 1}`,
    }));
    const openIso = r.opens_at ? new Date(r.opens_at).toISOString() : new Date().toISOString();
    const closeIso = r.closes_at
      ? new Date(r.closes_at).toISOString()
      : new Date(Date.now() + 7 * 86400000).toISOString();
    return {
      id: campaignId ?? "preview",
      round_id: "preview",
      title: title || "캠페인 제목을 입력해주세요",
      category,
      options,
      resolution_criteria: r.resolution_criteria,
      start_at: openIso,
      end_at: closeIso,
      status: "active",
      reward_option_ids: [],
      mission_url: missionUrl || null,
      sponsor_name: sponsorName,
      sponsor_logo_url: null,
      prize_type: r.reward_mode === "CREDIT" ? "amount" : "item",
      prize_label: r.reward_mode === "CREDIT" ? "크레딧 배당" : "카탈로그 상품 중 선택",
      prize_amount: r.reward_mode === "CREDIT" ? r.credit_pool_amount : null,
      prize_currency: r.reward_mode === "CREDIT" ? r.credit_currency || null : null,
      winner_count: r.reward_mode === "PRODUCT" ? r.expected_winner_count : null,
      thumbnail_url: imagePreviewUrl ?? "",
      media_url: imagePreviewUrl ?? "",
      media_type: "image",
      created_at: new Date().toISOString(),
      total_predictions: 0,
      counts: Object.fromEntries(options.map((o) => [o.id, 0])),
      consensus: Object.fromEntries(options.map((o) => [o.id, 0])),
    };
  }, [rounds, title, category, missionUrl, imagePreviewUrl, sponsorName, campaignId]);

  // 1단계(카드 정보): 제목/카테고리/이미지 + 질문/옵션/기간을 검증하고 캠페인을
  // 만들거나(최초) 이미 만든 draft를 덮어쓴다("이전"으로 돌아왔다가 다시 여기로
  // 온 경우 — 매번 새 draft를 만들면 중복 생성된다).
  async function handleContinueFromCardInfo() {
    if (submitting) return;
    for (const r of rounds) {
      if (!r.question_text.trim()) {
        return setError(`라운드 ${r.round_number}: 질문을 입력해주세요`);
      }
      if (r.options.some((o) => !o.trim())) {
        return setError(`라운드 ${r.round_number}: 빈 옵션이 있어요`);
      }
      if (!r.opens_at || !r.closes_at) {
        return setError(`라운드 ${r.round_number}: 시작/마감 일시를 입력해주세요`);
      }
      if (new Date(r.closes_at).getTime() <= new Date(r.opens_at).getTime()) {
        return setError(`라운드 ${r.round_number}: 마감 일시는 시작 일시보다 뒤여야 합니다`);
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      let imageUrl: string | undefined;
      if (imageFile) {
        setImageUploading(true);
        const uploadForm = new FormData();
        uploadForm.append("file", imageFile);
        const uploadRes = await fetch("/api/uploads/campaign-image", { method: "POST", body: uploadForm });
        const uploadJson = await uploadRes.json();
        setImageUploading(false);
        if (!uploadRes.ok) return setError(uploadJson.error ?? "이미지 업로드에 실패했습니다");
        imageUrl = uploadJson.url;
      }

      const isRevisit = campaignId !== null;
      const res = await fetch(isRevisit ? `/api/campaigns/${campaignId}` : "/api/campaigns", {
        method: isRevisit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isRevisit ? {} : { sponsor_id: DEMO_SPONSOR_ID }),
          title,
          category: category || undefined,
          thumbnail_url: imageUrl,
          media_url: imageUrl,
          media_type: imageUrl ? "image" : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) return setError(JSON.stringify(json.error));
      setCampaignId(json.campaign.id);

      // 3단계 카탈로그/크레딧 통화 선택에 쓸 상품 목록은 최초 진입 때만 불러온다.
      // products 자체는 통화 필터 없이 그대로 둔다 — 샌드박스에 잔액 통화(USD)의
      // 가변금액권이 아예 없어서(CREDIT 모드는 가변금액권만 씀), 여기서 걸러버리면
      // CREDIT 모드 지급 통화를 하나도 고를 수 없게 된다. 대신 PRODUCT 카탈로그
      // 선택기(고정가 상품 그리드) 쪽에서만 잔액 통화로 걸러서 보여준다 — 그래야
      // 예산 게이트 평균 단가가 서로 다른 통화 액면가를 섞지 않는다.
      if (!isRevisit) {
        const [productsRes, balanceRes] = await Promise.all([fetch("/api/products"), fetch("/api/wallet/balance")]);
        const productsJson = await productsRes.json();
        const balanceJson = await balanceRes.json();
        if (productsRes.ok) setProducts(productsJson.products ?? []);
        if (balanceRes.ok) setWalletCurrency(balanceJson.currency);
      }

      goToStep(2);
    } finally {
      setSubmitting(false);
    }
  }

  // 2단계(상세 화면): 판정 기준은 로컬 상태에만 두고(라운드 저장은 3단계에서
  // 보상 방식과 함께 한 번에) 참여 미션 URL만 여기서 캠페인에 반영한다.
  async function handleContinueFromDetailInfo() {
    if (submitting) return;
    // 1단계를 아직 안 거쳤거나(정상 흐름이면 안 생길 일) 새로고침 등으로 campaignId를
    // 잃어버린 경우 — 예전엔 여기서 그냥 조용히 아무 일도 안 일어나서 "다음이 안 눌린다"처럼
    // 보였다. 이제 원인을 알 수 있게 에러로 보여준다.
    if (!campaignId) {
      return setError("캠페인 정보를 불러오지 못했어요. 1단계부터 다시 진행해주세요.");
    }
    setSubmitting(true);
    setError(null);
    try {
      const trimmed = missionUrl.trim();
      if (trimmed) {
        // 백엔드가 mission_url을 완전한 URL(https:// 포함)로만 받는다 — "example.com"처럼
        // 프로토콜 없이 입력하면 이전엔 zod가 그냥 거부해서 저장이 조용히 실패했다.
        const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
        const res = await fetch(`/api/campaigns/${campaignId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mission_url: normalized }),
        });
        const json = await res.json();
        if (!res.ok) {
          return setError(
            typeof json.error === "string"
              ? json.error
              : "참여 미션 URL 형식을 확인해주세요 (예: https://example.com)"
          );
        }
        setMissionUrl(normalized);
      }
      goToStep(3);
    } finally {
      setSubmitting(false);
    }
  }

  // 3단계(보상 설정)에서 비로소 라운드를 실제로 저장하고, PRODUCT 라운드가
  // 하나라도 있으면 카탈로그도 같이 저장한 뒤 예산을 계산한다.
  async function handleSaveRoundsAndCatalog() {
    if (!campaignId || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      for (const r of rounds) {
        const common = {
          round_number: r.round_number,
          question_text: r.question_text,
          options: r.options,
          resolution_criteria: r.resolution_criteria,
          opens_at: new Date(r.opens_at).toISOString(),
          closes_at: new Date(r.closes_at).toISOString(),
        };

        let payload: Record<string, unknown>;
        if (r.reward_mode === "PRODUCT") {
          if (r.expected_winner_count <= 0) {
            return setError(`라운드 ${r.round_number}: 예상 당첨자 수는 1 이상이어야 합니다`);
          }
          payload = { ...common, reward_mode: "PRODUCT", expected_winner_count: r.expected_winner_count };
        } else {
          if (r.credit_pool_amount <= 0) {
            return setError(`라운드 ${r.round_number}: 크레딧 풀 금액은 0보다 커야 합니다`);
          }
          if (!r.credit_currency) {
            return setError(`라운드 ${r.round_number}: 지급 통화를 선택해주세요`);
          }
          payload = {
            ...common,
            reward_mode: "CREDIT",
            credit_pool_amount: r.credit_pool_amount,
            credit_currency: r.credit_currency,
          };
        }

        const res = await fetch(`/api/campaigns/${campaignId}/rounds`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) return setError(JSON.stringify(json.error));
      }

      if (rounds.some((r) => r.reward_mode === "PRODUCT")) {
        const res = await fetch(`/api/campaigns/${campaignId}/catalog`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product_ids: Array.from(selectedProductIds) }),
        });
        const json = await res.json();
        if (!res.ok) return setError(JSON.stringify(json.error));
      }

      await handleBudgetCheck();
      goToStep(4);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBudgetCheck() {
    if (!campaignId) return;
    const res = await fetch(`/api/campaigns/${campaignId}/budget-check`);
    const json = await res.json();
    if (res.ok) setBudget(json);
  }

  async function handlePublish() {
    if (!campaignId || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/publish`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) return setError(JSON.stringify(json.error ?? json));
      goToStep(5);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
      <div>
      <a href="/dashboard" className="mb-3 inline-block text-xs text-slate-400 hover:text-slate-600">
        ← 대시보드로
      </a>
      <h1 className="mb-1 text-2xl font-bold text-slate-900">캠페인 생성</h1>
      <p className="mb-6 text-sm text-slate-500">K팝 컴백 예측 캠페인을 만들어요.</p>

      <StepHeader step={step} maxStepReached={maxStepReached} onStepClick={setStep} />

      {error && (
        <div className="mb-4">
          <Callout tone="red">{error}</Callout>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <Card>
            <h2 className="mb-4 text-base font-semibold text-slate-900">카드 정보</h2>
            <Field label="제목">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 이번 주 뮤직뱅크 1위는?" />
            </Field>
            <Field label="카테고리 (선택)" hint="참가자 앱 카테고리 탭 필터링에 쓰여요. 안 정하면 '캠페인'으로 표시돼요.">
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">선택 안 함</option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="메인 이미지 (선택)"
              hint="참가자 홈 피드 카드 썸네일로 쓰여요. PNG/JPEG/WEBP/GIF, 5MB 이하."
            >
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setImageFile(file);
                  setImagePreviewUrl(file ? URL.createObjectURL(file) : null);
                }}
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
              />
              {imagePreviewUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imagePreviewUrl} alt="" className="mt-2 h-32 w-full rounded-lg object-cover" />
              )}
            </Field>
          </Card>

          {rounds.map((r, i) => (
            <Card key={i}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">라운드 {r.round_number}</h2>
              </div>

              <Field label="질문">
                <Input
                  value={r.question_text}
                  onChange={(e) => {
                    const next = [...rounds];
                    next[i] = { ...r, question_text: e.target.value };
                    setRounds(next);
                  }}
                  placeholder="예: 이번 주 1위는 누구일까요?"
                />
              </Field>

              <div className="mb-2 flex flex-col gap-2">
                {r.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <Input
                      placeholder={`옵션 ${oi + 1}`}
                      value={opt}
                      className="flex-1"
                      onChange={(e) => {
                        const next = [...rounds];
                        const opts = [...r.options];
                        opts[oi] = e.target.value;
                        next[i] = { ...r, options: opts };
                        setRounds(next);
                      }}
                    />
                    <button
                      type="button"
                      disabled={r.options.length <= MIN_OPTIONS}
                      onClick={() => {
                        const next = [...rounds];
                        next[i] = { ...r, options: r.options.filter((_, idx) => idx !== oi) };
                        setRounds(next);
                      }}
                      className="shrink-0 text-xs font-medium text-slate-400 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
              <div className="mb-4">
                <button
                  type="button"
                  disabled={r.options.length >= MAX_OPTIONS}
                  onClick={() => {
                    const next = [...rounds];
                    next[i] = { ...r, options: [...r.options, ""] };
                    setRounds(next);
                  }}
                  className="text-xs font-medium text-brand-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-300 disabled:no-underline"
                >
                  + 옵션 추가
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="시작 일시">
                  <Input
                    type="datetime-local"
                    value={r.opens_at}
                    onChange={(e) => {
                      const next = [...rounds];
                      next[i] = { ...r, opens_at: e.target.value };
                      setRounds(next);
                    }}
                  />
                </Field>
                <Field label="마감 일시">
                  <Input
                    type="datetime-local"
                    value={r.closes_at}
                    onChange={(e) => {
                      const next = [...rounds];
                      next[i] = { ...r, closes_at: e.target.value };
                      setRounds(next);
                    }}
                  />
                </Field>
              </div>
            </Card>
          ))}

          <div className="flex items-center justify-between">
            <Button
              variant="secondary"
              onClick={() => setRounds([...rounds, emptyRound(rounds.length + 1)])}
              disabled={submitting}
            >
              + 라운드 추가
            </Button>
            <Button onClick={handleContinueFromCardInfo} disabled={!title || submitting}>
              {imageUploading ? "이미지 업로드 중..." : submitting ? "저장 중..." : "다음"}
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <Callout tone="slate">여기서부터는 참가자가 카드를 눌러 들어갔을 때만 보이는 내용이에요.</Callout>

          {rounds.map((r, i) => (
            <Card key={i}>
              <h2 className="mb-4 text-base font-semibold text-slate-900">
                라운드 {r.round_number} <span className="font-normal text-slate-400">— {r.question_text || "(질문 미입력)"}</span>
              </h2>
              <Field label="판정 기준" hint="참가자 상세 화면에 그대로 노출돼요. 모호하면 발행 전 검토 단계에서 놓치기 쉬워요.">
                <textarea
                  value={r.resolution_criteria}
                  onChange={(e) => {
                    const next = [...rounds];
                    next[i] = { ...r, resolution_criteria: e.target.value };
                    setRounds(next);
                  }}
                  placeholder="예: 멜론차트 이번 주 금요일 오후 6시 기준 1위 곡"
                  rows={2}
                  className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </Field>
            </Card>
          ))}

          <Card>
            <Field
              label="참여 미션 URL (선택)"
              hint="설정하면 참가자가 예측하기 전에 먼저 이 사이트를 방문해야 해요."
            >
              <Input
                type="url"
                placeholder="https://..."
                value={missionUrl}
                onChange={(e) => setMissionUrl(e.target.value)}
              />
            </Field>
          </Card>

          <div className="flex items-center justify-between">
            {/* 뒤로가기는 입력값 검증 없이 언제나 가능 — 필수 입력 검증은 "다음"에만 걸린다 */}
            <Button variant="secondary" onClick={() => setStep(1)} disabled={submitting}>
              이전
            </Button>
            <Button onClick={handleContinueFromDetailInfo} disabled={submitting}>
              {submitting ? "저장 중..." : "다음"}
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          {rounds.map((r, i) => (
            <Card key={i}>
              <h2 className="mb-4 text-base font-semibold text-slate-900">
                라운드 {r.round_number} 보상 <span className="font-normal text-slate-400">— {r.question_text || "(질문 미입력)"}</span>
              </h2>

              <div className="mb-4">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">보상 방식</label>
                <div className="inline-flex rounded-lg border border-slate-300 p-0.5">
                  {(
                    [
                      ["PRODUCT", "상품 지급"],
                      ["CREDIT", "크레딧 배당"],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        const next = [...rounds];
                        next[i] = { ...r, reward_mode: mode };
                        setRounds(next);
                      }}
                      className={
                        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors " +
                        (r.reward_mode === mode ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100")
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {r.reward_mode === "PRODUCT" ? (
                <Field label="예상 당첨자 수" hint="직접 입력, 예산 게이트 계산에 쓰여요 (자동 계산 아님). 아래에서 지급할 카탈로그 상품도 골라주세요.">
                  <Input
                    type="number"
                    min={1}
                    className="max-w-[160px]"
                    value={r.expected_winner_count}
                    onChange={(e) => {
                      const next = [...rounds];
                      next[i] = { ...r, expected_winner_count: Number(e.target.value) };
                      setRounds(next);
                    }}
                  />
                </Field>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="풀 금액">
                      <Input
                        type="number"
                        min={1}
                        value={r.credit_pool_amount}
                        onChange={(e) => {
                          const next = [...rounds];
                          next[i] = { ...r, credit_pool_amount: Number(e.target.value) };
                          setRounds(next);
                        }}
                      />
                    </Field>
                    <Field label="지급 통화">
                      <Select
                        value={r.credit_currency}
                        onChange={(e) => {
                          const next = [...rounds];
                          next[i] = { ...r, credit_currency: e.target.value };
                          setRounds(next);
                        }}
                      >
                        <option value="">선택하세요</option>
                        {Array.from(new Set(products.map((p) => p.currency)))
                          .sort()
                          .map((currency) => (
                            <option key={currency} value={currency}>
                              {currencyLabel(currency)}
                            </option>
                          ))}
                      </Select>
                    </Field>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    브랜드 상품권을 고르지 않아요. 판정 확정 즉시 풀 금액을 정답자 수로 나눈 몫이 정답자
                    마이페이지의 &quot;누적 획득 리워드&quot;에 바로 더해져요 — 참가자가 따로 할 일이 없어요.
                  </p>
                </>
              )}
            </Card>
          ))}

          {rounds.some((r) => r.reward_mode === "PRODUCT") &&
            (() => {
              // 고정가 카탈로그는 잔액 통화 상품만 — 통화가 섞이면 예산 게이트
              // 평균 단가가 의미 없어진다(위 handleContinueFromCardInfo 주석 참고).
              const grouped = groupByType(products.filter((p) => p.currency === walletCurrency));
              const typeKeys = [
                ...PRODUCT_TYPE_ORDER.filter((t) => grouped.has(t)),
                ...Array.from(grouped.keys()).filter((t) => !PRODUCT_TYPE_ORDER.includes(t)),
              ];
              const currentType = activeType && grouped.has(activeType) ? activeType : typeKeys[0];
              const items = grouped.get(currentType) ?? [];
              const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
              const pageItems = items.slice(catalogPage * PAGE_SIZE, (catalogPage + 1) * PAGE_SIZE);

              return (
                <Card>
                  <div className="mb-1 flex items-center justify-between">
                    <h2 className="text-base font-semibold text-slate-900">리워드 카탈로그 구성</h2>
                    {selectedProductIds.size > 0 && <Badge tone="blue">{selectedProductIds.size}개 선택됨</Badge>}
                  </div>
                  <p className="mb-4 text-xs text-slate-400">
                    지갑 통화({walletCurrency}) 상품만 보여요. 통화가 다르면 예산 게이트의 평균 단가가
                    부정확해지기 때문이에요.
                  </p>

                  <div className="mb-4 flex gap-1.5 border-b border-slate-200 pb-3">
                    {typeKeys.map((t) => (
                      <button
                        key={t}
                        onClick={() => {
                          setActiveType(t);
                          setCatalogPage(0);
                        }}
                        className={
                          "rounded-full px-3 py-1.5 text-sm font-medium transition-colors " +
                          (t === currentType ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")
                        }
                      >
                        {PRODUCT_TYPE_LABELS[t] ?? t} ({grouped.get(t)?.length ?? 0})
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {pageItems.map((p) => {
                      const checked = selectedProductIds.has(String(p.id));
                      return (
                        <label
                          key={p.id}
                          className={
                            "cursor-pointer rounded-lg border p-2 transition-colors " +
                            (checked ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500" : "border-slate-200 hover:border-slate-300")
                          }
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const next = new Set(selectedProductIds);
                                if (e.target.checked) next.add(String(p.id));
                                else next.delete(String(p.id));
                                setSelectedProductIds(next);
                              }}
                              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                            />
                          </div>
                          {p.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.image_url}
                              alt={p.name_ko ?? p.name}
                              className="h-20 w-full rounded object-cover"
                            />
                          ) : (
                            <div className="h-20 w-full rounded bg-slate-100" />
                          )}
                          <div className="mt-1.5 line-clamp-1 text-xs font-medium text-slate-800">
                            {p.name_ko ?? p.name}
                          </div>
                          <div className="text-xs text-slate-500">{formatPrice(p)}</div>
                        </label>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex items-center justify-center gap-3 text-sm">
                    <Button variant="ghost" onClick={() => setCatalogPage((p) => Math.max(0, p - 1))} disabled={catalogPage === 0}>
                      이전
                    </Button>
                    <span className="text-slate-500">
                      {catalogPage + 1} / {totalPages}
                    </span>
                    <Button
                      variant="ghost"
                      onClick={() => setCatalogPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={catalogPage >= totalPages - 1}
                    >
                      다음
                    </Button>
                  </div>
                </Card>
              );
            })()}

          <div className="flex items-center justify-between">
            <Button variant="secondary" onClick={() => setStep(2)} disabled={submitting}>
              이전
            </Button>
            <Button onClick={handleSaveRoundsAndCatalog} disabled={submitting}>
              {submitting ? "저장 중..." : "다음"}
            </Button>
          </div>
        </div>
      )}

      {step === 4 && budget && (
        <Card>
          <h2 className="mb-4 text-base font-semibold text-slate-900">예산 게이트</h2>

          <dl className="mb-4 grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-4 text-sm">
            <div>
              <dt className="text-slate-500">현재 잔액</dt>
              <dd className="mt-0.5 text-lg font-semibold text-slate-900">
                {budget.balance.toLocaleString()} {currencyLabel(budget.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">예상 소요예산 합계</dt>
              <dd className="mt-0.5 text-lg font-semibold text-slate-900">
                {budget.estimated_total.toFixed(2)} {currencyLabel(budget.currency)}
              </dd>
            </div>
          </dl>

          <ul className="mb-4 space-y-1.5 text-sm text-slate-600">
            <li>
              상품 지급 라운드: {budget.product_mode_total.toFixed(2)} {currencyLabel(budget.currency)} (예상
              당첨자 합계 {budget.expected_winner_count_total}명 × 평균 단가 {budget.avg_reward_value.toFixed(2)})
            </li>
            <li>
              크레딧 배당 라운드 풀 합계: {budget.credit_mode_total.toFixed(2)}{" "}
              {budget.credit_currencies.length > 0
                ? budget.credit_currencies.map(currencyLabel).join(", ")
                : currencyLabel(budget.currency)}
            </li>
          </ul>

          {budget.currency_mismatch && (
            <div className="mb-3">
              <Callout tone="amber">
                ⚠ 카탈로그 상품 또는 크레딧 풀 통화가 계정 잔액 통화({currencyLabel(budget.currency)})와 달라요.
                환율은 실제 지급 시점에 결정되므로 위 합계와 충분/부족 판정은 액면가 기준 참고용
                추정치예요 — 실제로는 발행 가능한데 부족하다고 나올 수 있으니 참고만 하세요.
              </Callout>
            </div>
          )}

          <Callout tone={budget.sufficient ? "green" : "red"}>
            {budget.sufficient
              ? "✓ 예산이 충분합니다. 발행할 수 있어요."
              : "✗ 잔액이 부족합니다. 소다기프트 대시보드에서 충전 후 다시 확인해주세요."}
          </Callout>

          {/* 잔액 부족 시 카탈로그/라운드를 고쳐야 하므로 그 자리에서 재조회가 아니라
              이전 단계(카탈로그 구성)로 돌아간다. 3단계에서 "다음"을 누르면 예산이 다시 계산된다. */}
          <div className="mt-6 flex justify-between">
            <Button variant="secondary" onClick={() => setStep(3)} disabled={submitting}>
              이전 화면으로 돌아가기
            </Button>
            <Button onClick={handlePublish} disabled={!budget.sufficient || submitting}>
              {submitting ? "발행 중..." : "발행"}
            </Button>
          </div>
        </Card>
      )}

      {step === 5 && (
        <Card className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-600">
            ✓
          </div>
          <h2 className="mb-1 text-lg font-semibold text-slate-900">캠페인이 발행되었습니다</h2>
          <p className="mb-4 text-sm text-slate-500">campaign id: {campaignId}</p>
          <Button onClick={() => (window.location.href = "/dashboard")}>대시보드로 가기</Button>
        </Card>
      )}
      </div>

      {step < 5 && (
        <aside className="hidden lg:block">
          <div className="sticky top-8">
            <p className="mb-3 text-xs font-semibold text-slate-400">
              {step === 2 ? "카드를 누르면 이렇게 보여요" : "참가자 앱에는 이렇게 보여요"}
            </p>
            {/* 실제 참가자 화면과 같은 컴포넌트를 재사용 — 클릭해서 넘어가면 안 되니 비활성화.
                2단계(상세 화면)는 판정 기준/미션 URL을 고치는 단계라 홈 피드 카드가 아니라
                카드를 눌렀을 때 보이는 상세 화면 미리보기를 보여준다. */}
            <div className="pointer-events-none">
              {step === 2 ? (
                <CampaignDetailPreview campaign={previewCampaign} />
              ) : (
                <CampaignCard campaign={previewCampaign} />
              )}
            </div>
          </div>
        </aside>
      )}
    </main>
  );
}
