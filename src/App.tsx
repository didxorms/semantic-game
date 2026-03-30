import React, { useEffect, useMemo, useRef, useState } from "react";

type WordEntry = {
  word: string;
  vector: number[];
  category: string;
  pca3?: [number, number, number];
};

type GuessResult = {
  word: string;
  score: number;
  rank: number;
  similarity: number;
  guessedAt: number;
  elapsedMs?: number;
};

type Vec3 = [number, number, number];

type ProjectedPoint = {
  x: number;
  y: number;
  scale: number;
  depth: number;
};

type LeaderboardRow = {
  rank: number;
  nickname: string;
  bestSimilarity: number;
  bestElapsedMs: number;
  updatedAt: number;
};

type GuessApiResponse = {
  ok: true;
  word: string;
  score: number;
  rank: number;
  similarity: number;
  solved: boolean;
  elapsedMs: number;
};

const STORAGE_KEY = "semantic-guess-game-state-v7";
const VIEW_SIZE = 560;
const VIEW_CENTER = VIEW_SIZE / 2;
const AXIS_LENGTH = 150;
const WORD_BANK_URL = "/word_bank_stem_boosted_plus_freq_nouns_with_vectors_300d_with_umap.json";

const API_BASE =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:4000`
    : "http://localhost:4000";

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

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 50%, #eef2ff 100%)",
    color: "#0f172a",
    padding: 16,
    boxSizing: "border-box",
    fontFamily: "Arial, sans-serif",
  },
  container: {
    maxWidth: 1200,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
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
    flexWrap: "wrap",
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
  input: {
    width: "100%",
    height: 48,
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    padding: "0 14px",
    fontSize: 16,
    boxSizing: "border-box",
    outline: "none",
    background: "#ffffff",
    color: "#0f172a",
    boxShadow: "inset 0 1px 2px rgba(15, 23, 42, 0.04)",
  },
  button: {
    height: 48,
    borderRadius: 14,
    border: "1px solid #111827",
    background: "#111827",
    color: "#ffffff",
    padding: "0 18px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  buttonSecondary: {
    height: 48,
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#f1f5f9",
    color: "#0f172a",
    padding: "0 18px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  buttonSmall: {
    height: 36,
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    padding: "0 12px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
  alert: {
    marginTop: 16,
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    padding: 14,
    fontSize: 14,
    lineHeight: 1.5,
    color: "#0f172a",
  },
  warning: {
    borderRadius: 14,
    border: "1px solid #fdba74",
    background: "#fff7ed",
    padding: 14,
    fontSize: 14,
    lineHeight: 1.5,
    color: "#9a3412",
    marginBottom: 16,
  },
  statCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 16,
    background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  },
  statLabel: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 800,
    marginBottom: 6,
    color: "#0f172a",
  },
  statSub: {
    fontSize: 13,
    color: "#64748b",
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
  emptyBox: {
    borderRadius: 16,
    border: "1px dashed #cbd5e1",
    padding: 32,
    textAlign: "center",
    color: "#64748b",
    fontSize: 14,
  },
  historyLabelRow: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  wordPill: {
    display: "inline-block",
    padding: "6px 12px",
    borderRadius: 999,
    background: "#eef2ff",
    color: "#3730a3",
    fontSize: 13,
    fontWeight: 700,
  },
  meterTrack: {
    width: "100%",
    height: 8,
    borderRadius: 999,
    background: "#e2e8f0",
    overflow: "hidden",
    marginTop: 4,
  },
  sideText: {
    fontSize: 14,
    lineHeight: 1.6,
    color: "#475569",
    margin: "0 0 8px 0",
  },
  svgWrap: {
    overflow: "hidden",
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)",
  },
  svgToolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    borderBottom: "1px solid #e2e8f0",
    padding: "12px 16px",
    fontSize: 14,
    color: "#475569",
    flexWrap: "wrap",
  },
  svg: {
    width: "100%",
    height: 420,
    display: "block",
    background: "radial-gradient(circle at center, rgba(148,163,184,0.12), transparent 60%)",
    userSelect: "none",
    WebkitUserSelect: "none",
    msUserSelect: "none",
    touchAction: "none",
  },
  sliderBlock: {
    display: "block",
    marginBottom: 12,
  },
  sliderRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 6,
    fontSize: 13,
    color: "#475569",
  },
  range: {
    width: "100%",
  },
  nicknameInput: {
    height: 42,
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    padding: "0 12px",
    fontSize: 14,
    color: "#0f172a",
    background: "#ffffff",
    boxSizing: "border-box",
  },
  tableWrap: {
    overflowX: "auto",
  },
  leaderboardTable: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 420,
  },
  leaderboardTh: {
    textAlign: "left",
    fontSize: 13,
    color: "#64748b",
    padding: "10px 8px",
    borderBottom: "1px solid #e2e8f0",
  },
  leaderboardTd: {
    fontSize: 14,
    color: "#0f172a",
    padding: "12px 8px",
    borderBottom: "1px solid #f1f5f9",
  },
};

function normalizeWord(value: string) {
  return value.trim().replace(/\s+/g, "").toLowerCase();
}

function getTodaySeed() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getPlayerId() {
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

function formatOrdinal(rank: number) {
  return `${rank}위`;
}

function formatElapsed(ms: number) {
  const total = Math.floor(ms / 1000);
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${min}분 ${String(sec).padStart(2, "0")}초`;
}

