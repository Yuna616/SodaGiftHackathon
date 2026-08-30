import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import BottomNav from "@/components/BottomNav";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sodapick",
});

export const metadata: Metadata = {
  title: "SodaPick",
  description: "무료로 예측하고, 진짜 기프티콘 리워드를 받는 경험",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function ParticipantLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className={`${jakarta.variable} app-shell`}>{children}</div>
      <BottomNav />
    </>
  );
}
