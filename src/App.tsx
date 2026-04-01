import { useEffect, useMemo, useState } from "react";
import GuessInput from "./components/GuessInput";
import GuessHistory from "./components/GuessHistory";
import Leaderboard from "./components/Leaderboard";
import RuleCard from "./components/RuleCard";
import StatusCards from "./components/StatusCards";
import VectorViewer from "./components/VectorViewer";
import {
  fetchGameMeta,
  fetchLeaderboard,
  resetSessionApi,
  startSessionApi,
  submitGuessApi,
} from "./lib/api";
import {
  formatOrdinal,
  getPlayerId,
  levelLabel,
  normalizeWord,
} from "./lib/format";
import type {
  GuessApiResponse,
  GuessResult,
  LeaderboardRow,
  WordEntry,
} from "./types/game";

const STORAGE_KEY = "semantic-guess-game-state-v7";
const WORD_BANK_URL =
  "/guess_bank_with_vectors.json";

const FALLBACK_WORD_BANK: WordEntry[] = [
  { word: "강아지", category: "동물", vector: [0.93, 0.88, 0.12, 0.08, 0.17, 0.64] },
  { word: "고양이", category: "동물", vector: [0.91, 0.82, 0.15, 0.11, 0.14, 0.61] },
  { word: "호랑이", category: "동물", vector: [0.84, 0.69, 0.18, 0.19, 0.29, 0.42] },
  { word: "사자", category: "동물", vector: [0.82, 0.66, 0.17, 0.2, 0.31, 0.39] },
  { word: "사과", category: "과일", vector: [0.18, 0.16, 0.94, 0.82, 0.23, 0.14] },
  { word: "배", category: "과일", vector: [0.16, 0.18, 0.91, 0.84, 0.21, 0.12] },
  { word: "포도", category: "과일", vector: [0.19, 0.21, 0.88, 0.8, 0.25, 0.11] },
  { word: "자동차", category: "탈것", vector: [0.25, 0.87, 0.24, 0.11, 0.91, 0.29] },
  { word: "버스", category: "탈것", vector: [0.22, 0.83, 0.19, 0.09, 0.95, 0.31] },
  { word: "학교", category: "학습", vector: [0.64, 0.17, 0.21, 0.89, 0.13, 0.17] },
  { word: "수학", category: "학습", vector: [0.57, 0.13, 0.14, 0.97, 0.11, 0.12] },
  { word: "라면", category: "음식", vector: [0.24, 0.23, 0.56, 0.17, 0.16, 0.1] },
];

function getHistoryStorageKey(
  gameDate: string,
  gameVersion: number,
  playerId: string,
) {
  return `${STORAGE_KEY}-${gameDate}-v${gameVersion}-${playerId}`;
}