function levelLabel(score: number) {
  if (score >= 97) return "거의 정답";
  if (score >= 90) return "매우 가까움";
  if (score >= 80) return "가까움";
  if (score >= 65) return "어느 정도 관련";
  if (score >= 50) return "조금 관련";
  return "멀리 있음";
}

function scoreBarColor(score: number) {
  if (score >= 95) return "#ef4444";
  if (score >= 85) return "#f97316";
  if (score >= 75) return "#eab308";
  if (score >= 60) return "#84cc16";
  if (score >= 45) return "#0ea5e9";
  return "#94a3b8";
}

function validateWordBank(data: unknown): { ok: true; data: WordEntry[] } | { ok: false; reason: string } {
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
    if (!maybeVector.every((value) => typeof value === "number" && Number.isFinite(value))) continue;

    const parsedPca3 =
      Array.isArray(maybePca3) &&
      maybePca3.length === 3 &&
      maybePca3.every((value) => typeof value === "number" && Number.isFinite(value))
        ? [maybePca3[0], maybePca3[1], maybePca3[2]] as [number, number, number]
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

function projectTo3D(entry: WordEntry) {
  if (entry.pca3) {
    return entry.pca3 as Vec3;
  }

  const vector = entry.vector;
  const dimensions = Math.max(6, vector.length);
  const padded = Array.from({ length: dimensions }, (_, index) => vector[index] ?? 0);

  const projectionMatrix = [
    [0.72, -0.18, 0.31, 0.44, -0.22, 0.36],
    [-0.21, 0.67, 0.14, -0.33, 0.62, 0.18],
    [0.28, 0.16, 0.71, -0.24, 0.19, 0.58],
  ];

  const baseProjected = projectionMatrix.map((row) =>
    row.reduce((sum, weight, index) => sum + weight * (padded[index] ?? 0), 0),
  );

  let extraX = 0;
  let extraY = 0;
  let extraZ = 0;
  for (let i = 6; i < padded.length; i += 1) {
    const v = padded[i];
    extraX += v * (((i % 3) + 1) * 0.013);
    extraY += v * ((((i + 1) % 4) + 1) * -0.009);
    extraZ += v * ((((i + 2) % 5) + 1) * 0.011);
  }

  const projected = [baseProjected[0] + extraX, baseProjected[1] + extraY, baseProjected[2] + extraZ];
  const length = Math.sqrt(projected.reduce((sum, value) => sum + value * value, 0)) || 1;
  const scale = 115;
  return projected.map((value) => (value / length) * scale) as Vec3;
}

function rotatePoint([x, y, z]: Vec3, yaw: number, pitch: number): Vec3 {
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);

  const x1 = x * cosY + z * sinY;
  const z1 = -x * sinY + z * cosY;
  const y1 = y * cosP - z1 * sinP;
  const z2 = y * sinP + z1 * cosP;

  return [x1, y1, z2];
}

