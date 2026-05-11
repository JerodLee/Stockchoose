import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "STOCKCHOOSE TERMINAL",
  description: "Advanced trading terminal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full bg-[#050505] text-[#c0c0c0] font-mono">{children}</body>
    </html>
  );
}
