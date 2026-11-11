// Kick-off times are shown in US Central time (CST in winter, CDT in summer).
const TZ = "America/Chicago";

export function chicago(iso: string) {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const date = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric" }).format(d);
  return { time: `${get("hour")}:${get("minute")} ${get("dayPeriod")}`, tz: get("timeZoneName"), date };
}

export const chicagoLabel = (iso: string) => {
  const c = chicago(iso);
  return `${c.date}, ${c.time} ${c.tz}`;
};
