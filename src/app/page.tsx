"use client";

import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { ko } from "date-fns/locale";
import { FormEvent, useEffect, useMemo, useState } from "react";

type ScheduleEvent = {
  id: string;
  title: string;
  startsAt: string;
  notes: string;
  reminderMinutes: number;
};

const STORAGE_KEY = "myscheduler.events.v1";
const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

export default function Home() {
  const [month, setMonth] = useState(new Date());
  const [selected, setSelected] = useState(new Date());
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("로컬 모드 · 브라우저에 안전하게 저장됩니다.");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setEvents(JSON.parse(saved));
    setReady(true);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  }, [events, ready]);

  const days = useMemo(() => eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 0 }),
  }), [month]);

  const selectedEvents = events
    .filter((event) => isSameDay(new Date(event.startsAt), selected))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const nextEvent = events
    .filter((event) => new Date(event.startsAt).getTime() >= Date.now())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];

  async function enableNotifications() {
    if (!("Notification" in window)) return setStatus("이 브라우저는 알림을 지원하지 않습니다.");
    const permission = await Notification.requestPermission();
    setStatus(permission === "granted" ? "알림 권한이 켜졌습니다." : "알림 권한이 허용되지 않았습니다.");
  }

  function addEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") || "").trim();
    const date = String(data.get("date") || "");
    const time = String(data.get("time") || "");
    const notes = String(data.get("notes") || "").trim();
    const reminderMinutes = Number(data.get("reminder") || 10);
    if (!title || !date || !time) return setStatus("제목, 날짜, 시간을 입력해주세요.");

    const item: ScheduleEvent = { id: crypto.randomUUID(), title, startsAt: `${date}T${time}:00`, notes, reminderMinutes };
    setEvents((current) => [...current, item]);
    setSelected(new Date(item.startsAt));
    event.currentTarget.reset();
    setStatus("일정을 저장했습니다.");

    const delay = new Date(item.startsAt).getTime() - Date.now() - reminderMinutes * 60_000;
    if (delay > 0 && delay < 2_147_000_000 && Notification.permission === "granted") {
      window.setTimeout(() => new Notification(item.title, { body: `${format(new Date(item.startsAt), "M월 d일 HH:mm")} 일정이 곧 시작됩니다.` }), delay);
    }
  }

  return <>
    <header className="header"><div className="header-inner">
      <div className="brand">MyScheduler</div>
      <div className="next-event">{nextEvent ? `다음 일정 · ${format(new Date(nextEvent.startsAt), "M/d HH:mm")} ${nextEvent.title}` : "예정된 일정이 없습니다"}</div>
      <button className="secondary" onClick={enableNotifications}>🔔 알림 켜기</button>
    </div></header>
    <main className="container">
      <div className="toolbar" style={{justifyContent:"space-between", marginBottom:14}}>
        <div className="toolbar"><button className="secondary" onClick={() => setMonth(subMonths(month, 1))}>←</button><button className="secondary" onClick={() => setMonth(new Date())}>오늘</button><button className="secondary" onClick={() => setMonth(addMonths(month, 1))}>→</button></div>
        <h1 style={{margin:0}}>{format(month, "yyyy년 M월", { locale: ko })}</h1>
      </div>
      <div className="grid">
        <section className="panel">
          <div className="calendar">
            {weekdays.map((day) => <div className="weekday" key={day}>{day}</div>)}
            {days.map((day) => {
              const dayEvents = events.filter((event) => isSameDay(new Date(event.startsAt), day)).slice(0, 3);
              return <button key={day.toISOString()} className={`day ${!isSameMonth(day, month) ? "muted" : ""} ${isSameDay(day, new Date()) ? "today" : ""}`} onClick={() => setSelected(day)}>
                <div className="day-number">{format(day, "d")}</div>
                {dayEvents.map((event) => <div className="event-chip" key={event.id}>{format(new Date(event.startsAt), "HH:mm")} {event.title}</div>)}
              </button>;
            })}
          </div>
        </section>
        <aside className="panel sidebar">
          <h2>{format(selected, "M월 d일 EEEE", { locale: ko })}</h2>
          <div className="event-list">
            {selectedEvents.length === 0 && <div className="event-meta">등록된 일정이 없습니다.</div>}
            {selectedEvents.map((event) => <div className="event-card" key={event.id}>
              <div className="event-title">{event.title}</div><div className="event-meta">{format(new Date(event.startsAt), "HH:mm")} · {event.reminderMinutes}분 전 알림</div>
              {event.notes && <div className="event-meta">{event.notes}</div>}
              <button className="danger" style={{marginTop:10}} onClick={() => setEvents((current) => current.filter((item) => item.id !== event.id))}>삭제</button>
            </div>)}
          </div>
          <hr style={{border:0,borderTop:"1px solid #e5e7eb",margin:"20px 0"}} />
          <form onSubmit={addEvent} style={{display:"grid",gap:10}}>
            <label>제목<input name="title" placeholder="예: KBS 면접" required /></label>
            <div className="form-row"><label style={{flex:1}}>날짜<input name="date" type="date" defaultValue={format(selected, "yyyy-MM-dd")} required /></label><label style={{flex:1}}>시간<input name="time" type="time" required /></label></div>
            <label>알림<select name="reminder" defaultValue="10"><option value="10">10분 전</option><option value="60">1시간 전</option><option value="180">3시간 전</option><option value="1440">하루 전</option></select></label>
            <label>메모<textarea name="notes" rows={2} placeholder="선택 사항" /></label>
            <button className="primary" type="submit">일정 추가</button>
          </form>
          <div className="status">{status}</div>
        </aside>
      </div>
    </main>
  </>;
}