function validateWordBank(
  data: unknown,
): { ok: true; data: WordEntry[] } | { ok: false; reason: string } {
  if (!Array.isArray(data)) {
    return { ok: false, reason: "JSON 최상위 구조가 배열이 아닙니다." };
  }

  const seen = new Set<string>();
  const cleaned: WordEntry[] = [];

  for (const item of data) {
    if (typeof item !== "object" || item === null) continue;

    const maybeWord = (item as { word?: unknown }).word;
    const maybeCategory = (item as { category?: unknown }).category;
    const maybeVector = (item as { vector?: unknown }).vector;
    const maybePca3 = (item as { pca3?: unknown }).pca3;

    if (typeof maybeWord !== "string") continue;
    if (typeof maybeCategory !== "string") continue;
    if (!Array.isArray(maybeVector) || maybeVector.length === 0) continue;
    if (!maybeVector.every((value) => typeof value === "number" && Number.isFinite(value))) {
      continue;
    }

    const parsedPca3 =
      Array.isArray(maybePca3) &&
      maybePca3.length === 3 &&
      maybePca3.every((value) => typeof value === "number" && Number.isFinite(value))
        ? ([maybePca3[0], maybePca3[1], maybePca3[2]] as [number, number, number])
        : undefined;

    const word = normalizeWord(maybeWord);
    if (!word || seen.has(word)) continue;

    seen.add(word);
    cleaned.push({
      word: maybeWord.trim(),
      category: maybeCategory.trim(),
      vector: maybeVector,
      pca3: parsedPca3,
    });
  }

  if (cleaned.length === 0) {
    return { ok: false, reason: "유효한 단어 데이터가 없습니다." };
  }

  return { ok: true, data: cleaned };
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 50%, #eef2ff 100%)",
    color: "#0f172a",
    padding: 16,
    boxSizing: "border-box" as const,
    fontFamily: "Arial, sans-serif",
  },
  container: {
    maxWidth: 1200,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
  },
  card: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    boxShadow: "0 12px 28px rgba(15, 23, 42, 0.07)",
    padding: 18,
  },
  badgeRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap" as const,
    marginBottom: 12,
  },
  badge: {
    display: "inline-block",
    padding: "6px 12px",
    borderRadius: 999,
    background: "#dbeafe",
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: 700,
  },
  badgeSecondary: {
    display: "inline-block",
    padding: "6px 12px",
    borderRadius: 999,
    background: "#ede9fe",
    color: "#6d28d9",
    fontSize: 12,
    fontWeight: 700,
  },
  title: {
    margin: "0 0 10px 0",
    fontWeight: 800,
    lineHeight: 1.2,
  },
  description: {
    fontSize: 14,
    lineHeight: 1.6,
    color: "#475569",
    margin: 0,
  },
  warning: {
    borderRadius: 14,
    border: "1px solid #fdba74",
    background: "#fff7ed",
    padding: 14,
    fontSize: 14,
    lineHeight: 1.5,
    color: "#9a3412",
    marginTop: 16,
  },
  tabButton: {
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    padding: "10px 16px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  tabButtonActive: {
    borderRadius: 14,
    border: "1px solid #111827",
    background: "#111827",
    color: "#ffffff",
    padding: "10px 16px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
};

