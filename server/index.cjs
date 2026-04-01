const express = require("express");
const cors = require("cors");
const fs = require("node:fs");
const path = require("node:path");

const app = express();
const PORT = Number(process.env.PORT || 4000);

const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const STATE_PATH = path.join(DATA_DIR, "game_state.json");

// 추측 가능한 전체 단어 집합: 반드시 vector가 있어야 함
const GUESS_BANK_PATH = path.join(
  ROOT_DIR,
  "data",
  "guess_bank_with_vectors.json",
);

// 정답 후보 집합: word만 있어도 됨
const ANSWER_WHITELIST_PATH = path.join(
  ROOT_DIR,
  "data",
  "answer_whitelist.json",
);

const GAME_TIMEZONE = "Asia/Seoul";

app.use(cors());
app.use(express.json());

function defaultState() {
  return {
    sessions: [],
    leaderboard: [],
    dailyConfig: {},
  };
}

function readState() {
  if (!fs.existsSync(STATE_PATH)) {
    return defaultState();
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_PATH, "utf-8"));
    return {
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      leaderboard: Array.isArray(parsed.leaderboard) ? parsed.leaderboard : [],
      dailyConfig:
        parsed.dailyConfig &&
        typeof parsed.dailyConfig === "object" &&
        !Array.isArray(parsed.dailyConfig)
          ? parsed.dailyConfig
          : {},
    };
  } catch {
    return defaultState();
  }
}

function writeState(state) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf-8");
}

function getCurrentGameDate() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: GAME_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(new Date());
}

function getDailyConfig(state, date) {
  const dailyConfig =
    state.dailyConfig &&
    typeof state.dailyConfig === "object" &&
    !Array.isArray(state.dailyConfig)
      ? state.dailyConfig
      : {};

  const raw = dailyConfig[date];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      version: 0,
    };
  }

  return {
    version: Number.isInteger(raw.version) ? raw.version : 0,
    secretIndexOverride: Number.isInteger(raw.secretIndexOverride)
      ? raw.secretIndexOverride
      : undefined,
  };
}

function getGameVersion(state, date) {
  return getDailyConfig(state, date).version ?? 0;
}

function normalizeWord(value) {
  return String(value || "").trim().replace(/\s+/g, "").toLowerCase();
}

let cachedGuessBank = null;
let cachedAnswerWhitelist = null;

function loadGuessBank() {
  if (cachedGuessBank) return cachedGuessBank;

  if (!fs.existsSync(GUESS_BANK_PATH)) {
    throw new Error(`guess bank file not found: ${GUESS_BANK_PATH}`);
  }

  const raw = JSON.parse(fs.readFileSync(GUESS_BANK_PATH, "utf-8"));
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("invalid guess bank");
  }

  cachedGuessBank = raw
    .filter(
      (item) =>
        item &&
        typeof item.word === "string" &&
        Array.isArray(item.vector) &&
        item.vector.length > 0 &&
        item.vector.every((x) => typeof x === "number" && Number.isFinite(x)),
    )
    .map((item) => ({
      word: item.word.trim(),
      vector: item.vector,
      pca3:
        Array.isArray(item.pca3) &&
        item.pca3.length === 3 &&
        item.pca3.every((x) => typeof x === "number" && Number.isFinite(x))
          ? item.pca3
          : undefined,
    }));

  if (cachedGuessBank.length === 0) {
    throw new Error("no valid entries in guess bank");
  }

  return cachedGuessBank;
}

function loadAnswerWhitelist() {
  if (cachedAnswerWhitelist) return cachedAnswerWhitelist;

  if (!fs.existsSync(ANSWER_WHITELIST_PATH)) {
    throw new Error(`answer whitelist file not found: ${ANSWER_WHITELIST_PATH}`);
  }

  const raw = JSON.parse(fs.readFileSync(ANSWER_WHITELIST_PATH, "utf-8"));
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("invalid answer whitelist");
  }

  const guessBank = loadGuessBank();
  const guessWordSet = new Set(
    guessBank.map((entry) => normalizeWord(entry.word)),
  );

  cachedAnswerWhitelist = raw
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item.word === "string") return item.word.trim();
      return null;
    })
    .filter((word) => typeof word === "string" && word.length > 0)
    .filter((word) => guessWordSet.has(normalizeWord(word)));

  if (cachedAnswerWhitelist.length === 0) {
    throw new Error("no valid entries in answer whitelist");
  }

  return cachedAnswerWhitelist;
}

