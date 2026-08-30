import type { Metadata, Viewport } from "next";
import BottomNav from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "SodaPick",
  description: "Predict for free and win real gift card rewards",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function ParticipantLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="app-shell">{children}</div>
      <BottomNav />
    </>
  );
}
