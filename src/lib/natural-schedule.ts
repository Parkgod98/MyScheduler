export type EventCategory = "deadline" | "exam" | "result" | "interview" | "general";

export type ParsedSchedule = {
  title: string;
  startsAt: string;
  endsAt?: string | null;
  notes: string;
  reminderMinutes: number;
  category: EventCategory;
};

const CATEGORY_RULES: Array<{ category: EventCategory; words: string[] }> = [
  { category: "deadline", words: ["마감", "접수", "서류마감", "지원마감"] },
  { category: "result", words: ["발표", "합격발표", "결과", "서류발표"] },
  { category: "interview", words: ["면접", "인터뷰"] },
  { category: "exam", words: ["시험", "필기", "코테", "코딩테스트", "토익", "토익스피킹"] },
];

function inferCategory(text: string): EventCategory {
  const normalized = text.replace(/\s/g, "").toLowerCase();
  return CATEGORY_RULES.find((rule) => rule.words.some((word) => normalized.includes(word)))?.category ?? "general";
}

function inferTime(text: string, category: EventCategory) {
  const hhmm = text.match(/(?:오전|오후)?\s*(\d{1,2})\s*[:시]\s*(\d{1,2})?\s*분?/);
  if (hhmm) {
    const period = text.slice(Math.max(0, (hhmm.index ?? 0) - 3), (hhmm.index ?? 0) + hhmm[0].length);
    let hour = Number(hhmm[1]);
    const minute = Number(hhmm[2] ?? 0);
    if (period.includes("오후") && hour < 12) hour += 12;
    if (period.includes("오전") && hour === 12) hour = 0;
    return { hour, minute, explicit: true };
  }

  if (category === "deadline") return { hour: 23, minute: 59, explicit: false };
  return { hour: 9, minute: 0, explicit: false };
}

function resolveYear(month: number, day: number, base: Date) {
  const thisYear = new Date(base.getFullYear(), month - 1, day, 12, 0, 0, 0);
  if (thisYear.getTime() < base.getTime() - 180 * 24 * 60 * 60 * 1000) return base.getFullYear() + 1;
  return base.getFullYear();
}

function cleanTitle(line: string) {
  return line
    .replace(/\d{4}\s*년\s*/g, "")
    .replace(/\d{1,2}\s*월\s*\d{1,2}\s*일/g, "")
    .replace(/(?:부터|에서|~|～|-|–|—|까지)/g, " ")
    .replace(/(?:오전|오후)?\s*\d{1,2}\s*[:시]\s*\d{0,2}\s*분?/g, "")
    .replace(/(?:알림|리마인드)\s*\d+\s*(?:분|시간|일)\s*전/g, "")
    .replace(/(?:메모|준비물|참고)\s*[:：]/g, "")
    .replace(/[,.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferReminder(text: string, category: EventCategory) {
  const match = text.match(/(?:알림|리마인드)?\s*(\d+)\s*(분|시간|일)\s*전/);
  if (match) {
    const amount = Number(match[1]);
    if (match[2] === "일") return amount * 1440;
    if (match[2] === "시간") return amount * 60;
    return amount;
  }
  if (category === "deadline") return 1440;
  if (category === "exam" || category === "interview") return 180;
  return 60;
}

function makeDate(year: number, month: number, day: number, hour: number, minute: number) {
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function resolveRangeEndYear(startYear: number, startMonth: number, endMonth: number) {
  return endMonth < startMonth ? startYear + 1 : startYear;
}

export function parseNaturalSchedules(input: string, base = new Date(), defaultDate?: Date): ParsedSchedule[] {
  const chunks = input
    .split(/\n+|(?<=[.!?])\s+|\s*;\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

  const results: ParsedSchedule[] = [];

  for (const chunk of chunks) {
    const dateMatches = [...chunk.matchAll(/(?:(\d{4})\s*년\s*)?(\d{1,2})\s*월\s*(\d{1,2})\s*일/g)];
    const category = inferCategory(chunk);
    const { hour, minute, explicit } = inferTime(chunk, category);

    let startsAt: Date;
    let endsAt: Date | null = null;

    if (dateMatches.length > 0) {
      const startMatch = dateMatches[0];
      const startMonth = Number(startMatch[2]);
      const startDay = Number(startMatch[3]);
      const startYear = startMatch[1] ? Number(startMatch[1]) : resolveYear(startMonth, startDay, base);

      if (dateMatches.length >= 2 && /(?:부터|에서|~|～|-|–|—).*?(?:까지)?/.test(chunk.slice((startMatch.index ?? 0) + startMatch[0].length))) {
        const endMatch = dateMatches[1];
        const endMonth = Number(endMatch[2]);
        const endDay = Number(endMatch[3]);
        const endYear = endMatch[1] ? Number(endMatch[1]) : resolveRangeEndYear(startYear, startMonth, endMonth);
        startsAt = makeDate(startYear, startMonth, startDay, explicit ? hour : 0, explicit ? minute : 0);
        endsAt = makeDate(endYear, endMonth, endDay, explicit ? hour : 23, explicit ? minute : 59);
      } else {
        startsAt = makeDate(startYear, startMonth, startDay, hour, minute);
      }
    } else if (defaultDate) {
      startsAt = new Date(defaultDate.getFullYear(), defaultDate.getMonth(), defaultDate.getDate(), hour, minute, 0, 0);
    } else {
      continue;
    }

    if (endsAt && endsAt.getTime() < startsAt.getTime()) continue;

    const noteMatch = chunk.match(/(?:메모|준비물|참고)\s*[:：]\s*(.+)$/);
    const notes = noteMatch?.[1]?.trim() ?? "";
    let title = cleanTitle(noteMatch ? chunk.slice(0, noteMatch.index) : chunk);
    if (!title) title = category === "deadline" ? "지원 마감" : "일정";

    results.push({
      title,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt?.toISOString() ?? null,
      notes,
      reminderMinutes: inferReminder(chunk, category),
      category,
    });
  }

  return results;
}
