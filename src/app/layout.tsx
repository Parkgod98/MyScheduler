import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./ux-v3.css";
import "./visual-polish.css";
import "./ios-pwa.css";

import { IosInstallHint } from "@/components/IosInstallHint";

export const metadata: Metadata = {
  title: "MyScheduler",
  description: "PC · Android · iPhone에서 함께 쓰는 개인 일정 관리 PWA",
  applicationName: "MyScheduler",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "MyScheduler",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#111827",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        {children}
        <IosInstallHint />
      </body>
    </html>
  );
}
