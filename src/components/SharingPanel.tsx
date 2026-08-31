"use client";

import { Copy, Eye, EyeOff, UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

type Profile = { display_name: string; share_code: string; sharing_enabled: boolean };
type Subscription = { owner_id: string; display_name: string };

export function SharingPanel({ supabase, userId, onChanged }: { supabase: SupabaseClient | null; userId: string | null; onChanged: () => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    if (!supabase || !userId) return;
    const [{ data: profileRows, error: profileError }, { data: subscriptionRows, error: subscriptionError }] = await Promise.all([
      supabase.rpc("ensure_calendar_profile"),
      supabase.rpc("get_calendar_subscriptions"),
    ]);
    if (profileError) return setStatus(profileError.message);
    if (subscriptionError) return setStatus(subscriptionError.message);
    setProfile((profileRows?.[0] as Profile | undefined) ?? null);
    setSubscriptions((subscriptionRows ?? []) as Subscription[]);
  }, [supabase, userId]);

  useEffect(() => { void load(); }, [load]);

  async function saveProfile(patch: Partial<Profile>) {
    if (!supabase || !userId || !profile) return;
    const next = { ...profile, ...patch };
    const { error } = await supabase.from("calendar_profiles").update({
      display_name: next.display_name,
      sharing_enabled: next.sharing_enabled,
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId);
    if (error) return setStatus(error.message);
    setProfile(next);
    setStatus(next.sharing_enabled ? "내 캘린더 공유를 켰습니다." : "내 캘린더 공유를 껐습니다.");
    onChanged();
  }

  async function subscribe() {
    if (!supabase || !code.trim()) return;
    const { error } = await supabase.rpc("subscribe_calendar", { code: code.trim() });
    if (error) return setStatus(error.message);
    setCode("");
    setStatus("캘린더를 구독했습니다.");
    await load();
    onChanged();
  }

  async function unsubscribe(ownerId: string) {
    if (!supabase) return;
    const { error } = await supabase.rpc("unsubscribe_calendar", { target_owner: ownerId });
    if (error) return setStatus(error.message);
    await load();
    onChanged();
  }

  if (!supabase || !userId) return <div className="sharing-note">로그인하면 캘린더 공유와 구독을 사용할 수 있습니다.</div>;
  if (!profile) return <div className="sharing-note">공유 프로필을 준비하고 있습니다.</div>;

  return <div className="sharing-stack">
    <div className="sharing-block">
      <div className="sharing-title-row"><div><strong>내 캘린더 공유</strong><p>구독자에게 일정 제목·시간·종류만 읽기 전용으로 보여줍니다. 메모와 준비물은 공유하지 않습니다.</p></div><button className={`share-toggle ${profile.sharing_enabled ? "on" : ""}`} onClick={() => void saveProfile({ sharing_enabled: !profile.sharing_enabled })}>{profile.sharing_enabled ? <Eye size={16} /> : <EyeOff size={16} />}{profile.sharing_enabled ? "공개 중" : "비공개"}</button></div>
      <label className="sharing-label">표시 이름<input value={profile.display_name} onChange={(event) => setProfile({ ...profile, display_name: event.target.value })} onBlur={() => void saveProfile({ display_name: profile.display_name.trim() || "MyScheduler 사용자" })} /></label>
      <div className="share-code-row"><code>{profile.share_code}</code><button className="secondary" onClick={() => void navigator.clipboard.writeText(profile.share_code)}><Copy size={15} /> 코드 복사</button></div>
    </div>

    <div className="sharing-block">
      <strong>다른 캘린더 구독</strong><p>상대방의 공유 코드를 입력하면 내 캘린더에 함께 표시됩니다.</p>
      <div className="subscribe-row"><input value={code} onChange={(event) => setCode(event.target.value)} placeholder="공유 코드 입력" onKeyDown={(event) => { if (event.key === "Enter") void subscribe(); }} /><button className="primary" onClick={() => void subscribe()}><UserPlus size={16} /> 구독</button></div>
      <div className="subscription-list">{subscriptions.length === 0 ? <span className="sharing-note">아직 구독한 캘린더가 없습니다.</span> : subscriptions.map((item) => <div className="subscription-row" key={item.owner_id}><span>{item.display_name}</span><button aria-label="구독 취소" onClick={() => void unsubscribe(item.owner_id)}><X size={15} /></button></div>)}</div>
    </div>
    {status && <div className="sharing-status">{status}</div>}
  </div>;
}
