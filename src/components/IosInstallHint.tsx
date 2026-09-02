"use client";

import { Share, X } from "lucide-react";
import { useEffect, useState } from "react";

const DISMISS_KEY = "myscheduler.ios-install-hint.dismissed.v1";

function isIosSafari() {
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isWebKit = /WebKit/.test(ua);
  const isOtherIosBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isIos && isWebKit && !isOtherIosBrowser;
}

function isStandalone() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
}

export function IosInstallHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isIosSafari() || isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    const timer = window.setTimeout(() => setVisible(true), 900);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  return (
    <aside className="ios-install-hint" role="status" aria-label="iPhone 홈 화면 설치 안내">
      <div className="ios-install-icon" aria-hidden="true">M</div>
      <div className="ios-install-copy">
        <strong>iPhone에서도 앱처럼 사용할 수 있어요</strong>
        <span>Safari의 <Share size={14} aria-hidden="true" /> 공유 버튼 → <b>홈 화면에 추가</b>를 눌러주세요. 설치 후에는 홈 화면의 MyScheduler에서 알림도 켤 수 있습니다.</span>
      </div>
      <button type="button" className="ios-install-close" onClick={dismiss} aria-label="설치 안내 닫기"><X size={17} /></button>
    </aside>
  );
}
