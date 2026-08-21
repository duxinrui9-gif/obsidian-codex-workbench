import { clientTimeZone } from "@/lib/vault-profile";

export function hkDate(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: clientTimeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function hkMonth(): string {
  return hkDate().slice(0, 7);
}

export function shiftMonth(month: string, amount: number): string {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, value - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(month: string): string {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
}

export function monthDays(month: string): Array<string | null> {
  const [year, value] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, value - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year, value, 0)).getUTCDate();
  return [...Array<null>(offset), ...Array.from({ length: count }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`)];
}