function dot(a, b) {
  const len = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < len; i += 1) {
    sum += a[i] * b[i];
  }
  return sum;
}

function magnitude(v) {
  return Math.sqrt(v.reduce((sum, value) => sum + value * value, 0));
}

function cosineSimilarity(a, b) {
  const denominator = magnitude(a) * magnitude(b);
  if (!denominator) return 0;
  return dot(a, b) / denominator;
}

function similarityToScore(similarity) {
  const clamped = Math.max(-1, Math.min(1, similarity));
  return Number((((clamped + 1) / 2) * 100).toFixed(1));
}

function seedToIndex(seed, length) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return length > 0 ? hash % length : 0;
}

function getSecretAnswerIndexForDate(state, date, whitelistLength) {
  const daily = getDailyConfig(state, date);

  if (
    Number.isInteger(daily.secretIndexOverride) &&
    daily.secretIndexOverride >= 0 &&
    daily.secretIndexOverride < whitelistLength
  ) {
    return daily.secretIndexOverride;
  }

  return seedToIndex(date, whitelistLength);
}

function getSecretAnswerWordForDate(state, date) {
  const whitelist = loadAnswerWhitelist();
  const answerIndex = getSecretAnswerIndexForDate(
    state,
    date,
    whitelist.length,
  );
  return whitelist[answerIndex];
}

function getRankingInfo(state, date, guessedWord) {
  const guessBank = loadGuessBank();
  const secretAnswerWord = getSecretAnswerWordForDate(state, date);

  const secret = guessBank.find(
    (entry) => normalizeWord(entry.word) === normalizeWord(secretAnswerWord),
  );

  if (!secret) {
    throw new Error(
      `answer whitelist word not found in guess bank: ${secretAnswerWord}`,
    );
  }

  const rankingList = guessBank
    .map((entry) => ({
      word: entry.word,
      similarity: cosineSimilarity(entry.vector, secret.vector),
    }))
    .sort((a, b) => b.similarity - a.similarity);

  const rankingMap = new Map();
  rankingList.forEach((entry, index) => {
    rankingMap.set(normalizeWord(entry.word), {
      rank: index + 1,
      similarity: entry.similarity,
    });
  });

  const normalizedGuess = normalizeWord(guessedWord);
  const matchedEntry = guessBank.find(
    (entry) => normalizeWord(entry.word) === normalizedGuess,
  );
  const info = rankingMap.get(normalizedGuess);

  return {
    matchedEntry,
    info,
    solved: normalizedGuess === normalizeWord(secret.word),
  };
}

function getOrCreateSession(state, date, playerId, nickname) {
  const now = Date.now();
  let session = state.sessions.find(
    (row) => row.date === date && row.playerId === playerId,
  );

  if (!session) {
    session = {
      date,
      playerId,
      nickname,
      startedAt: now,
      updatedAt: now,
    };
    state.sessions.push(session);
  } else {
    session.nickname = nickname;
    session.updatedAt = now;
  }

  return session;
}

function resetSession(state, date, playerId, nickname) {
  const now = Date.now();

  state.sessions = state.sessions.filter(
    (row) => !(row.date === date && row.playerId === playerId),
  );

  state.leaderboard = state.leaderboard.filter(
    (row) => !(row.date === date && row.playerId === playerId),
  );

  const session = {
    date,
    playerId,
    nickname,
    startedAt: now,
    updatedAt: now,
  };

  state.sessions.push(session);
  return session;
}

function isBetter(next, prev) {
  if (next.bestSimilarity !== prev.bestSimilarity) {
    return next.bestSimilarity > prev.bestSimilarity;
  }
  if (next.bestElapsedMs !== prev.bestElapsedMs) {
    return next.bestElapsedMs < prev.bestElapsedMs;
  }
  return false;
}

function upsertLeaderboard(state, row) {
  const index = state.leaderboard.findIndex(
    (item) => item.date === row.date && item.playerId === row.playerId,
  );

  if (index === -1) {
    state.leaderboard.push(row);
    return;
  }

  const prev = state.leaderboard[index];
  if (isBetter(row, prev)) {
    state.leaderboard[index] = row;
  } else {
    state.leaderboard[index] = {
      ...prev,
      nickname: row.nickname,
      updatedAt: Date.now(),
    };
  }
}

