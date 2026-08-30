import "./globals.css";

export const metadata = {
  title: "SodaPick",
  description: "K팝 컴백 예측 캠페인",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