export default function App() {
  const playerId = useMemo(() => getPlayerId(), []);
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200,
  );

  const isTablet = windowWidth < 960;
  const isMobile = windowWidth < 640;

  const [activeTab, setActiveTab] = useState<"history" | "scatter">("history");
  const [wordBank, setWordBank] = useState<WordEntry[]>(FALLBACK_WORD_BANK);
  const [isLoadingWordBank, setIsLoadingWordBank] = useState(true);
  const [wordBankError, setWordBankError] = useState<string | null>(null);

  const [input, setInput] = useState("");
  const [message, setMessage] = useState("단어를 입력해 정답과의 유사도를 확인해 보세요.");
  const [history, setHistory] = useState<GuessResult[]>([]);
  const [isSolved, setIsSolved] = useState(false);

  const [nickname, setNickname] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("semantic-nickname") ?? "" : "",
  );

  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [gameDate, setGameDate] = useState("");
  const [gameVersion, setGameVersion] = useState<number | null>(null);
  const [gameTimezone, setGameTimezone] = useState("");

  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("semantic-nickname", nickname);
  }, [nickname]);

  useEffect(() => {
    let cancelled = false;

    async function loadMeta() {
      try {
        const meta = await fetchGameMeta();
        if (!cancelled) {
          setGameDate(meta.currentDate);
          setGameTimezone(meta.timezone);
          setGameVersion(
            typeof meta.gameVersion === "number" ? meta.gameVersion : 0,
          );
        }
      } catch {
        if (!cancelled) {
          setMessage("게임 날짜 정보를 불러오지 못했습니다.");
        }
      }
    }

    void loadMeta();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadWordBank() {
      setIsLoadingWordBank(true);

      try {
        const response = await fetch(WORD_BANK_URL, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`데이터 파일을 불러오지 못했습니다. (${response.status})`);
        }

        const raw = await response.json();
        const validated = validateWordBank(raw);
        if (!validated.ok) {
          throw new Error(validated.reason);
        }

        if (!cancelled) {
          setWordBank(validated.data);
          setWordBankError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setWordBank(FALLBACK_WORD_BANK);
          setWordBankError(
            error instanceof Error ? error.message : "알 수 없는 데이터 로드 오류",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingWordBank(false);
        }
      }
    }

    void loadWordBank();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (
      !gameDate ||
      gameVersion === null ||
      !playerId ||
      typeof window === "undefined"
    ) {
      return;
    }

    const raw = localStorage.getItem(
      getHistoryStorageKey(gameDate, gameVersion, playerId),
    );

    if (!raw) {
      setHistory([]);
      setIsSolved(false);
      return;
    }

    try {
      const parsed = JSON.parse(raw);

      if (Array.isArray(parsed.history)) {
        const safeHistory = parsed.history.filter(
          (item: unknown): item is GuessResult =>
            typeof item === "object" &&
            item !== null &&
            typeof (item as GuessResult).word === "string" &&
            typeof (item as GuessResult).score === "number" &&
            typeof (item as GuessResult).rank === "number" &&
            typeof (item as GuessResult).similarity === "number" &&
            typeof (item as GuessResult).guessedAt === "number",
        );

        setHistory(safeHistory);
        setIsSolved(Boolean(parsed.isSolved));
      } else {
        setHistory([]);
        setIsSolved(false);
      }
    } catch {
      setHistory([]);
      setIsSolved(false);
    }
  }, [gameDate, gameVersion, playerId]);

  useEffect(() => {
    if (
      !gameDate ||
      gameVersion === null ||
      !playerId ||
      typeof window === "undefined"
    ) {
      return;
    }

    localStorage.setItem(
      getHistoryStorageKey(gameDate, gameVersion, playerId),
      JSON.stringify({
        history,
        isSolved,
      }),
    );
  }, [gameDate, gameVersion, playerId, history, isSolved]);

  useEffect(() => {
    if (wordBankError) {
      setMessage(
        `외부 단어 데이터 로드 실패: ${wordBankError}. 현재는 데모용 내장 단어 집합으로 동작합니다.`,
      );
    }
  }, [wordBankError]);

  async function loadLeaderboardSafe() {
    try {
      const data = await fetchLeaderboard();
      setLeaderboard(data.rows);

      if (data.currentDate) {
        setGameDate(data.currentDate);
      }

      if (typeof data.gameVersion === "number") {
        setGameVersion(data.gameVersion);
      }
    } catch {
      // ignore
    }
  }

  async function startSessionSafe() {
    try {
      const data = await startSessionApi({
        playerId,
        nickname: nickname.trim() || "익명",
      });

      if (typeof data?.currentDate === "string") {
        setGameDate(data.currentDate);
      }

      if (typeof data?.gameVersion === "number") {
        setGameVersion(data.gameVersion);
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (!gameDate) return;
    void loadLeaderboardSafe();

    const timer = window.setInterval(() => {
      void loadLeaderboardSafe();
    }, 10000);

    return () => window.clearInterval(timer);
  }, [gameDate]);

  useEffect(() => {
    if (!gameDate) return;
    void startSessionSafe();
  }, [gameDate, playerId, nickname]);

  const guessedWordSet = useMemo(
    () => new Set(history.map((item) => normalizeWord(item.word))),
    [history],
  );

  const sortedHistory = useMemo(
    () => [...history].sort((a, b) => b.score - a.score || a.guessedAt - b.guessedAt),
    [history],
  );

  const topGuess = sortedHistory[0] ?? null;

  async function submitGuess() {
    if (isLoadingWordBank) {
      setMessage("단어 데이터를 불러오는 중입니다.");
      return;
    }

    const normalized = normalizeWord(input);
    if (!normalized) {
      setMessage("단어를 입력해 주세요.");
      return;
    }

    if (guessedWordSet.has(normalized)) {
      setMessage("이미 제출한 단어입니다.");
      return;
    }

    try {
      const resultData = (await submitGuessApi({
        playerId,
        nickname: nickname.trim() || "익명",
        word: normalized,
      })) as GuessApiResponse & { currentDate: string; gameVersion: number };

      if (resultData.currentDate) {
        setGameDate(resultData.currentDate);
      }

      if (typeof resultData.gameVersion === "number") {
        setGameVersion(resultData.gameVersion);
      }

      const result: GuessResult = {
        word: resultData.word,
        score: resultData.score,
        rank: resultData.rank,
        similarity: resultData.similarity,
        guessedAt: Date.now(),
        elapsedMs: resultData.elapsedMs,
      };

      setHistory((prev) => [...prev, result]);
      setInput("");
      setIsSolved(resultData.solved);
      setMessage(
        resultData.solved
          ? "정답입니다."
          : `${resultData.word}: ${resultData.score}점 / ${formatOrdinal(resultData.rank)} / ${levelLabel(resultData.score)}`,
      );

      void loadLeaderboardSafe();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "서버와 통신하지 못했습니다.",
      );
    }
  }

  async function resetToday() {
    setHistory([]);
    setIsSolved(false);
    setInput("");
    setMessage("기록을 초기화했습니다.");

    if (
      gameDate &&
      gameVersion !== null &&
      playerId &&
      typeof window !== "undefined"
    ) {
      localStorage.removeItem(
        getHistoryStorageKey(gameDate, gameVersion, playerId),
      );
    }

    try {
      await resetSessionApi({
        playerId,
        nickname: nickname.trim() || "익명",
      });

      await loadLeaderboardSafe();
    } catch {
      // ignore
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isTablet
              ? "1fr"
              : "minmax(0, 1.4fr) minmax(320px, 0.8fr)",
            gap: 16,
          }}
        >
          <div style={styles.card}>
            <div style={styles.badgeRow}>
              <span style={styles.badge}>서버 채점</span>
              <span style={styles.badgeSecondary}>실시간 랭킹</span>
            </div>

            <h1 style={{ ...styles.title, fontSize: isMobile ? 26 : 32 }}>
              단어 유사도 추측 게임
            </h1>

            <p style={styles.description}>
              점수와 시간은 서버가 직접 계산합니다. 랭킹은 유사도 우선, 시간 차순입니다.
            </p>
            <p style={{ ...styles.description, marginTop: 6 }}>
              기준 날짜: {gameDate || "불러오는 중"}{" "}
              {gameTimezone ? `(${gameTimezone})` : ""}
            </p>

            <GuessInput
              input={input}
              setInput={setInput}
              nickname={nickname}
              setNickname={setNickname}
              onSubmit={submitGuess}
              onReset={resetToday}
              isLoading={isLoadingWordBank}
              isMobile={isMobile}
              isTablet={isTablet}
              message={message}
            />

            {wordBankError && (
              <div style={styles.warning}>
                외부 데이터 로드 실패: {wordBankError}. 현재는 데모용 내장 단어 집합으로
                실행 중입니다.
              </div>
            )}

            <StatusCards
              topGuess={topGuess}
              historyLength={history.length}
              isSolved={isSolved}
              isLoadingWordBank={isLoadingWordBank}
              isMobile={isMobile}
              isTablet={isTablet}
            />
          </div>

          <RuleCard
            isLoadingWordBank={isLoadingWordBank}
            wordCount={wordBank.length}
          />
        </div>

        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              style={activeTab === "history" ? styles.tabButtonActive : styles.tabButton}
              onClick={() => setActiveTab("history")}
            >
              제출 기록
            </button>
            <button
              type="button"
              style={activeTab === "scatter" ? styles.tabButtonActive : styles.tabButton}
              onClick={() => setActiveTab("scatter")}
            >
              3D 벡터 시각화
            </button>
          </div>

          {activeTab === "history" ? (
            <GuessHistory sortedHistory={sortedHistory} isMobile={isMobile} />
          ) : (
            <div style={styles.card}>
              <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: 22 }}>
                3D 벡터 시각화
              </h2>
              <VectorViewer history={history} wordBank={wordBank} />
            </div>
          )}
        </div>

        <Leaderboard leaderboard={leaderboard} />
      </div>
    </div>
  );
}