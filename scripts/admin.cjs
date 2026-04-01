const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const STATE_PATH = path.join(DATA_DIR, "game_state.json");

// 추측 가능한 전체 단어 집합: vector 필요
const GUESS_BANK_PATH = path.join(
  ROOT_DIR,
  "data",
  "guess_bank_with_vectors.json",
);

// 정답 후보 집합: word만 있으면 됨
const ANSWER_WHITELIST_PATH = path.join(
  ROOT_DIR,
  "data",
  "answer_whitelist.json",
);

const GAME_TIMEZONE = "Asia/Seoul";

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

function normalizeWord(value) {
  return String(value || "").trim().replace(/\s+/g, "").toLowerCase();
}

function seedToIndex(seed, length) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return length > 0 ? hash % length : 0;
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

function setDailyConfig(state, date, patch) {
  if (
    !state.dailyConfig ||
    typeof state.dailyConfig !== "object" ||
    Array.isArray(state.dailyConfig)
  ) {
    state.dailyConfig = {};
  }

  const prev = getDailyConfig(state, date);
  state.dailyConfig[date] = {
    ...prev,
    ...patch,
  };
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

function clearTodaySessionsAndLeaderboard(state, date) {
  const prevSessions = state.sessions.length;
  const prevLeaderboard = state.leaderboard.length;

  state.sessions = state.sessions.filter((row) => row.date !== date);
  state.leaderboard = state.leaderboard.filter((row) => row.date !== date);

  return {
    removedSessions: prevSessions - state.sessions.length,
    removedLeaderboard: prevLeaderboard - state.leaderboard.length,
  };
}

function rerollToday(state) {
  const date = getCurrentGameDate();
  const whitelist = loadAnswerWhitelist();

  const currentIndex = getSecretAnswerIndexForDate(
    state,
    date,
    whitelist.length,
  );

  let nextIndex = currentIndex;
  if (whitelist.length > 1) {
    while (nextIndex === currentIndex) {
      nextIndex = Math.floor(Math.random() * whitelist.length);
    }
  }

  const currentConfig = getDailyConfig(state, date);

  setDailyConfig(state, date, {
    secretIndexOverride: nextIndex,
    version: (currentConfig.version ?? 0) + 1,
  });

  const cleared = clearTodaySessionsAndLeaderboard(state, date);

  writeState(state);

  return {
    date,
    previousIndex: currentIndex,
    previousWord: whitelist[currentIndex],
    nextIndex,
    nextWord: whitelist[nextIndex],
    version: getDailyConfig(state, date).version,
    ...cleared,
  };
}

function resetTodayLeaderboard(state) {
  const date = getCurrentGameDate();
  const before = state.leaderboard.length;

  state.leaderboard = state.leaderboard.filter((row) => row.date !== date);
  writeState(state);

  return {
    date,
    removedLeaderboard: before - state.leaderboard.length,
  };
}

function resetTodayNicknames(state) {
  const date = getCurrentGameDate();
  let changedSessions = 0;
  let changedLeaderboard = 0;

  state.sessions = state.sessions.map((row) => {
    if (row.date !== date) return row;
    if (row.nickname !== "익명") changedSessions += 1;
    return { ...row, nickname: "익명" };
  });

  state.leaderboard = state.leaderboard.map((row) => {
    if (row.date !== date) return row;
    if (row.nickname !== "익명") changedLeaderboard += 1;
    return { ...row, nickname: "익명" };
  });

  writeState(state);

  return {
    date,
    changedSessions,
    changedLeaderboard,
  };
}

function showTodayAnswer(state) {
  const date = getCurrentGameDate();
  const whitelist = loadAnswerWhitelist();
  const daily = getDailyConfig(state, date);
  const answerIndex = getSecretAnswerIndexForDate(
    state,
    date,
    whitelist.length,
  );
  const answerWord = whitelist[answerIndex];

  return {
    date,
    answerIndex,
    answerWord,
    usedOverride:
      Number.isInteger(daily.secretIndexOverride) &&
      daily.secretIndexOverride === answerIndex,
    version: daily.version ?? 0,
  };
}

function printHelp() {
  console.log(`
사용법:
  node scripts/admin.cjs reroll
  node scripts/admin.cjs reset-leaderboard
  node scripts/admin.cjs reset-nicknames
  node scripts/admin.cjs show-answer

설명:
  reroll             오늘의 정답을 새로 뽑고, 오늘 세션/리더보드를 초기화합니다.
  reset-leaderboard  오늘 리더보드만 초기화합니다.
  reset-nicknames    오늘 세션/리더보드의 닉네임을 모두 "익명"으로 바꿉니다.
  show-answer        오늘의 정답 단어를 터미널에 출력합니다.
`);
}

function main() {
  const command = process.argv[2];
  const state = readState();

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "reroll") {
    const result = rerollToday(state);
    console.log("[reroll 완료]");
    console.log(`date: ${result.date}`);
    console.log(`previousIndex: ${result.previousIndex}`);
    console.log(`previousWord: ${result.previousWord}`);
    console.log(`nextIndex: ${result.nextIndex}`);
    console.log(`nextWord: ${result.nextWord}`);
    console.log(`gameVersion: ${result.version}`);
    console.log(`removedSessions: ${result.removedSessions}`);
    console.log(`removedLeaderboard: ${result.removedLeaderboard}`);
    return;
  }

  if (command === "reset-leaderboard") {
    const result = resetTodayLeaderboard(state);
    console.log("[리더보드 초기화 완료]");
    console.log(`date: ${result.date}`);
    console.log(`removedLeaderboard: ${result.removedLeaderboard}`);
    return;
  }

  if (command === "reset-nicknames") {
    const result = resetTodayNicknames(state);
    console.log("[닉네임 초기화 완료]");
    console.log(`date: ${result.date}`);
    console.log(`changedSessions: ${result.changedSessions}`);
    console.log(`changedLeaderboard: ${result.changedLeaderboard}`);
    return;
  }

  if (command === "show-answer") {
    const result = showTodayAnswer(state);
    console.log("[오늘의 정답]");
    console.log(`date: ${result.date}`);
    console.log(`answerIndex: ${result.answerIndex}`);
    console.log(`answerWord: ${result.answerWord}`);
    console.log(`usedOverride: ${result.usedOverride}`);
    console.log(`gameVersion: ${result.version}`);
    return;
  }

  console.error(`알 수 없는 명령어: ${command}`);
  printHelp();
  process.exitCode = 1;
}

main();