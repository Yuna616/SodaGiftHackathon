import "./globals.css";

export const metadata = {
  title: "SodaPick",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Pacifico&display=swap"
        />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
