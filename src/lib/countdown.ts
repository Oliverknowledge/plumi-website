import { launchDate } from "@/config/site";
export function countdownAt(now: number) {
  const remaining = Math.max(0, new Date(launchDate).getTime() - now);
  return { ended: remaining === 0, days: Math.floor(remaining / 86400000), hours: Math.floor(remaining / 3600000) % 24, minutes: Math.floor(remaining / 60000) % 60 };
}
