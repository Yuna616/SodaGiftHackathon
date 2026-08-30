"use client";

import { usePathname } from "next/navigation";

export default function SponsorLayout({ children }: { children: React.ReactNode }) {
  // 대시보드는 프로필 사이드바 + 목록 2단 레이아웃이라 다른 화면(마법사/판정
  // 콘솔/지급 현황)보다 더 넓은 폭이 필요하다.
  const isDashboard = usePathname() === "/dashboard";
  const widthClass = isDashboard ? "max-w-6xl" : "max-w-4xl";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className={`mx-auto flex ${widthClass} items-center gap-2 px-6 py-4`}>
          <a href="/dashboard" className="text-lg font-bold text-brand-600">
            SodaPick
          </a>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
            고객사 콘솔
          </span>
          <a href="/dashboard" className="ml-4 text-xs font-medium text-slate-500 hover:text-slate-700">
            대시보드
          </a>
          {/* 개발 편의용 — 유저(참가자) 앱으로 바로 넘어가기 */}
          <a href="/" className="ml-auto text-xs text-slate-400 underline hover:text-slate-600">
            유저 앱 보기
          </a>
        </div>
      </header>
      <div className={`mx-auto ${widthClass} px-6 py-8`}>{children}</div>
    </div>
  );
}
