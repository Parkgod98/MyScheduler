"use client";

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ko } from "date-fns/locale";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type ScheduleEvent = {
  id: string;
  title: string;
  startsAt: string;
  notes: string;
  reminderMinutes: number;
};

const STORAGE_KEY = "myscheduler.events.v1";
const INITIAL_NOW = Date.now();
const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

function readLocalEvents(): ScheduleEvent[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as ScheduleEvent[]) : [];
  } catch {
    return [];
  }
}

export default function Home() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [month, setMonth] = useState(new Date());
  const [selected, setSelected] = useState(new Date());
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [now, setNow] = useState(INITIAL_NOW);
  const [status, setStatus] = useState("로컬 모드 · 브라우저에 저장됩니다.");

  const loadRemote = useCallback(
    async (uid: string) => {
      if (!supabase) return;
      const { data, error } = await supabase
        .from("events")
        .select("id,title,starts_at,notes,reminder_minutes")
        .eq("user_id", uid)
        .order("starts_at");

      if (error) {
        setStatus(`동기화 실패: ${error.message}`);
        return;
      }

      setEvents(
        (data ?? []).map((row) => ({
          id: row.id,
          title: row.title,
          startsAt: row.starts_at,
          notes: row.notes,
          reminderMinutes: row.reminder_minutes,
        })),
      );
      setStatus("Supabase 동기화 모드 · PC와 Android에서 같은 일정을 사용합니다.");
    },
    [supabase],
  );

  useEffect(() => {
    let cancelled = false;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    async function initialize() {
      // Keep React state updates outside the synchronous effect body.
      await Promise.resolve();
      if (cancelled) return;

      if (!supabase) {
        setEvents(readLocalEvents());
        setReady(true);
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (cancelled) return;

      const uid = data.session?.user.id ?? null;
      setUserId(uid);
      if (uid) {
        await loadRemote(uid);
      } else {
        setEvents(readLocalEvents());
      }

      if (!cancelled) setReady(true);
    }

    void initialize();

    const listener = supabase?.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user.id ?? null;
      setUserId(uid);
      if (uid) void loadRemote(uid);
    });

    return () => {
      cancelled = true;
      listener?.data.subscription.unsubscribe();
    };
  }, [loadRemote, supabase]);

  useEffect(() => {
    if (ready && !userId) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    }
  }, [events, ready, userId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(month), { weekStartsOn: 0 }),
        end: endOfWeek(endOfMonth(month), { weekStartsOn: 0 }),
      }),
    [month],
  );

  const selectedEvents = events
    .filter((event) => isSameDay(new Date(event.startsAt), selected))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const nextEvent = useMemo(
    () =>
      events
        .filter((event) => new Date(event.startsAt).getTime() >= now)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0],
    [events, now],
  );

  async function signIn() {
    if (!supabase) {
      setStatus("Supabase 환경변수가 없어 현재는 로컬 모드입니다.");
      return;
    }
    if (!email) {
      setStatus("로그인용 이메일을 입력해주세요.");
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setStatus(error ? `로그인 요청 실패: ${error.message}` : "이메일로 로그인 링크를 보냈습니다.");
  }

  async function enableNotifications() {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setStatus("이 브라우저는 Push 알림을 지원하지 않습니다.");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setStatus("알림 권한이 허용되지 않았습니다.");
      return;
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey || !supabase || !userId) {
      setStatus("로컬 알림 권한은 켜졌습니다. 로그인/VAPID 설정 후 백그라운드 Push가 활성화됩니다.");
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    const json = subscription.toJSON();
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      },
      { onConflict: "endpoint" },
    );

    setStatus(error ? `Push 등록 실패: ${error.message}` : "이 기기의 백그라운드 Push 알림을 등록했습니다.");
  }

  async function addEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") || "").trim();
    const date = String(data.get("date") || "");
    const time = String(data.get("time") || "");
    const notes = String(data.get("notes") || "").trim();
    const reminderMinutes = Number(data.get("reminder") || 10);

    if (!title || !date || !time) {
      setStatus("제목, 날짜, 시간을 입력해주세요.");
      return;
    }

    const startsAt = new Date(`${date}T${time}:00`).toISOString();

    if (supabase && userId) {
      const { data: saved, error } = await supabase
        .from("events")
        .insert({
          user_id: userId,
          title,
          starts_at: startsAt,
          notes,
          reminder_minutes: reminderMinutes,
        })
        .select("id,title,starts_at,notes,reminder_minutes")
        .single();

      if (error) {
        setStatus(`저장 실패: ${error.message}`);
        return;
      }

      setEvents((current) => [
        ...current,
        {
          id: saved.id,
          title: saved.title,
          startsAt: saved.starts_at,
          notes: saved.notes,
          reminderMinutes: saved.reminder_minutes,
        },
      ]);
    } else {
      setEvents((current) => [
        ...current,
        { id: crypto.randomUUID(), title, startsAt, notes, reminderMinutes },
      ]);
    }

    setSelected(new Date(startsAt));
    event.currentTarget.reset();
    setStatus(userId ? "일정을 저장하고 동기화했습니다." : "일정을 로컬에 저장했습니다.");
  }

  async function removeEvent(id: string) {
    if (supabase && userId) {
      const { error } = await supabase.from("events").delete().eq("id", id).eq("user_id", userId);
      if (error) {
        setStatus(`삭제 실패: ${error.message}`);
        return;
      }
    }
    setEvents((current) => current.filter((item) => item.id !== id));
  }

  return (
    <>
      <header className="header">
        <div className="header-inner">
          <div className="brand">MyScheduler</div>
          <div className="next-event">
            {nextEvent
              ? `다음 일정 · ${format(new Date(nextEvent.startsAt), "M/d HH:mm")} ${nextEvent.title}`
              : "예정된 일정이 없습니다"}
          </div>
          <button className="secondary" onClick={enableNotifications}>
            🔔 알림 켜기
          </button>
        </div>
      </header>

      <main className="container">
        <div className="panel" style={{ marginBottom: 14 }}>
          {supabase ? (
            userId ? (
              <div className="toolbar" style={{ justifyContent: "space-between" }}>
                <strong>동기화 연결됨</strong>
                <button className="secondary" onClick={() => supabase.auth.signOut()}>
                  로그아웃
                </button>
              </div>
            ) : (
              <div className="toolbar">
                <input
                  style={{ maxWidth: 320 }}
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="이메일로 로그인"
                />
                <button className="primary" onClick={signIn}>
                  로그인 링크 받기
                </button>
              </div>
            )
          ) : (
            <div className="event-meta">Supabase 설정 전에는 로컬 모드로 바로 사용할 수 있습니다.</div>
          )}
        </div>

        <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: 14 }}>
          <div className="toolbar">
            <button className="secondary" onClick={() => setMonth(subMonths(month, 1))}>
              ←
            </button>
            <button className="secondary" onClick={() => setMonth(new Date())}>
              오늘
            </button>
            <button className="secondary" onClick={() => setMonth(addMonths(month, 1))}>
              →
            </button>
          </div>
          <h1 style={{ margin: 0 }}>{format(month, "yyyy년 M월", { locale: ko })}</h1>
        </div>

        <div className="grid">
          <section className="panel">
            <div className="calendar">
              {weekdays.map((day) => (
                <div className="weekday" key={day}>
                  {day}
                </div>
              ))}
              {days.map((day) => {
                const dayEvents = events
                  .filter((item) => isSameDay(new Date(item.startsAt), day))
                  .slice(0, 3);

                return (
                  <button
                    key={day.toISOString()}
                    className={`day ${!isSameMonth(day, month) ? "muted" : ""} ${
                      isSameDay(day, new Date()) ? "today" : ""
                    }`}
                    onClick={() => setSelected(day)}
                  >
                    <div className="day-number">{format(day, "d")}</div>
                    {dayEvents.map((item) => (
                      <div className="event-chip" key={item.id}>
                        {format(new Date(item.startsAt), "HH:mm")} {item.title}
                      </div>
                    ))}
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="panel sidebar">
            <h2>{format(selected, "M월 d일 EEEE", { locale: ko })}</h2>
            <div className="event-list">
              {selectedEvents.length === 0 && <div className="event-meta">등록된 일정이 없습니다.</div>}
              {selectedEvents.map((item) => (
                <div className="event-card" key={item.id}>
                  <div className="event-title">{item.title}</div>
                  <div className="event-meta">
                    {format(new Date(item.startsAt), "HH:mm")} · {item.reminderMinutes}분 전 알림
                  </div>
                  {item.notes && <div className="event-meta">{item.notes}</div>}
                  <button className="danger" style={{ marginTop: 10 }} onClick={() => removeEvent(item.id)}>
                    삭제
                  </button>
                </div>
              ))}
            </div>

            <hr style={{ border: 0, borderTop: "1px solid #e5e7eb", margin: "20px 0" }} />

            <form onSubmit={addEvent} style={{ display: "grid", gap: 10 }}>
              <label>
                제목
                <input name="title" placeholder="예: 면접" required />
              </label>
              <div className="form-row">
                <label style={{ flex: 1 }}>
                  날짜
                  <input
                    key={format(selected, "yyyy-MM-dd")}
                    name="date"
                    type="date"
                    defaultValue={format(selected, "yyyy-MM-dd")}
                    required
                  />
                </label>
                <label style={{ flex: 1 }}>
                  시간
                  <input name="time" type="time" required />
                </label>
              </div>
              <label>
                알림
                <select name="reminder" defaultValue="10">
                  <option value="10">10분 전</option>
                  <option value="60">1시간 전</option>
                  <option value="180">3시간 전</option>
                  <option value="1440">하루 전</option>
                </select>
              </label>
              <label>
                메모
                <textarea name="notes" rows={2} placeholder="선택 사항" />
              </label>
              <button className="primary" type="submit">
                일정 추가
              </button>
            </form>
            <div className="status">{status}</div>
          </aside>
        </div>
      </main>
    </>
  );
}
