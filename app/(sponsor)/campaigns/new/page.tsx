"use client";

// PRD 5.2 캠페인 생성 마법사: 기본정보 → 라운드 설계 → 카탈로그 구성 → 예산 확인 → 발행

import { useState } from "react";
import { Badge, Button, Callout, Card, Field, Input, Select } from "../../_components/ui";

// TODO: 인증 붙기 전까지 seed된 데모 스폰서 id 하드코딩 (supabase에 직접 심어둔 값)
const DEMO_SPONSOR_ID = "72495905-2368-41a3-8eba-fef7a07fcc21";

type RewardMode = "PRODUCT" | "CREDIT";

type RoundDraft = {
  round_number: number;
  question_text: string;
  options: [string, string, string, string];
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
const STEP_LABELS = ["기본정보", "라운드 설계", "카탈로그", "예산 확인", "발행"];

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
    options: ["", "", "", ""],
    resolution_criteria: "",
    reward_mode: "PRODUCT",
    expected_winner_count: 100,
    credit_pool_amount: 100,
    credit_currency: "",
    opens_at: toDatetimeLocalValue(now),
    closes_at: toDatetimeLocalValue(weekLater),
  };
}

// CREDIT 모드 지급에 쓸 수 있는 상품 = 가변 금액권(고정가가 없고 min~max 범위인 상품)
function isVariableAmountProduct(p: Product): boolean {
  return p.amount === null && p.min_amount != null && p.max_amount != null;
}

