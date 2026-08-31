import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./ux-v3.css";

export const metadata: Metadata = {
  title: "MyScheduler",
  description: "PC와 Android에서 함께 쓰는 개인 일정 관리 PWA",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#111827",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
