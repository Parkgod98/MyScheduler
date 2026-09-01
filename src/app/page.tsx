"use client";

import {
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ko } from "date-fns/locale";
import { Bell, CalendarDays, Check, ChevronLeft, ChevronRight, ListTodo, Plus, Settings, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { SharingPanel } from "@/components/SharingPanel";
import { parseNaturalSchedules } from "@/lib/natural-schedule";
import type { EventCategory, ParsedSchedule } from "@/lib/natural-schedule";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type ChecklistItem = { id: string; text: string; done: boolean };
type ScheduleEvent = ParsedSchedule & {
  id: string;
  completed: boolean;
  checklist: ChecklistItem[];
  readOnly?: boolean;
  ownerName?: string;
};
type EventPatch = Partial<Pick<ScheduleEvent, "title" | "startsAt" | "category" | "reminderMinutes" | "notes" | "checklist" | "completed">>;
type PatchEvent = (item: ScheduleEvent, patch: EventPatch) => Promise<boolean>;
type ViewMode = "calendar" | "tasks" | "add" | "settings";
type TaskFilter = "all" | EventCategory;

const STORAGE_KEY = "myscheduler.events.v4";
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

function dday(startsAt: string, now: number) {
  const days = differenceInCalendarDays(startOfDay(new Date(startsAt)), startOfDay(new Date(now)));
  if (days === 0) return "D-Day";
  if (days > 0) return `D-${days}`;
  return `D+${Math.abs(days)}`;
}

function densityClass(count: number) {
  if (count >= 5) return "density-packed";
  if (count >= 3) return "density-busy";
  if (count >= 2) return "density-medium";
  return "density-calm";
}

function reminderLabel(minutes: number) {
  if (minutes === 0) return "정각";
  if (minutes % 1440 === 0) return `${minutes / 1440}일 전`;
  if (minutes % 60 === 0) return `${minutes / 60}시간 전`;
  return `${minutes}분 전`;
}

function toDateTimeLocal(startsAt: string) {
  return format(new Date(startsAt), "yyyy-MM-dd'T'HH:mm");
}

function rowToEvent(row: Record<string, unknown>): ScheduleEvent {
  return {
    id: String(row.id),
    title: String(row.title),
    startsAt: String(row.starts_at),
    notes: String(row.notes ?? ""),
    reminderMinutes: Number(row.reminder_minutes ?? 60),
    category: (row.category ?? "general") as EventCategory,
    completed: Boolean(row.completed),
    checklist: Array.isArray(row.checklist) ? (row.checklist as ChecklistItem[]) : [],
  };
}

function sharedRowToEvent(row: Record<string, unknown>): ScheduleEvent {
  return {
    id: `shared-${String(row.owner_id)}-${String(row.id)}`,
    title: String(row.title),
    startsAt: String(row.starts_at),
    notes: "",
    reminderMinutes: 0,
    category: (row.category ?? "general") as EventCategory,
    completed: Boolean(row.completed),
    checklist: [],
    readOnly: true,
    ownerName: String(row.owner_name ?? "구독 캘린더"),
  };
}

export default function Home() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [month, setMonth] = useState(new Date());
  const [selected, setSelected] = useState(new Date());
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [sharedEvents, setSharedEvents] = useState<ScheduleEvent[]>([]);
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [naturalText, setNaturalText] = useState("");
  const [preview, setPreview] = useState<ParsedSchedule[]>([]);
  const [view, setView] = useState<ViewMode>("calendar");
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showShared, setShowShared] = useState(true);
  const [sharingVersion, setSharingVersion] = useState(0);
  const [now, setNow] = useState(INITIAL_NOW);
  const [status, setStatus] = useState("로컬 모드 · 브라우저에 저장됩니다.");

  const loadRemote = useCallback(async (uid: string) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("events")
      .select("id,title,starts_at,notes,reminder_minutes,category,completed,checklist")
      .eq("user_id", uid)
      .order("starts_at");
    if (error) return setStatus(`동기화 실패: ${error.message}`);
    setEvents((data ?? []).map((row) => rowToEvent(row as Record<string, unknown>)));
    setStatus("동기화 연결됨");
  }, [supabase]);

  const loadShared = useCallback(async () => {
    if (!supabase || !userId) {
      setSharedEvents([]);
      return;
    }
    const rangeStart = startOfMonth(subMonths(month, 1)).toISOString();
    const rangeEnd = addMonths(endOfMonth(addMonths(month, 1)), 1).toISOString();
    const { data, error } = await supabase.rpc("get_subscribed_events", { range_start: rangeStart, range_end: rangeEnd });
    if (error) {
      if (!error.message.includes("get_subscribed_events")) setStatus(`구독 캘린더 로드 실패: ${error.message}`);
      return;
    }
    const sharedRows = (data ?? []) as Record<string, unknown>[];
    setSharedEvents(sharedRows.map(sharedRowToEvent));
  }, [month, supabase, userId]);

  useEffect(() => {
    let cancelled = false;
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
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
      else setSharedEvents([]);
    });
    return () => {
      cancelled = true;
      listener?.data.subscription.unsubscribe();
    };
  }, [loadRemote, supabase]);

  useEffect(() => { void loadShared(); }, [loadShared, sharingVersion]);
  useEffect(() => { if (ready && !userId) localStorage.setItem(STORAGE_KEY, JSON.stringify(events)); }, [events, ready, userId]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);

  const days = useMemo(() => eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 0 }),
  }), [month]);

  const calendarEvents = showShared ? sortEvents([...events, ...sharedEvents]) : sortEvents(events);
  const selectedEvents = sortEvents(calendarEvents.filter((event) => isSameDay(new Date(event.startsAt), selected)));
  const upcomingTasks = sortEvents(events.filter((event) => !event.completed && new Date(event.startsAt).getTime() >= now));
  const filteredTasks = upcomingTasks.filter((event) => filter === "all" || event.category === filter);
  const nextEvent = upcomingTasks[0];
  const dueSoon = upcomingTasks.filter((event) => differenceInCalendarDays(new Date(event.startsAt), new Date(now)) <= 7).length;

  async function signIn() {
    if (!supabase) return setStatus("Supabase 설정이 없어 로컬 모드입니다.");
    if (!email || !password) return setStatus("이메일과 비밀번호를 입력해주세요.");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setStatus(error ? `로그인 실패: ${error.message}` : "로그인했습니다.");
  }

  async function signUp() {
    if (!supabase) return setStatus("Supabase 설정이 없어 회원가입할 수 없습니다.");
    if (!email || password.length < 6) return setStatus("이메일과 6자 이상의 비밀번호를 입력해주세요.");
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return setStatus(`회원가입 실패: ${error.message}`);
    setStatus(data.session ? "회원가입과 로그인이 완료됐습니다." : "회원가입 완료. Confirm Email 설정을 확인해주세요.");
  }

  async function enableNotifications() {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return setStatus("이 브라우저는 Push 알림을 지원하지 않습니다.");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return setStatus("알림 권한이 허용되지 않았습니다.");
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey || !supabase || !userId) return setStatus("로그인과 VAPID 설정 후 Push를 등록할 수 있습니다.");
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription = existing ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
    const json = subscription.toJSON();
    const { error } = await supabase.from("push_subscriptions").upsert({ user_id: userId, endpoint: json.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth }, { onConflict: "endpoint" });
    setStatus(error ? `Push 등록 실패: ${error.message}` : "이 기기의 Push 알림을 등록했습니다.");
  }

  function makePreview() {
    const parsed = parseNaturalSchedules(naturalText);
    setPreview(parsed);
    setStatus(parsed.length ? `${parsed.length}개 일정을 해석했습니다.` : "날짜를 찾지 못했습니다.");
  }

  function updatePreview(index: number, patch: Partial<ParsedSchedule>) {
    setPreview((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  async function persistSchedules(items: ParsedSchedule[]) {
    if (!items.length) return;
    if (supabase && userId) {
      const rows = items.map((item) => ({ user_id: userId, title: item.title, starts_at: item.startsAt, notes: item.notes, reminder_minutes: item.reminderMinutes, category: item.category, completed: false, checklist: [] }));
      const { data, error } = await supabase.from("events").insert(rows).select("id,title,starts_at,notes,reminder_minutes,category,completed,checklist");
      if (error) return setStatus(`저장 실패: ${error.message}`);
      setEvents((current) => sortEvents([...current, ...(data ?? []).map((row) => rowToEvent(row as Record<string, unknown>))]));
    } else {
      const saved = items.map((item) => ({ ...item, id: crypto.randomUUID(), completed: false, checklist: [] }));
      setEvents((current) => sortEvents([...current, ...saved]));
    }
    setNaturalText("");
    setPreview([]);
    setStatus(`${items.length}개 Task를 등록했습니다.`);
    setView("calendar");
  }

  async function patchEvent(item: ScheduleEvent, patch: EventPatch): Promise<boolean> {
    if (item.readOnly) return false;
    if (supabase && userId) {
      const dbPatch: Record<string, unknown> = {};
      if (patch.title !== undefined) dbPatch.title = patch.title;
      if (patch.startsAt !== undefined) dbPatch.starts_at = patch.startsAt;
      if (patch.category !== undefined) dbPatch.category = patch.category;
      if (patch.reminderMinutes !== undefined) dbPatch.reminder_minutes = patch.reminderMinutes;
      if (patch.notes !== undefined) dbPatch.notes = patch.notes;
      if (patch.checklist !== undefined) dbPatch.checklist = patch.checklist;
      if (patch.completed !== undefined) dbPatch.completed = patch.completed;
      const { error } = await supabase.from("events").update(dbPatch).eq("id", item.id).eq("user_id", userId);
      if (error) {
        setStatus(`저장 실패: ${error.message}`);
        return false;
      }
    }
    setEvents((current) => sortEvents(current.map((event) => event.id === item.id ? { ...event, ...patch } : event)));
    setStatus("일정을 저장했습니다.");
    return true;
  }

  async function removeEvent(id: string) {
    if (supabase && userId) {
      const { error } = await supabase.from("events").delete().eq("id", id).eq("user_id", userId);
      if (error) return setStatus(`삭제 실패: ${error.message}`);
    }
    setEvents((current) => current.filter((item) => item.id !== id));
  }

  function openDate(day: Date) { setSelected(day); setSheetOpen(true); }

  return <div className="app-shell">
    <header className="topbar"><div className="topbar-inner"><div><div className="brand">MyScheduler</div><div className="top-summary">{nextEvent ? `${dday(nextEvent.startsAt, now)} · ${nextEvent.title}` : "예정된 일정이 없습니다"}</div></div><button className="icon-button" onClick={enableNotifications} aria-label="알림 켜기"><Bell size={20} /></button></div></header>

    <main className="main-content">
      {view === "calendar" && <>
        <section className="overview-row"><div><span>이번 주</span><strong>{dueSoon}개</strong></div><div><span>다가오는 일정</span><strong>{upcomingTasks.length}개</strong></div><div className="overview-next"><span>다음 일정</span><strong>{nextEvent ? nextEvent.title : "없음"}</strong></div></section>
        <section className="calendar-toolbar"><div className="month-title">{format(month, "yyyy년 M월", { locale: ko })}</div><div className="month-actions"><button onClick={() => setMonth(subMonths(month, 1))}><ChevronLeft size={18} /></button><button onClick={() => { const today = new Date(); setMonth(today); setSelected(today); }}>오늘</button><button onClick={() => setMonth(addMonths(month, 1))}><ChevronRight size={18} /></button></div></section>
        <div className="calendar-subtoolbar"><div className="legend">{(Object.entries(categoryLabels) as [EventCategory, string][]).map(([key, label]) => <span key={key}><i className={`dot dot-${key}`} />{label}</span>)}</div>{userId && <button className={`shared-toggle ${showShared ? "active" : ""}`} onClick={() => setShowShared((value) => !value)}>구독 일정 {showShared ? "포함" : "숨김"}</button>}</div>
        <section className="calendar-card"><div className="calendar-grid">{weekdays.map((day) => <div className="weekday" key={day}>{day}</div>)}{days.map((day) => {
          const dayEvents = sortEvents(calendarEvents.filter((item) => isSameDay(new Date(item.startsAt), day)));
          return <button key={day.toISOString()} className={`day ${!isSameMonth(day, month) ? "muted" : ""} ${isSameDay(day, new Date(now)) ? "today" : ""} ${densityClass(dayEvents.length)}`} onClick={() => openDate(day)}>
            <div className="day-head"><span className="day-number">{format(day, "d")}</span>{dayEvents.length > 0 && <span className="day-load-badge">{dayEvents.length}건</span>}</div>
            <div className="day-events">{dayEvents.slice(0, 2).map((item) => <div key={item.id} className={`calendar-event event-${item.category} ${item.completed ? "done" : ""} ${item.readOnly ? "shared-event" : ""}`}><span className="calendar-event-title">{item.title}</span>{item.ownerName && <span className="calendar-event-owner">{item.ownerName}</span>}<span className="calendar-event-time">{format(new Date(item.startsAt), "HH:mm")}</span></div>)}{dayEvents.length > 2 && <span className="more-events">+{dayEvents.length - 2}개 더 · 눌러서 전체 보기</span>}</div>
          </button>;
        })}</div></section>
      </>}

      {view === "tasks" && <section className="tasks-page"><div className="page-heading"><div><span className="eyebrow">TASKS</span><h1>다가오는 일정</h1></div><span>{filteredTasks.length}개</span></div><div className="filter-strip"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>전체</button>{(Object.entries(categoryLabels) as [EventCategory, string][]).map(([key, label]) => <button className={filter === key ? "active" : ""} key={key} onClick={() => setFilter(key)}>{label}</button>)}</div><div className="task-list">{filteredTasks.length === 0 && <div className="empty-state">조건에 맞는 일정이 없습니다.</div>}{filteredTasks.map((item) => <TaskCard key={item.id} item={item} now={now} onPatch={patchEvent} onDelete={removeEvent} />)}</div></section>}

      {view === "add" && <section className="add-page"><div className="page-heading"><div><span className="eyebrow">QUICK ADD</span><h1>말하듯 적어주세요</h1></div><Sparkles size={24} /></div><p className="page-description">한 줄에 하나씩 적으면 날짜·시간·종류·알림을 자동으로 정리합니다.</p><textarea className="natural-input" value={naturalText} onChange={(event) => setNaturalText(event.target.value)} rows={7} placeholder={"현대자동차 9월 14일 마감\nKBS 필기 발표 9월 14일\nKBS 시험 9월 30일 오전 9시 메모: 여권 챙기기"} /><button className="primary wide" onClick={makePreview}><Sparkles size={17} /> 일정 해석하기</button>{preview.length > 0 && <div className="preview-list">{preview.map((item, index) => <div className="preview-card" key={`${item.startsAt}-${index}`}><div className="preview-head"><span className={`category-badge badge-${item.category}`}>{categoryLabels[item.category]}</span><button onClick={() => setPreview((current) => current.filter((_, i) => i !== index))}><X size={16} /></button></div><input className="preview-title" value={item.title} onChange={(event) => updatePreview(index, { title: event.target.value })} /><input type="datetime-local" value={format(new Date(item.startsAt), "yyyy-MM-dd'T'HH:mm")} onChange={(event) => updatePreview(index, { startsAt: new Date(event.target.value).toISOString() })} /><div className="preview-row"><select value={item.category} onChange={(event) => updatePreview(index, { category: event.target.value as EventCategory })}>{(Object.entries(categoryLabels) as [EventCategory, string][]).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select value={item.reminderMinutes} onChange={(event) => updatePreview(index, { reminderMinutes: Number(event.target.value) })}><option value={10}>10분 전</option><option value={60}>1시간 전</option><option value={180}>3시간 전</option><option value={1440}>하루 전</option></select></div><textarea value={item.notes} onChange={(event) => updatePreview(index, { notes: event.target.value })} rows={2} placeholder="메모 / 준비물" /></div>)}<button className="primary wide" onClick={() => void persistSchedules(preview)}>{preview.length}개 일정 등록</button></div>}</section>}

      {view === "settings" && <section className="settings-page"><div className="page-heading"><div><span className="eyebrow">SETTINGS</span><h1>설정</h1></div></div><div className="settings-card"><h2>계정</h2>{supabase ? userId ? <><p>Supabase 동기화가 연결되어 있습니다.</p><button className="secondary" onClick={() => supabase.auth.signOut()}>로그아웃</button></> : <div className="login-form"><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="이메일" /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="비밀번호" /><button className="primary" onClick={signIn}>로그인</button><button className="secondary" onClick={signUp}>회원가입</button></div> : <p>현재 로컬 모드입니다.</p>}</div><div className="settings-card"><h2>알림</h2><p>이 기기에서 백그라운드 Push 알림을 받습니다.</p><button className="secondary" onClick={enableNotifications}><Bell size={16} /> 알림 켜기</button></div><div className="settings-card"><h2>캘린더 공유 · 구독</h2><SharingPanel supabase={supabase} userId={userId} onChanged={() => setSharingVersion((value) => value + 1)} /></div><div className="settings-card"><h2>Android 홈 위젯</h2><p>다음 일정과 오늘 일정을 홈 화면에서 바로 확인하는 네이티브 위젯은 별도 Android 패키지로 추가할 예정입니다.</p></div></section>}
      <div className="status-toast">{status}</div>
    </main>

    <nav className="bottom-nav" aria-label="주요 메뉴"><button className={view === "calendar" ? "active" : ""} onClick={() => setView("calendar")}><CalendarDays size={21} /><span>캘린더</span></button><button className={view === "tasks" ? "active" : ""} onClick={() => setView("tasks")}><ListTodo size={21} /><span>Task</span></button><button className={`add-nav ${view === "add" ? "active" : ""}`} onClick={() => setView("add")}><span className="add-icon"><Plus size={22} /></span><span>빠른추가</span></button><button className={view === "settings" ? "active" : ""} onClick={() => setView("settings")}><Settings size={21} /><span>설정</span></button></nav>
    {sheetOpen && <DateSheet date={selected} items={selectedEvents} now={now} onClose={() => setSheetOpen(false)} onPatch={patchEvent} onDelete={removeEvent} onAdd={() => { setSheetOpen(false); setView("add"); }} />}
  </div>;
}

function DateSheet({ date, items, now, onClose, onPatch, onDelete, onAdd }: { date: Date; items: ScheduleEvent[]; now: number; onClose: () => void; onPatch: PatchEvent; onDelete: (id: string) => Promise<void>; onAdd: () => void; }) {
  return <div className="sheet-backdrop" onMouseDown={onClose} role="presentation"><section className="bottom-sheet" onMouseDown={(event) => event.stopPropagation()} aria-modal="true" role="dialog"><div className="sheet-handle" /><div className="sheet-header"><div><span className="eyebrow">{format(date, "yyyy.MM.dd")}</span><h2>{format(date, "M월 d일 EEEE", { locale: ko })} · {items.length}건</h2></div><button className="icon-button" onClick={onClose}><X size={20} /></button></div><div className="sheet-list">{items.length === 0 ? <div className="empty-state">등록된 일정이 없습니다.</div> : items.map((item) => <TaskCard key={item.id} item={item} now={now} onPatch={onPatch} onDelete={onDelete} />)}</div><button className="primary wide" onClick={onAdd}><Plus size={17} /> 이 날짜에 일정 추가</button></section></div>;
}

function TaskCard({ item, now, onPatch, onDelete }: { item: ScheduleEvent; now: number; onPatch: PatchEvent; onDelete: (id: string) => Promise<void>; }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [startsAt, setStartsAt] = useState(toDateTimeLocal(item.startsAt));
  const [category, setCategory] = useState<EventCategory>(item.category);
  const [reminderMinutes, setReminderMinutes] = useState(item.reminderMinutes);
  const [notes, setNotes] = useState(item.notes);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(item.checklist);
  const [newItem, setNewItem] = useState("");
  const [editError, setEditError] = useState("");

  useEffect(() => {
    setTitle(item.title);
    setStartsAt(toDateTimeLocal(item.startsAt));
    setCategory(item.category);
    setReminderMinutes(item.reminderMinutes);
    setNotes(item.notes);
    setChecklist(item.checklist);
  }, [item.title, item.startsAt, item.category, item.reminderMinutes, item.notes, item.checklist]);

  if (item.readOnly) return <article className="task-card shared-task"><div className="task-card-top"><div className="task-tags"><span className={`category-badge badge-${item.category}`}>{categoryLabels[item.category]}</span><span className="dday">{dday(item.startsAt, now)}</span><span className="shared-owner-badge">{item.ownerName}</span></div></div><h3>{item.title}</h3><div className="task-time">{format(new Date(item.startsAt), "M월 d일 EEEE HH:mm", { locale: ko })}</div><div className="sharing-note">구독 캘린더 · 읽기 전용</div></article>;

  function addChecklist() {
    const text = newItem.trim();
    if (!text) return;
    setChecklist((current) => [...current, { id: crypto.randomUUID(), text, done: false }]);
    setNewItem("");
  }

  function cancelEditing() {
    setTitle(item.title);
    setStartsAt(toDateTimeLocal(item.startsAt));
    setCategory(item.category);
    setReminderMinutes(item.reminderMinutes);
    setNotes(item.notes);
    setChecklist(item.checklist);
    setEditError("");
    setEditing(false);
  }

  async function saveEditing() {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) return setEditError("일정명을 입력해주세요.");
    if (!startsAt) return setEditError("날짜와 시간을 입력해주세요.");
    const parsedDate = new Date(startsAt);
    if (Number.isNaN(parsedDate.getTime())) return setEditError("날짜와 시간을 확인해주세요.");
    if (!Number.isFinite(reminderMinutes) || reminderMinutes < 0) return setEditError("알림 시간은 0분 이상이어야 합니다.");

    const saved = await onPatch(item, {
      title: normalizedTitle,
      startsAt: parsedDate.toISOString(),
      category,
      reminderMinutes,
      notes,
      checklist,
    });
    if (saved) {
      setEditError("");
      setEditing(false);
    }
  }

  return <article className={`task-card ${item.completed ? "completed" : ""}`}>
    <div className="task-card-top"><div className="task-tags"><span className={`category-badge badge-${item.category}`}>{categoryLabels[item.category]}</span><span className="dday">{dday(item.startsAt, now)}</span></div><button className={`complete-button ${item.completed ? "done" : ""}`} onClick={() => void onPatch(item, { completed: !item.completed })}>{item.completed ? <Check size={15} /> : null}{item.completed ? "완료" : "완료 처리"}</button></div>

    {editing ? <div className="preview-card">
      <input className="preview-title" value={title} onChange={(event) => setTitle(event.target.value)} aria-label="일정명" />
      <input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} aria-label="날짜와 시간" />
      <div className="preview-row">
        <select value={category} onChange={(event) => setCategory(event.target.value as EventCategory)} aria-label="카테고리">{(Object.entries(categoryLabels) as [EventCategory, string][]).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <input type="number" min={0} step={10} value={reminderMinutes} onChange={(event) => setReminderMinutes(Number(event.target.value))} aria-label="알림 몇 분 전" placeholder="알림 몇 분 전" />
      </div>
      <div className="page-description">알림은 일정 시작 기준 <strong>{reminderLabel(reminderMinutes)}</strong>으로 저장됩니다.</div>
      {editError && <div className="status-toast">{editError}</div>}
    </div> : <>
      <h3>{item.title}</h3>
      <div className="task-time">{format(new Date(item.startsAt), "M월 d일 EEEE HH:mm", { locale: ko })}</div>
      <div className="task-time">알림 · {reminderLabel(item.reminderMinutes)}</div>
    </>}

    <div className="task-detail-section"><label>메모</label><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} placeholder="준비사항, 장소, 링크 등을 기록하세요." /></div>
    <div className="task-detail-section"><label>준비물 체크리스트</label><div className="checklist">{checklist.map((check) => <label className="check-row" key={check.id}><input type="checkbox" checked={check.done} onChange={() => setChecklist((current) => current.map((entry) => entry.id === check.id ? { ...entry, done: !entry.done } : entry))} /><span>{check.text}</span><button onClick={() => setChecklist((current) => current.filter((entry) => entry.id !== check.id))}><X size={14} /></button></label>)}</div><div className="check-add"><input value={newItem} onChange={(event) => setNewItem(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addChecklist(); } }} placeholder="예: 여권" /><button className="secondary" onClick={addChecklist}>추가</button></div></div>

    <div className="task-actions">{editing ? <><button className="primary" onClick={() => void saveEditing()}>변경사항 저장</button><button className="secondary" onClick={cancelEditing}>취소</button></> : <><button className="secondary" onClick={() => void onPatch(item, { notes, checklist })}>메모 저장</button><button className="secondary" onClick={() => { setEditError(""); setEditing(true); }}>일정 수정</button></>}<button className="danger-link" onClick={() => void onDelete(item.id)}>삭제</button></div>
  </article>;
}
