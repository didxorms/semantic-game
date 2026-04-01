type GuessApiResponse = {
  ok: true;
  currentDate: string;
  gameVersion: number;
  word: string;
  score: number;
  rank: number;
  similarity: number;
  solved: boolean;
  elapsedMs: number;
};

type LeaderboardRow = {
  rank: number;
  nickname: string;
  bestSimilarity: number;
  bestElapsedMs: number;
  updatedAt: number;
};

type GameMetaResponse = {
  ok: true;
  currentDate: string;
  timezone: string;
  gameVersion: number;
};

type LeaderboardResponse = {
  ok: true;
  currentDate: string;
  gameVersion: number;
  rows: LeaderboardRow[];
};

const API_BASE =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:4000`
    : "http://localhost:4000";

async function parseJsonSafe(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function extractErrorMessage(data: unknown, fallback: string) {
  if (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof data.error === "string"
  ) {
    return data.error;
  }
  return fallback;
}

export async function fetchGameMeta(): Promise<GameMetaResponse> {
  const response = await fetch(`${API_BASE}/api/meta`);
  const data = await parseJsonSafe(response);

  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "게임 정보를 불러오지 못했습니다."));
  }

  return data as GameMetaResponse;
}

export async function fetchLeaderboard(): Promise<LeaderboardResponse> {
  const response = await fetch(`${API_BASE}/api/leaderboard`);
  const data = await parseJsonSafe(response);

  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "랭킹을 불러오지 못했습니다."));
  }

  return {
    ok: true,
    currentDate:
      typeof data?.currentDate === "string" ? data.currentDate : "",
    gameVersion:
      typeof data?.gameVersion === "number" ? data.gameVersion : 0,
    rows: Array.isArray(data?.rows) ? (data.rows as LeaderboardRow[]) : [],
  };
}

export async function startSessionApi(params: {
  playerId: string;
  nickname: string;
}) {
  const response = await fetch(`${API_BASE}/api/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  const data = await parseJsonSafe(response);

  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "세션 시작에 실패했습니다."));
  }

  return data;
}

export async function resetSessionApi(params: {
  playerId: string;
  nickname: string;
}) {
  const response = await fetch(`${API_BASE}/api/reset`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  const data = await parseJsonSafe(response);

  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "초기화에 실패했습니다."));
  }

  return data;
}

export async function submitGuessApi(params: {
  playerId: string;
  nickname: string;
  word: string;
}): Promise<GuessApiResponse> {
  const response = await fetch(`${API_BASE}/api/guess`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  const data = await parseJsonSafe(response);

  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "추측 처리 중 오류가 발생했습니다."));
  }

  return data as GuessApiResponse;
}

export type { GuessApiResponse, LeaderboardRow, GameMetaResponse, LeaderboardResponse };