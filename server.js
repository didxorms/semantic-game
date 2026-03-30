const express = require("express");
const cors = require("cors");
const fs = require("node:fs");
const path = require("node:path");

const app = express();
const PORT = 4000;

const STATE_PATH = path.resolve("game_state.json");
const WORD_BANK_PATH = path.resolve("public", "word_bank_stem_with_vectors_300d_with_pca3.json");

app.use(cors());
app.use(express.json());

function defaultState() {
  return {
    sessions: [],
    leaderboard: [],
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
    };
  } catch {
    return defaultState();
  }
}

function writeState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf-8");
}

let cachedWordBank = null;

function loadWordBank() {
  if (cachedWordBank) return cachedWordBank;

  if (!fs.existsSync(WORD_BANK_PATH)) {
    throw new Error(`word bank file not found: ${WORD_BANK_PATH}`);
  }

  const raw = JSON.parse(fs.readFileSync(WORD_BANK_PATH, "utf-8"));
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("invalid word bank");
  }

  cachedWordBank = raw
    .filter(
      (item) =>
        item &&
        typeof item.word === "string" &&
        typeof item.category === "string" &&
        Array.isArray(item.vector) &&
        item.vector.length > 0 &&
        item.vector.every((x) => typeof x === "number" && Number.isFinite(x)),
    )
    .map((item) => ({
      word: item.word.trim(),
      category: item.category.trim(),
      vector: item.vector,
      pca3: Array.isArray(item.pca3) && item.pca3.length === 3 ? item.pca3 : undefined,
    }));

  if (cachedWordBank.length === 0) {
    throw new Error("no valid entries in word bank");
  }

  return cachedWordBank;
}

function normalizeWord(value) {
  return String(value || "").trim().replace(/\s+/g, "").toLowerCase();
}

function dot(a, b) {
  const len = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < len; i += 1) sum += a[i] * b[i];
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

function getRankingInfo(date, guessedWord) {
  const wordBank = loadWordBank();
  const secretIndex = seedToIndex(date, wordBank.length);
  const secret = wordBank[secretIndex];

  const rankingList = wordBank
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
  const matchedEntry = wordBank.find((entry) => normalizeWord(entry.word) === normalizedGuess);
  const info = rankingMap.get(normalizedGuess);

  return {
    matchedEntry,
    info,
    solved: normalizedGuess === normalizeWord(secret.word),
  };
}

function getOrCreateSession(state, date, playerId, nickname) {
  const now = Date.now();
  let session = state.sessions.find((row) => row.date === date && row.playerId === playerId);

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

app.get("/api/leaderboard", (req, res) => {
  const date = String(req.query.date || "");
  if (!date) {
    return res.status(400).json({ error: "date is required" });
  }

  const state = readState();
  const rows = state.leaderboard
    .filter((row) => row.date === date)
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

  res.json(rows);
});

app.post("/api/start", (req, res) => {
  const { date, playerId, nickname } = req.body ?? {};

  if (
    typeof date !== "string" ||
    typeof playerId !== "string" ||
    typeof nickname !== "string"
  ) {
    return res.status(400).json({ error: "invalid payload" });
  }

  const safeNickname = nickname.trim().slice(0, 20) || "익명";
  const state = readState();
  const session = getOrCreateSession(state, date, playerId, safeNickname);
  writeState(state);

  res.json({
    ok: true,
    startedAt: session.startedAt,
  });
});

app.post("/api/reset", (req, res) => {
  const { date, playerId, nickname } = req.body ?? {};

  if (
    typeof date !== "string" ||
    typeof playerId !== "string" ||
    typeof nickname !== "string"
  ) {
    return res.status(400).json({ error: "invalid payload" });
  }

  const safeNickname = nickname.trim().slice(0, 20) || "익명";
  const state = readState();
  const session = resetSession(state, date, playerId, safeNickname);
  writeState(state);

  res.json({
    ok: true,
    startedAt: session.startedAt,
  });
});

app.post("/api/guess", (req, res) => {
  const { date, playerId, nickname, word } = req.body ?? {};

  if (
    typeof date !== "string" ||
    typeof playerId !== "string" ||
    typeof nickname !== "string" ||
    typeof word !== "string"
  ) {
    return res.status(400).json({ error: "invalid payload" });
  }

  const safeNickname = nickname.trim().slice(0, 20) || "익명";
  const normalizedWord = normalizeWord(word);

  if (!normalizedWord) {
    return res.status(400).json({ error: "단어를 입력해 주세요." });
  }

  let rankingInfo;
  try {
    rankingInfo = getRankingInfo(date, normalizedWord);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "server error" });
  }

  if (!rankingInfo.matchedEntry || !rankingInfo.info) {
    return res.status(404).json({ error: "현재 단어 집합에 없는 단어입니다." });
  }

  const state = readState();
  const session = getOrCreateSession(state, date, playerId, safeNickname);
  const elapsedMs = Date.now() - session.startedAt;

  upsertLeaderboard(state, {
    date,
    playerId,
    nickname: safeNickname,
    bestSimilarity: rankingInfo.info.similarity,
    bestElapsedMs: elapsedMs,
    updatedAt: Date.now(),
  });

  writeState(state);

  res.json({
    ok: true,
    word: rankingInfo.matchedEntry.word,
    score: similarityToScore(rankingInfo.info.similarity),
    rank: rankingInfo.info.rank,
    similarity: rankingInfo.info.similarity,
    solved: rankingInfo.solved,
    elapsedMs,
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});