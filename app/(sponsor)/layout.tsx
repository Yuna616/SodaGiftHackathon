export default function SponsorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-6 py-4">
          <span className="text-lg font-bold text-brand-600">SodaPick</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
            고객사 콘솔
          </span>
          {/* 개발 편의용 — 유저(참가자) 앱으로 바로 넘어가기 */}
          <a href="/" className="ml-auto text-xs text-slate-400 underline hover:text-slate-600">
            유저 앱 보기
          </a>
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-6 py-8">{children}</div>
    </div>
  );
}