function StepHeader({ step }: { step: number }) {
  return (
    <div className="mb-8 flex items-center">
      {STEP_LABELS.map((label, i) => {
        const n = i + 1;
        const state = n < step ? "done" : n === step ? "active" : "todo";
        return (
          <div key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold " +
                  (state === "done"
                    ? "bg-brand-600 text-white"
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
            </div>
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
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 버튼 연타/이중 클릭으로 같은 요청이 여러 번 나가는 것 방지 (예: 캠페인 draft 중복 생성)
  const [submitting, setSubmitting] = useState(false);

  // step 1
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("kpop");
  const [missionUrl, setMissionUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);

  // step 2
  const [rounds, setRounds] = useState<RoundDraft[]>([emptyRound(1)]);

  // step 3
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [activeType, setActiveType] = useState<string | null>(null);
  const [catalogPage, setCatalogPage] = useState(0);

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

  async function handleCreateCampaign() {
    if (submitting) return;
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

      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sponsor_id: DEMO_SPONSOR_ID,
          title,
          category,
          mission_url: missionUrl || undefined,
          thumbnail_url: imageUrl,
          media_url: imageUrl,
          media_type: imageUrl ? "image" : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) return setError(JSON.stringify(json.error));
      setCampaignId(json.campaign.id);

      // 2단계에서 CREDIT 모드 라운드는 지급용 가변금액 상품권을 골라야 해서 미리 로드해둔다
      const productsRes = await fetch("/api/products");
      const productsJson = await productsRes.json();
      if (productsRes.ok) setProducts(productsJson.products ?? []);

      setStep(2);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveRounds() {
    if (!campaignId || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      for (const r of rounds) {
        if (!r.opens_at || !r.closes_at) {
          return setError(`라운드 ${r.round_number}: 시작/마감 일시를 입력해주세요`);
        }
        if (new Date(r.closes_at).getTime() <= new Date(r.opens_at).getTime()) {
          return setError(`라운드 ${r.round_number}: 마감 일시는 시작 일시보다 뒤여야 합니다`);
        }
        const common = {
          round_number: r.round_number,
          question_text: r.question_text,
          options: r.options,
          resolution_criteria: r.resolution_criteria,
          opens_at: r.opens_at ? new Date(r.opens_at).toISOString() : new Date().toISOString(),
          closes_at: r.closes_at
            ? new Date(r.closes_at).toISOString()
            : new Date(Date.now() + 7 * 86400000).toISOString(),
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
      setStep(3);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveCatalog() {
    if (!campaignId || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/catalog`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_ids: Array.from(selectedProductIds) }),
      });
      const json = await res.json();
      if (!res.ok) return setError(JSON.stringify(json.error));
      await handleBudgetCheck();
      setStep(4);
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
      setStep(5);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <h1 className="mb-1 text-2xl font-bold text-slate-900">캠페인 생성</h1>
      <p className="mb-6 text-sm text-slate-500">K팝 컴백 예측 캠페인을 만들어요.</p>

      <StepHeader step={step} />

      {error && (
        <div className="mb-4">
          <Callout tone="red">{error}</Callout>
        </div>
      )}

      {step === 1 && (
        <Card>
          <h2 className="mb-4 text-base font-semibold text-slate-900">기본정보</h2>
          <Field label="제목">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 이번 주 뮤직뱅크 1위는?" />
          </Field>
          <Field label="카테고리" hint="참가자 앱 카테고리 탭 필터링에 쓰여요.">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="메인 이미지 (선택)"
            hint="참가자 앱 캠페인 카드/상세 화면 상단에 노출돼요. PNG/JPEG/WEBP/GIF, 5MB 이하."
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
          <div className="mt-6 flex justify-end">
            <Button onClick={handleCreateCampaign} disabled={!title || submitting}>
              {imageUploading ? "이미지 업로드 중..." : submitting ? "생성 중..." : "다음"}
            </Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <div className="space-y-4">
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

              <div className="mb-4 grid grid-cols-2 gap-2">
                {r.options.map((opt, oi) => (
                  <Input
                    key={oi}
                    placeholder={`옵션 ${oi + 1}`}
                    value={opt}
                    onChange={(e) => {
                      const next = [...rounds];
                      const opts = [...r.options] as RoundDraft["options"];
                      opts[oi] = e.target.value;
                      next[i] = { ...r, options: opts };
                      setRounds(next);
                    }}
                  />
                ))}
              </div>

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

              <div className="mb-4 grid grid-cols-2 gap-3">
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
                <Field label="예상 당첨자 수" hint="직접 입력, 예산 게이트 계산에 쓰여요 (자동 계산 아님).">
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
                        {Array.from(new Set(products.filter(isVariableAmountProduct).map((p) => p.currency))).map(
                          (currency) => (
                            <option key={currency} value={currency}>
                              {currency} (
                              {products.filter((p) => isVariableAmountProduct(p) && p.currency === currency).length}
                              개 브랜드)
                            </option>
                          )
                        )}
                      </Select>
                    </Field>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    브랜드는 지금 정하지 않아요. 정답자가 이 통화 안에서 원하는 상품권을 직접 고르면, 풀
                    금액을 정답자 수로 나눈 몫이 그 카드에 실려 이메일로 지급됩니다. 지급 통화가 계정 잔액
                    통화와 다르면 실제 차감액은 주문 시점 환율로 결정돼요.
                  </p>
                </>
              )}
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
            <Button onClick={handleSaveRounds} disabled={submitting}>
              {submitting ? "저장 중..." : "다음"}
            </Button>
          </div>
        </div>
      )}

      {step === 3 &&
        (() => {
          const grouped = groupByType(products);
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
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">리워드 카탈로그 구성</h2>
                {selectedProductIds.size > 0 && <Badge tone="blue">{selectedProductIds.size}개 선택됨</Badge>}
              </div>

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

              <div className="mt-6 flex justify-end">
                <Button onClick={handleSaveCatalog} disabled={submitting}>
                  {submitting ? "저장 중..." : "다음 단계로"}
                </Button>
              </div>
            </Card>
          );
        })()}

      {step === 4 && budget && (
        <Card>
          <h2 className="mb-4 text-base font-semibold text-slate-900">예산 게이트</h2>

          <dl className="mb-4 grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-4 text-sm">
            <div>
              <dt className="text-slate-500">현재 잔액</dt>
              <dd className="mt-0.5 text-lg font-semibold text-slate-900">
                {budget.balance.toLocaleString()} {budget.currency}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">예상 소요예산 합계</dt>
              <dd className="mt-0.5 text-lg font-semibold text-slate-900">
                {budget.estimated_total.toFixed(2)} {budget.currency}
              </dd>
            </div>
          </dl>

          <ul className="mb-4 space-y-1.5 text-sm text-slate-600">
            <li>
              상품 지급 라운드: {budget.product_mode_total.toFixed(2)} {budget.currency} (예상 당첨자 합계{" "}
              {budget.expected_winner_count_total}명 × 평균 단가 {budget.avg_reward_value.toFixed(2)})
            </li>
            <li>
              크레딧 배당 라운드 풀 합계: {budget.credit_mode_total.toFixed(2)}{" "}
              {budget.credit_currencies.length > 0 ? budget.credit_currencies.join(", ") : budget.currency}
            </li>
          </ul>

          {budget.currency_mismatch && (
            <div className="mb-3">
              <Callout tone="amber">
                ⚠ 카탈로그 상품 또는 크레딧 풀 통화가 계정 잔액 통화({budget.currency})와 달라요.
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
          <p className="text-sm text-slate-500">campaign id: {campaignId}</p>
        </Card>
      )}
    </main>
  );
}
