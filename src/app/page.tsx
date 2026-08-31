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

import { parseNaturalSchedules } from "@/lib/natural-schedule";
import type { EventCategory, ParsedSchedule } from "@/lib/natural-schedule";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type ScheduleEvent = ParsedSchedule & {
  id: string;
  completed: boolean;
};

type ViewMode = "calendar" | "tasks";

const STORAGE_KEY = "myscheduler.events.v2";
const INITIAL_NOW = Date.now();
const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
const categoryLabels: Record<EventCategory, string> = {
  deadline: "마감",
  exam: "시험",
  result: "발표",
  interview: "면접",
  general: "일정",
};

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

function sortEvents(items: ScheduleEvent[]) {
  return [...items].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export default function Home() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [month, setMonth] = useState(new Date());
  const [selected, setSelected] = useState(new Date());
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [naturalText, setNaturalText] = useState("");
  const [preview, setPreview] = useState<ParsedSchedule[]>([]);
  const [view, setView] = useState<ViewMode>("calendar");
  const [now, setNow] = useState(INITIAL_NOW);
  const [status, setStatus] = useState("로컬 모드 · 브라우저에 저장됩니다.");

  const loadRemote = useCallback(
    async (uid: string) => {
      if (!supabase) return;
      const { data, error } = await supabase
        .from("events")
        .select("id,title,starts_at,notes,reminder_minutes,category,completed")
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
          category: (row.category ?? "general") as EventCategory,
          completed: Boolean(row.completed),
        })),
      );
      setStatus("동기화 연결됨 · PC와 Android에서 같은 Task를 사용합니다.");
    },
    [supabase],
  );

  useEffect(() => {
    let cancelled = false;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    async function initialize() {
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

      if (uid) await loadRemote(uid);
      else setEvents(readLocalEvents());

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
    if (ready && !userId) localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
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

  const selectedEvents = sortEvents(events.filter((event) => isSameDay(new Date(event.startsAt), selected)));
  const upcomingTasks = sortEvents(events.filter((event) => !event.completed));
  const nextEvent = useMemo(
    () => sortEvents(events.filter((event) => !event.completed && new Date(event.startsAt).getTime() >= now))[0],
    [events, now],
  );

  async function signIn() {
    if (!supabase) return setStatus("Supabase 환경변수가 없어 현재는 로컬 모드입니다.");
    if (!email || !password) return setStatus("이메일과 비밀번호를 입력해주세요.");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setStatus(error ? `로그인 실패: ${error.message}` : "로그인했습니다.");
  }

  async function signUp() {
    if (!supabase) return setStatus("Supabase 환경변수가 없어 회원가입할 수 없습니다.");
    if (!email || password.length < 6) return setStatus("이메일과 6자 이상의 비밀번호를 입력해주세요.");
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return setStatus(`회원가입 실패: ${error.message}`);
    setStatus(data.session ? "회원가입과 로그인이 완료됐습니다." : "회원가입 완료. Supabase의 Confirm Email 설정을 확인해주세요.");
  }

  async function enableNotifications() {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return setStatus("이 브라우저는 Push 알림을 지원하지 않습니다.");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return setStatus("알림 권한이 허용되지 않았습니다.");

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey || !supabase || !userId) return setStatus("로그인과 VAPID 설정 후 백그라운드 Push를 등록할 수 있습니다.");

    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription = existing ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    const json = subscription.toJSON();
    const { error } = await supabase.from("push_subscriptions").upsert(
      { user_id: userId, endpoint: json.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth },
      { onConflict: "endpoint" },
    );
    setStatus(error ? `Push 등록 실패: ${error.message}` : "이 기기의 백그라운드 Push 알림을 등록했습니다.");
  }

  function makePreview() {
    const parsed = parseNaturalSchedules(naturalText);
    setPreview(parsed);
    setStatus(parsed.length ? `${parsed.length}개 일정을 해석했습니다. 아래에서 확인 후 등록하세요.` : "날짜를 찾지 못했습니다. 예: 넥토리얼 9월 7일 마감");
  }

  function updatePreview(index: number, patch: Partial<ParsedSchedule>) {
    setPreview((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  async function persistSchedules(items: ParsedSchedule[]) {
    if (!items.length) return;

    if (supabase && userId) {
      const rows = items.map((item) => ({
        user_id: userId,
        title: item.title,
        starts_at: item.startsAt,
        notes: item.notes,
        reminder_minutes: item.reminderMinutes,
        category: item.category,
        completed: false,
      }));
      const { data, error } = await supabase
        .from("events")
        .insert(rows)
        .select("id,title,starts_at,notes,reminder_minutes,category,completed");
      if (error) return setStatus(`일괄 저장 실패: ${error.message}`);
      const saved: ScheduleEvent[] = (data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        startsAt: row.starts_at,
        notes: row.notes,
        reminderMinutes: row.reminder_minutes,
        category: row.category as EventCategory,
        completed: Boolean(row.completed),
      }));
      setEvents((current) => sortEvents([...current, ...saved]));
    } else {
      const saved = items.map((item) => ({ ...item, id: crypto.randomUUID(), completed: false }));
      setEvents((current) => sortEvents([...current, ...saved]));
    }

    setNaturalText("");
    setPreview([]);
    setStatus(`${items.length}개 Task를 등록했습니다.`);
  }

  async function addManualEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") || "").trim();
    const date = String(data.get("date") || "");
    const time = String(data.get("time") || "23:59");
    const notes = String(data.get("notes") || "").trim();
    const category = String(data.get("category") || "general") as EventCategory;
    const reminderMinutes = Number(data.get("reminder") || 60);
    if (!title || !date) return setStatus("제목과 날짜를 입력해주세요.");
    await persistSchedules([{ title, startsAt: new Date(`${date}T${time}:00`).toISOString(), notes, reminderMinutes, category }]);
    event.currentTarget.reset();
  }

  async function toggleCompleted(item: ScheduleEvent) {
    const completed = !item.completed;
    if (supabase && userId) {
      const { error } = await supabase.from("events").update({ completed }).eq("id", item.id).eq("user_id", userId);
      if (error) return setStatus(`상태 변경 실패: ${error.message}`);
    }
    setEvents((current) => current.map((event) => event.id === item.id ? { ...event, completed } : event));
  }

  async function updateNotes(item: ScheduleEvent, notes: string) {
    if (supabase && userId) {
      const { error } = await supabase.from("events").update({ notes }).eq("id", item.id).eq("user_id", userId);
      if (error) return setStatus(`메모 저장 실패: ${error.message}`);
    }
    setEvents((current) => current.map((event) => event.id === item.id ? { ...event, notes } : event));
    setStatus("메모를 저장했습니다.");
  }

  async function removeEvent(id: string) {
    if (supabase && userId) {
      const { error } = await supabase.from("events").delete().eq("id", id).eq("user_id", userId);
      if (error) return setStatus(`삭제 실패: ${error.message}`);
    }
    setEvents((current) => current.filter((item) => item.id !== id));
  }

  return (
    <>
      <header className="header">
        <div className="header-inner">
          <div>
            <div className="brand">MyScheduler</div>
            <div className="brand-sub">채용 · 시험 · 발표 일정을 한 번에</div>
          </div>
          <div className="next-event">{nextEvent ? `다음 일정 · ${format(new Date(nextEvent.startsAt), "M/d HH:mm")} ${nextEvent.title}` : "예정된 일정이 없습니다"}</div>
          <button className="secondary" onClick={enableNotifications}>🔔 알림 켜기</button>
        </div>
      </header>

      <main className="container">
        <section className="panel auth-panel">
          {supabase ? userId ? (
            <div className="auth-connected"><div><strong>동기화 연결됨</strong><span> 이 계정의 일정이 PC와 Android에 동기화됩니다.</span></div><button className="ghost" onClick={() => supabase.auth.signOut()}>로그아웃</button></div>
          ) : (
            <div className="auth-form">
              <div className="auth-copy"><strong>계정 연결</strong><span>메일 링크 없이 이메일·비밀번호로 바로 로그인합니다.</span></div>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="이메일" />
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="비밀번호 (6자 이상)" onKeyDown={(event) => { if (event.key === "Enter") void signIn(); }} />
              <button className="primary" onClick={signIn}>로그인</button>
              <button className="secondary" onClick={signUp}>회원가입</button>
            </div>
          ) : <div className="event-meta">Supabase 설정 전에는 로컬 모드로 사용할 수 있습니다.</div>}
        </section>

        <section className="quick-add panel">
          <div className="section-heading">
            <div><span className="eyebrow">빠른 등록</span><h1>말하듯 적으면 일정으로 정리해요</h1></div>
            <span className="free-badge">LLM 비용 0원</span>
          </div>
          <textarea className="natural-input" value={naturalText} onChange={(event) => setNaturalText(event.target.value)} rows={4} placeholder={"예) 넥토리얼 9월 7일 마감\n우리은행 9월 8일 마감\nKBS 필기 발표 9월 14일\nKBS 필기 8월 30일 오전 8시 30분, 메모: 8시 30분 입실 · 컴싸 · 여권"} />
          <div className="quick-actions"><div className="helper">한 줄에 하나씩 적으면 가장 정확하고, 시간 생략 시 마감은 23:59 · 그 외 일정은 09:00으로 잡습니다.</div><button className="primary" onClick={makePreview}>일정 해석하기</button></div>

          {preview.length > 0 && <div className="preview-list">
            {preview.map((item, index) => <div className="preview-card" key={`${item.startsAt}-${index}`}>
              <div className={`category-dot category-${item.category}`} />
              <div className="preview-main">
                <input className="preview-title" value={item.title} onChange={(event) => updatePreview(index, { title: event.target.value })} />
                <div className="preview-fields">
                  <input type="datetime-local" value={format(new Date(item.startsAt), "yyyy-MM-dd'T'HH:mm")} onChange={(event) => updatePreview(index, { startsAt: new Date(event.target.value).toISOString() })} />
                  <select value={item.category} onChange={(event) => updatePreview(index, { category: event.target.value as EventCategory })}>{Object.entries(categoryLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
                  <select value={item.reminderMinutes} onChange={(event) => updatePreview(index, { reminderMinutes: Number(event.target.value) })}><option value={10}>10분 전</option><option value={60}>1시간 전</option><option value={180}>3시간 전</option><option value={1440}>하루 전</option></select>
                </div>
                <input value={item.notes} onChange={(event) => updatePreview(index, { notes: event.target.value })} placeholder="메모 / 준비물" />
              </div>
              <button className="ghost" onClick={() => setPreview((current) => current.filter((_, i) => i !== index))}>제외</button>
            </div>)}
            <button className="primary wide" onClick={() => void persistSchedules(preview)}>확인한 {preview.length}개 일정 한 번에 등록</button>
          </div>}
        </section>

        <div className="view-toolbar">
          <div className="segmented"><button className={view === "calendar" ? "active" : ""} onClick={() => setView("calendar")}>캘린더</button><button className={view === "tasks" ? "active" : ""} onClick={() => setView("tasks")}>Task</button></div>
          {view === "calendar" && <div className="month-controls"><button className="ghost" onClick={() => setMonth(subMonths(month, 1))}>←</button><button className="ghost" onClick={() => { const today = new Date(); setMonth(today); setSelected(today); }}>오늘</button><button className="ghost" onClick={() => setMonth(addMonths(month, 1))}>→</button><strong>{format(month, "yyyy년 M월", { locale: ko })}</strong></div>}
        </div>

        {view === "calendar" ? <div className="grid">
          <section className="panel calendar-panel"><div className="calendar">
            {weekdays.map((day) => <div className="weekday" key={day}>{day}</div>)}
            {days.map((day) => {
              const dayEvents = sortEvents(events.filter((item) => isSameDay(new Date(item.startsAt), day))).slice(0, 4);
              return <button key={day.toISOString()} className={`day ${!isSameMonth(day, month) ? "muted" : ""} ${isSameDay(day, new Date()) ? "today" : ""} ${isSameDay(day, selected) ? "selected" : ""}`} onClick={() => setSelected(day)}>
                <div className="day-number">{format(day, "d")}</div>
                {dayEvents.map((item) => <div className={`event-chip category-${item.category} ${item.completed ? "done" : ""}`} key={item.id}><span>{categoryLabels[item.category]}</span>{format(new Date(item.startsAt), "HH:mm")} {item.title}</div>)}
                {events.filter((item) => isSameDay(new Date(item.startsAt), day)).length > 4 && <div className="more-count">+ 더보기</div>}
              </button>;
            })}
          </div></section>

          <aside className="panel sidebar">
            <div className="sidebar-heading"><div><span className="eyebrow">선택한 날짜</span><h2>{format(selected, "M월 d일 EEEE", { locale: ko })}</h2></div><span className="count-badge">{selectedEvents.length}</span></div>
            <div className="event-list">{selectedEvents.length === 0 && <div className="empty-state">등록된 일정이 없습니다.</div>}{selectedEvents.map((item) => <TaskCard key={item.id} item={item} onToggle={toggleCompleted} onDelete={removeEvent} onSaveNotes={updateNotes} />)}</div>
            <details className="manual-add"><summary>직접 입력으로 추가</summary><form onSubmit={addManualEvent}>
              <input name="title" placeholder="일정 제목" required />
              <div className="form-row"><input name="date" type="date" defaultValue={format(selected, "yyyy-MM-dd")} required /><input name="time" type="time" defaultValue="23:59" /></div>
              <div className="form-row"><select name="category" defaultValue="general">{Object.entries(categoryLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select name="reminder" defaultValue="60"><option value="10">10분 전</option><option value="60">1시간 전</option><option value="180">3시간 전</option><option value="1440">하루 전</option></select></div>
              <textarea name="notes" rows={2} placeholder="메모 / 준비물" /><button className="secondary wide" type="submit">추가</button>
            </form></details>
          </aside>
        </div> : <section className="panel task-board">
          <div className="task-board-heading"><div><span className="eyebrow">전체 Task</span><h2>다가오는 일정 {upcomingTasks.length}개</h2></div></div>
          <div className="task-groups">{upcomingTasks.length === 0 ? <div className="empty-state">남은 Task가 없습니다.</div> : upcomingTasks.map((item) => <TaskCard key={item.id} item={item} onToggle={toggleCompleted} onDelete={removeEvent} onSaveNotes={updateNotes} />)}</div>
        </section>}

        <div className="status">{status}</div>
      </main>
    </>
  );
}

function TaskCard({ item, onToggle, onDelete, onSaveNotes }: { item: ScheduleEvent; onToggle: (item: ScheduleEvent) => Promise<void>; onDelete: (id: string) => Promise<void>; onSaveNotes: (item: ScheduleEvent, notes: string) => Promise<void>; }) {
  const [notes, setNotes] = useState(item.notes);
  return <article className={`event-card ${item.completed ? "completed" : ""}`}>
    <div className="event-card-top"><div className={`category-pill category-${item.category}`}>{categoryLabels[item.category]}</div><button className={`check-button ${item.completed ? "checked" : ""}`} onClick={() => void onToggle(item)}>{item.completed ? "✓ 완료" : "완료 처리"}</button></div>
    <div className="event-title">{item.title}</div>
    <div className="event-meta strong">{format(new Date(item.startsAt), "M월 d일 EEEE HH:mm", { locale: ko })}</div>
    <div className="event-meta">{item.reminderMinutes >= 1440 ? `${item.reminderMinutes / 1440}일 전` : item.reminderMinutes >= 60 ? `${item.reminderMinutes / 60}시간 전` : `${item.reminderMinutes}분 전`} 알림</div>
    <textarea className="task-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="준비물, 링크, 해야 할 일 등을 메모하세요." rows={3} />
    <div className="event-actions"><button className="secondary" onClick={() => void onSaveNotes(item, notes)}>메모 저장</button><button className="danger-link" onClick={() => void onDelete(item.id)}>삭제</button></div>
  </article>;
}