function projectPoint([x, y, z]: Vec3): ProjectedPoint {
  const cameraDistance = 360;
  const safeDepth = Math.min(z, cameraDistance - 1);
  const depthFactor = cameraDistance / (cameraDistance - safeDepth);
  return {
    x: x * depthFactor,
    y: y * depthFactor,
    scale: depthFactor,
    depth: safeDepth,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function ArrowHead({ x, y, angle, color }: { x: number; y: number; angle: number; color: string }) {
  const size = 10;
  const p1 = [x, y];
  const p2 = [x - size * Math.cos(angle - Math.PI / 6), y - size * Math.sin(angle - Math.PI / 6)];
  const p3 = [x - size * Math.cos(angle + Math.PI / 6), y - size * Math.sin(angle + Math.PI / 6)];
  return <polygon points={`${p1[0]},${p1[1]} ${p2[0]},${p2[1]} ${p3[0]},${p3[1]}`} fill={color} opacity={0.9} />;
}

function GuessVectorViewer({ history, wordBank }: { history: GuessResult[]; wordBank: WordEntry[] }) {
  const [yaw, setYaw] = useState(0.7);
  const [pitch, setPitch] = useState(-0.35);
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const dragState = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);

  const plottedEntries = useMemo(() => {
    return history
      .map((item) => {
        const entry = wordBank.find((candidate) => candidate.word === item.word);
        if (!entry || !Array.isArray(entry.vector)) return null;
        return { word: entry.word, score: item.score, position: projectTo3D(entry) };
      })
      .filter((entry): entry is { word: string; score: number; position: Vec3 } => Boolean(entry));
  }, [history, wordBank]);

  const rotatedScene = useMemo(() => {
    const axisBase = [
      { id: "x", label: "x", point: [AXIS_LENGTH, 0, 0] as Vec3, color: "#94a3b8" },
      { id: "y", label: "y", point: [0, -AXIS_LENGTH, 0] as Vec3, color: "#94a3b8" },
      { id: "z", label: "z", point: [0, 0, AXIS_LENGTH] as Vec3, color: "#94a3b8" },
    ];

    const axes = axisBase.map((axis) => {
      const rotated = rotatePoint(axis.point, yaw, pitch);
      const projected = projectPoint(rotated);
      return { ...axis, projected };
    });

    const arrows = plottedEntries
      .map((entry, index) => {
        const rotated = rotatePoint(entry.position, yaw, pitch);
        const projected = projectPoint(rotated);
        return {
          id: `${entry.word}-${index}`,
          word: entry.word,
          score: entry.score,
          projected,
          color: entry.score >= 85 ? "#f97316" : "#64748b",
          strokeWidth: entry.score >= 85 ? 3 : 2,
        };
      })
      .sort((a, b) => a.projected.depth - b.projected.depth);

    return { axes, arrows };
  }, [plottedEntries, pitch, yaw]);

  function handlePointerDown(event: React.PointerEvent<SVGSVGElement>) {
    event.preventDefault();
    setIsDragging(true);
    dragState.current = { x: event.clientX, y: event.clientY, yaw, pitch };
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (!dragState.current) return;
    const dx = event.clientX - dragState.current.x;
    const dy = event.clientY - dragState.current.y;
    setYaw(dragState.current.yaw + dx * 0.01);
    setPitch(clamp(dragState.current.pitch + dy * 0.01, -1.35, 1.35));
  }

  function handlePointerUp() {
    setIsDragging(false);
    dragState.current = null;
  }

  return (
    <div>
      <div style={styles.svgWrap}>
        <div style={styles.svgToolbar}>
          <span>드래그해서 회전하고, 아래 슬라이더와 버튼으로 시점을 조절할 수 있습니다.</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" style={styles.buttonSmall} onClick={() => setZoom((prev) => clamp(prev - 0.15, 0.5, 2.4))}>-</button>
            <button type="button" style={styles.buttonSmall} onClick={() => setZoom((prev) => clamp(prev + 0.15, 0.5, 2.4))}>+</button>
            <button
              type="button"
              style={styles.buttonSmall}
              onClick={() => {
                setYaw(0.7);
                setPitch(-0.35);
                setZoom(1);
              }}
            >
              초기화
            </button>
          </div>
        </div>
        <svg
          viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
          style={{ ...styles.svg, cursor: isDragging ? "grabbing" : "grab" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <defs>
            <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.18" />
            </filter>
          </defs>

          <g transform={`translate(${VIEW_CENTER}, ${VIEW_CENTER}) scale(${zoom}) translate(${-VIEW_CENTER}, ${-VIEW_CENTER})`}>
            <circle cx={VIEW_CENTER} cy={VIEW_CENTER} r={170} fill="none" stroke="#e2e8f0" strokeDasharray="6 6" />
            <circle cx={VIEW_CENTER} cy={VIEW_CENTER} r={120} fill="none" stroke="#edf2f7" />
            <circle cx={VIEW_CENTER} cy={VIEW_CENTER} r={4} fill="#0f172a" />

            {rotatedScene.axes.map((axis) => (
              <g key={axis.id} opacity={0.9}>
                <line
                  x1={VIEW_CENTER}
                  y1={VIEW_CENTER}
                  x2={VIEW_CENTER + axis.projected.x}
                  y2={VIEW_CENTER + axis.projected.y}
                  stroke={axis.color}
                  strokeWidth={1.5}
                />
                <text
                  x={VIEW_CENTER + axis.projected.x + 8}
                  y={VIEW_CENTER + axis.projected.y + 4}
                  fontSize="12"
                  fill={axis.color}
                  style={{ userSelect: "none", WebkitUserSelect: "none", pointerEvents: "none" }}
                >
                  {axis.label}
                </text>
              </g>
            ))}

            {rotatedScene.arrows.map((entry) => {
              const x2 = VIEW_CENTER + entry.projected.x;
              const y2 = VIEW_CENTER + entry.projected.y;
              const angle = Math.atan2(entry.projected.y, entry.projected.x);
              const labelOffsetX = Math.cos(angle) * 18;
              const labelOffsetY = Math.sin(angle) * 18;
              const radius = Math.max(4, 5 * entry.projected.scale);

              return (
                <g key={entry.id} filter="url(#softShadow)">
                  <line x1={VIEW_CENTER} y1={VIEW_CENTER} x2={x2} y2={y2} stroke={entry.color} strokeWidth={entry.strokeWidth} opacity={0.92} />
                  <ArrowHead x={x2} y={y2} angle={angle} color={entry.color} />
                  <circle cx={x2} cy={y2} r={radius} fill={entry.color} opacity={0.95} />
                  <g transform={`translate(${x2 + labelOffsetX}, ${y2 + labelOffsetY})`}>
                    <rect x={-26} y={-12} width={52} height={20} rx={10} fill={entry.score >= 85 ? "#fff7ed" : "white"} stroke={entry.score >= 85 ? "#fdba74" : "#cbd5e1"} />
                    <text
                      x={0}
                      y={2}
                      textAnchor="middle"
                      fontSize="11"
                      fill={entry.score >= 85 ? "#c2410c" : "#334155"}
                      style={{ userSelect: "none", WebkitUserSelect: "none", pointerEvents: "none" }}
                    >
                      {entry.word}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginTop: 12 }}>
        <div style={styles.card}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>회전 및 확대 조절</div>
          <label style={styles.sliderBlock}>
            <div style={styles.sliderRow}><span>좌우 회전</span><span>{yaw.toFixed(2)}</span></div>
            <input style={styles.range} type="range" min={-3.14} max={3.14} step={0.01} value={yaw} onChange={(e) => setYaw(Number(e.target.value))} />
          </label>
          <label style={styles.sliderBlock}>
            <div style={styles.sliderRow}><span>상하 회전</span><span>{pitch.toFixed(2)}</span></div>
            <input style={styles.range} type="range" min={-1.35} max={1.35} step={0.01} value={pitch} onChange={(e) => setPitch(Number(e.target.value))} />
          </label>
          <label style={styles.sliderBlock}>
            <div style={styles.sliderRow}><span>확대 배율</span><span>{zoom.toFixed(2)}x</span></div>
            <input style={styles.range} type="range" min={0.5} max={2.4} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
          </label>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const todaySeed = useMemo(() => getTodaySeed(), []);
  const playerId = useMemo(() => getPlayerId(), []);
  const [windowWidth, setWindowWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);

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
  const [nickname, setNickname] = useState(() => localStorage.getItem("semantic-nickname") ?? "");
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);

  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    localStorage.setItem("semantic-nickname", nickname);
  }, [nickname]);

  useEffect(() => {
    let cancelled = false;

    async function loadWordBank() {
      setIsLoadingWordBank(true);
      try {
        const response = await fetch(WORD_BANK_URL, { cache: "no-store" });
        if (!response.ok) throw new Error(`데이터 파일을 불러오지 못했습니다. (${response.status})`);
        const raw = await response.json();
        const validated = validateWordBank(raw);
        if (!validated.ok) throw new Error(validated.reason);

        if (!cancelled) {
          setWordBank(validated.data);
          setWordBankError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setWordBank(FALLBACK_WORD_BANK);
          setWordBankError(error instanceof Error ? error.message : "알 수 없는 데이터 로드 오류");
        }
      } finally {
        if (!cancelled) setIsLoadingWordBank(false);
      }
    }

    loadWordBank();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed.seed === todaySeed && Array.isArray(parsed.history)) {
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
      }
    } catch {
      // ignore
    }
  }, [todaySeed]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ seed: todaySeed, history, isSolved }),
    );
  }, [todaySeed, history, isSolved]);

  useEffect(() => {
    if (wordBankError) {
      setMessage(`외부 단어 데이터 로드 실패: ${wordBankError}. 현재는 데모용 내장 단어 집합으로 동작합니다.`);
    }
  }, [wordBankError]);

  async function loadLeaderboard() {
    try {
      const response = await fetch(`${API_BASE}/api/leaderboard?date=${todaySeed}`);
      if (!response.ok) return;
      const data = await response.json();
      if (Array.isArray(data)) {
        setLeaderboard(data);
      }
    } catch {
      // ignore
    }
  }

  async function startSession() {
    try {
      await fetch(`${API_BASE}/api/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date: todaySeed,
          playerId,
          nickname: nickname.trim() || "익명",
        }),
      });
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void startSession();
    void loadLeaderboard();
    const timer = window.setInterval(() => {
      void loadLeaderboard();
    }, 10000);
    return () => window.clearInterval(timer);
  }, [todaySeed, playerId]);

  const guessedWordSet = useMemo(() => new Set(history.map((item) => normalizeWord(item.word))), [history]);
  const sortedHistory = useMemo(() => [...history].sort((a, b) => b.score - a.score || a.guessedAt - b.guessedAt), [history]);
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
      const response = await fetch(`${API_BASE}/api/guess`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date: todaySeed,
          playerId,
          nickname: nickname.trim() || "익명",
          word: normalized,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(typeof data?.error === "string" ? data.error : "추측 처리 중 오류가 발생했습니다.");
        return;
      }

      const resultData = data as GuessApiResponse;
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
          ? `정답입니다.`
          : `${resultData.word}: ${resultData.score}점 / ${formatOrdinal(resultData.rank)} / ${levelLabel(resultData.score)}`,
      );
      void loadLeaderboard();
    } catch {
      setMessage("서버와 통신하지 못했습니다.");
    }
  }

  async function resetToday() {
    setHistory([]);
    setIsSolved(false);
    setInput("");
    setMessage("기록을 초기화했습니다.");
    localStorage.removeItem(STORAGE_KEY);

    try {
      await fetch(`${API_BASE}/api/reset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date: todaySeed,
          playerId,
          nickname: nickname.trim() || "익명",
        }),
      });
      await loadLeaderboard();
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
            gridTemplateColumns: isTablet ? "1fr" : "minmax(0, 1.4fr) minmax(320px, 0.8fr)",
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

            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr 1fr" : "1fr auto auto",
                gap: 12,
                marginTop: 20,
              }}
            >
              <input
                style={styles.input}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submitGuess();
                }}
                placeholder={isLoadingWordBank ? "단어 데이터 로딩 중..." : "단어를 입력하세요"}
                disabled={isLoadingWordBank}
              />
              <button type="button" style={styles.button} onClick={() => void submitGuess()} disabled={isLoadingWordBank}>
                제출
              </button>
              <button type="button" style={styles.buttonSecondary} onClick={() => void resetToday()}>
                초기화
              </button>
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: isMobile ? "stretch" : "center",
                flexDirection: isMobile ? "column" : "row",
                marginTop: 16,
              }}
            >
              <span style={{ fontSize: 14, color: "#475569", fontWeight: 700 }}>닉네임</span>
              <input
                style={{ ...styles.nicknameInput, width: isMobile ? "100%" : 220 }}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="랭킹에 표시할 이름"
                maxLength={20}
              />
            </div>

            {wordBankError && (
              <div style={styles.warning}>
                외부 데이터 로드 실패: {wordBankError}. 현재는 데모용 내장 단어 집합으로 실행 중입니다.
              </div>
            )}

            <div style={styles.alert}>{message}</div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr 1fr" : isTablet ? "1fr 1fr" : "repeat(4, 1fr)",
                gap: 14,
                marginTop: 16,
              }}
            >
              <div style={styles.statCard}>
                <div style={styles.statLabel}>최고 점수</div>
                <div style={styles.statValue}>{topGuess ? `${topGuess.score}` : "-"}</div>
                <div style={styles.statSub}>{topGuess ? topGuess.word : "아직 없음"}</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>최고 순위</div>
                <div style={styles.statValue}>{topGuess ? topGuess.rank : "-"}</div>
                <div style={styles.statSub}>{topGuess ? formatOrdinal(topGuess.rank) : "아직 없음"}</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>제출 횟수</div>
                <div style={styles.statValue}>{history.length}</div>
                <div style={styles.statSub}>오늘 기준</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>상태</div>
                <div style={{ ...styles.statValue, fontSize: 24 }}>{isSolved ? "정답 성공" : isLoadingWordBank ? "로딩 중" : "진행 중"}</div>
                <div style={styles.statSub}>{isSolved ? "오늘의 단어를 맞혔습니다." : isLoadingWordBank ? "단어 데이터를 불러오고 있습니다." : "계속 시도해 보세요."}</div>
              </div>
            </div>
          </div>

          <div style={styles.card}>
            <h2 style={{ marginTop: 0, marginBottom: 14, fontSize: 22 }}>기본 규칙</h2>
            <p style={styles.sideText}>1. 단어를 입력하면 서버가 정답과의 유사도를 계산합니다.</p>
            <p style={styles.sideText}>2. 점수는 0~100이며 높을수록 정답에 가깝습니다.</p>
            <p style={styles.sideText}>3. 순위는 전체 단어 집합 안에서 얼마나 가까운지 의미합니다.</p>
            <p style={styles.sideText}>4. 랭킹은 1순위 유사도, 2순위 시간입니다.</p>
            <p style={styles.sideText}>5. 같은 와이파이에서 접속하면 함께 참여할 수 있습니다.</p>
            <p style={styles.sideText}>6. 현재 단어 수: {isLoadingWordBank ? "불러오는 중" : `${wordBank.length}개`}</p>

            <div style={{ ...styles.alert, marginTop: 16 }}>
              정답 확인 버튼은 숨겨져 있습니다.
              <div style={{ marginTop: 6, fontSize: 12, color: "#64748b" }}>
                운영자는 별도 스크립트로 오늘의 정답을 확인하면 됩니다.
              </div>
            </div>
          </div>
        </div>

        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <button type="button" style={activeTab === "history" ? styles.tabButtonActive : styles.tabButton} onClick={() => setActiveTab("history")}>
              제출 기록
            </button>
            <button type="button" style={activeTab === "scatter" ? styles.tabButtonActive : styles.tabButton} onClick={() => setActiveTab("scatter")}>
              3D 벡터 시각화
            </button>
          </div>

          {activeTab === "history" ? (
            <div style={styles.card}>
              <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: 22 }}>제출 기록</h2>
              {sortedHistory.length === 0 ? (
                <div style={styles.emptyBox}>아직 제출 기록이 없습니다.</div>
              ) : (
                sortedHistory.map((item) => (
                  <div
                    key={`${item.word}-${item.guessedAt}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: isMobile ? "1fr" : "1fr 140px 90px 100px",
                      gap: 12,
                      alignItems: "center",
                      border: "1px solid #e2e8f0",
                      borderRadius: 16,
                      padding: 14,
                      marginBottom: 10,
                    }}
                  >
                    <div>
                      <div style={styles.historyLabelRow}>
                        <span style={styles.wordPill}>{item.word}</span>
                        <span style={{ fontSize: 13, color: "#64748b" }}>{levelLabel(item.score)}</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: "#64748b", display: "flex", justifyContent: "space-between" }}>
                        <span>점수</span>
                        <span>{item.score}</span>
                      </div>
                      <div style={styles.meterTrack}>
                        <div style={{ width: `${item.score}%`, height: "100%", background: scoreBarColor(item.score) }} />
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{formatOrdinal(item.rank)}</div>
                    <div style={{ fontSize: 14, color: "#64748b" }}>{item.elapsedMs ? formatElapsed(item.elapsedMs) : "-"}</div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div style={styles.card}>
              <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: 22 }}>3D 벡터 시각화</h2>
              <GuessVectorViewer history={history} wordBank={wordBank} />
            </div>
          )}
        </div>

        <div style={styles.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: 22 }}>실시간 랭킹</h2>
            <div style={{ fontSize: 13, color: "#64748b" }}>1순위 유사도 · 2순위 시간</div>
          </div>

          {leaderboard.length === 0 ? (
            <div style={styles.emptyBox}>아직 랭킹 기록이 없습니다.</div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.leaderboardTable}>
                <thead>
                  <tr>
                    <th style={styles.leaderboardTh}>순위</th>
                    <th style={styles.leaderboardTh}>닉네임</th>
                    <th style={styles.leaderboardTh}>유사도 점수</th>
                    <th style={styles.leaderboardTh}>시간</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((row) => (
                    <tr key={`${row.nickname}-${row.rank}-${row.updatedAt}`}>
                      <td style={styles.leaderboardTd}>{row.rank}</td>
                      <td style={styles.leaderboardTd}>{row.nickname}</td>
                      <td style={styles.leaderboardTd}>{Number((((Math.max(-1, Math.min(1, row.bestSimilarity)) + 1) / 2) * 100).toFixed(1))}</td>
                      <td style={styles.leaderboardTd}>{formatElapsed(row.bestElapsedMs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}