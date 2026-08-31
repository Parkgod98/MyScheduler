export type EventCategory = "deadline" | "exam" | "result" | "interview" | "general";

export type ParsedSchedule = {
  title: string;
  startsAt: string;
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

  // 채용 마감은 시간이 생략되는 경우가 많아 하루 끝으로 두는 편이 실용적이다.
  if (category === "deadline") return { hour: 23, minute: 59, explicit: false };
  return { hour: 9, minute: 0, explicit: false };
}

function resolveYear(month: number, day: number, base: Date) {
  const thisYear = new Date(base.getFullYear(), month - 1, day, 12, 0, 0, 0);
  // 이미 6개월 이상 지난 월/일을 입력하면 다음 해 일정으로 해석한다.
  if (thisYear.getTime() < base.getTime() - 180 * 24 * 60 * 60 * 1000) return base.getFullYear() + 1;
  return base.getFullYear();
}

function cleanTitle(line: string) {
  return line
    .replace(/\d{4}\s*년\s*/g, "")
    .replace(/\d{1,2}\s*월\s*\d{1,2}\s*일/g, "")
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

export function parseNaturalSchedules(input: string, base = new Date()): ParsedSchedule[] {
  const chunks = input
    .split(/\n+|(?<=[.!?])\s+|\s*;\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

  const results: ParsedSchedule[] = [];

  for (const chunk of chunks) {
    const dateMatch = chunk.match(/(?:(\d{4})\s*년\s*)?(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
    if (!dateMatch) continue;

    const category = inferCategory(chunk);
    const month = Number(dateMatch[2]);
    const day = Number(dateMatch[3]);
    const year = dateMatch[1] ? Number(dateMatch[1]) : resolveYear(month, day, base);
    const { hour, minute } = inferTime(chunk, category);
    const startsAt = new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();

    const noteMatch = chunk.match(/(?:메모|준비물|참고)\s*[:：]\s*(.+)$/);
    const notes = noteMatch?.[1]?.trim() ?? "";
    let title = cleanTitle(noteMatch ? chunk.slice(0, noteMatch.index) : chunk);

    if (!title) title = category === "deadline" ? "지원 마감" : "일정";

    results.push({
      title,
      startsAt,
      notes,
      reminderMinutes: inferReminder(chunk, category),
      category,
    });
  }

  return results;
}
