export function normalizeWord(value: string) {
  return value.trim().replace(/\s+/g, "").toLowerCase();
}

export function getTodaySeed() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getPlayerId() {
  if (typeof window === "undefined") return "server";

  const key = "semantic-player-id";
  let value = localStorage.getItem(key);

  if (!value) {
    value =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    localStorage.setItem(key, value);
  }

  return value;
}

export function formatOrdinal(rank: number) {
  return `${rank}위`;
}

export function formatElapsed(ms: number) {
  const total = Math.floor(ms / 1000);
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${min}분 ${String(sec).padStart(2, "0")}초`;
}

export function levelLabel(score: number) {
  if (score >= 97) return "거의 정답";
  if (score >= 90) return "매우 가까움";
  if (score >= 80) return "가까움";
  if (score >= 65) return "어느 정도 관련";
  if (score >= 50) return "조금 관련";
  return "멀리 있음";
}

export function scoreBarColor(score: number) {
  if (score >= 95) return "#ef4444";
  if (score >= 85) return "#f97316";
  if (score >= 75) return "#eab308";
  if (score >= 60) return "#84cc16";
  if (score >= 45) return "#0ea5e9";
  return "#94a3b8";
}