app.get("/api/meta", (_req, res) => {
  const state = readState();
  const currentDate = getCurrentGameDate();

  res.json({
    ok: true,
    currentDate,
    timezone: GAME_TIMEZONE,
    gameVersion: getGameVersion(state, currentDate),
  });
});

app.get("/api/leaderboard", (_req, res) => {
  const state = readState();
  const currentDate = getCurrentGameDate();

  const rows = state.leaderboard
    .filter((row) => row.date === currentDate)
    .sort((a, b) => {
      if (b.bestSimilarity !== a.bestSimilarity) {
        return b.bestSimilarity - a.bestSimilarity;
      }
      if (a.bestElapsedMs !== b.bestElapsedMs) {
        return a.bestElapsedMs - b.bestElapsedMs;
      }
      return a.updatedAt - b.updatedAt;
    })
    .map((row, index) => ({
      rank: index + 1,
      nickname: row.nickname,
      bestSimilarity: row.bestSimilarity,
      bestElapsedMs: row.bestElapsedMs,
      updatedAt: row.updatedAt,
    }));

  res.json({
    ok: true,
    currentDate,
    gameVersion: getGameVersion(state, currentDate),
    rows,
  });
});

app.post("/api/start", (req, res) => {
  const { playerId, nickname } = req.body ?? {};

  if (typeof playerId !== "string" || typeof nickname !== "string") {
    return res.status(400).json({ error: "invalid payload" });
  }

  const state = readState();
  const currentDate = getCurrentGameDate();
  const safeNickname = nickname.trim().slice(0, 20) || "익명";
  const session = getOrCreateSession(state, currentDate, playerId, safeNickname);
  writeState(state);

  res.json({
    ok: true,
    currentDate,
    gameVersion: getGameVersion(state, currentDate),
    startedAt: session.startedAt,
  });
});

app.post("/api/reset", (req, res) => {
  const { playerId, nickname } = req.body ?? {};

  if (typeof playerId !== "string" || typeof nickname !== "string") {
    return res.status(400).json({ error: "invalid payload" });
  }

  const state = readState();
  const currentDate = getCurrentGameDate();
  const safeNickname = nickname.trim().slice(0, 20) || "익명";
  const session = resetSession(state, currentDate, playerId, safeNickname);
  writeState(state);

  res.json({
    ok: true,
    currentDate,
    gameVersion: getGameVersion(state, currentDate),
    startedAt: session.startedAt,
  });
});

app.post("/api/guess", (req, res) => {
  const { playerId, nickname, word } = req.body ?? {};

  if (
    typeof playerId !== "string" ||
    typeof nickname !== "string" ||
    typeof word !== "string"
  ) {
    return res.status(400).json({ error: "invalid payload" });
  }

  const normalizedWord = normalizeWord(word);
  if (!normalizedWord) {
    return res.status(400).json({ error: "단어를 입력해 주세요." });
  }

  try {
    const state = readState();
    const currentDate = getCurrentGameDate();
    const safeNickname = nickname.trim().slice(0, 20) || "익명";

    const rankingInfo = getRankingInfo(state, currentDate, normalizedWord);
    if (!rankingInfo.matchedEntry || !rankingInfo.info) {
      return res
        .status(404)
        .json({ error: "현재 단어 집합에 없는 단어입니다." });
    }

    const session = getOrCreateSession(
      state,
      currentDate,
      playerId,
      safeNickname,
    );
    const elapsedMs = Date.now() - session.startedAt;

    upsertLeaderboard(state, {
      date: currentDate,
      playerId,
      nickname: safeNickname,
      bestSimilarity: rankingInfo.info.similarity,
      bestElapsedMs: elapsedMs,
      updatedAt: Date.now(),
    });

    writeState(state);

    return res.json({
      ok: true,
      currentDate,
      gameVersion: getGameVersion(state, currentDate),
      word: rankingInfo.matchedEntry.word,
      score: similarityToScore(rankingInfo.info.similarity),
      rank: rankingInfo.info.rank,
      similarity: rankingInfo.info.similarity,
      solved: rankingInfo.solved,
      elapsedMs,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "server error",
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`Using timezone: ${GAME_TIMEZONE}`);
  console.log(`Using state file: ${STATE_PATH}`);
  console.log(`Using guess bank: ${GUESS_BANK_PATH}`);
  console.log(`Using answer whitelist: ${ANSWER_WHITELIST_PATH}`);
});