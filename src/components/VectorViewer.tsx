import {
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { GuessResult, WordEntry } from "../types/game";

type Vec3 = [number, number, number];

type ProjectedPoint = {
  x: number;
  y: number;
  scale: number;
  depth: number;
};

const VIEW_SIZE = 560;
const VIEW_CENTER = VIEW_SIZE / 2;
const AXIS_LENGTH = 150;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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

  const projected = [
    baseProjected[0] + extraX,
    baseProjected[1] + extraY,
    baseProjected[2] + extraZ,
  ];

  const length =
    Math.sqrt(projected.reduce((sum, value) => sum + value * value, 0)) || 1;
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

function ArrowHead({
  x,
  y,
  angle,
  color,
}: {
  x: number;
  y: number;
  angle: number;
  color: string;
}) {
  const size = 10;
  const p1 = [x, y];
  const p2 = [
    x - size * Math.cos(angle - Math.PI / 6),
    y - size * Math.sin(angle - Math.PI / 6),
  ];
  const p3 = [
    x - size * Math.cos(angle + Math.PI / 6),
    y - size * Math.sin(angle + Math.PI / 6),
  ];

  return (
    <polygon
      points={`${p1[0]},${p1[1]} ${p2[0]},${p2[1]} ${p3[0]},${p3[1]}`}
      fill={color}
      opacity={0.9}
    />
  );
}

type VectorViewerProps = {
  history: GuessResult[];
  wordBank: WordEntry[];
};

export default function VectorViewer({
  history,
  wordBank,
}: VectorViewerProps) {
  const [yaw, setYaw] = useState(0.7);
  const [pitch, setPitch] = useState(-0.35);
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);

  const dragState = useRef<{
    x: number;
    y: number;
    yaw: number;
    pitch: number;
  } | null>(null);

  const plottedEntries = useMemo(() => {
    return history
      .map((item) => {
        const entry = wordBank.find((candidate) => candidate.word === item.word);
        if (!entry || !Array.isArray(entry.vector)) return null;
        return { word: entry.word, score: item.score, position: projectTo3D(entry) };
      })
      .filter(
        (entry): entry is { word: string; score: number; position: Vec3 } =>
          Boolean(entry),
      );
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

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    event.preventDefault();
    setIsDragging(true);
    dragState.current = { x: event.clientX, y: event.clientY, yaw, pitch };
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
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

  const buttonSmallStyle = {
    height: 36,
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    padding: "0 12px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  };

  const cardStyle = {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    boxShadow: "0 12px 28px rgba(15, 23, 42, 0.07)",
    padding: 18,
  };

  return (
    <div>
      <div
        style={{
          overflow: "hidden",
          borderRadius: 16,
          border: "1px solid #e2e8f0",
          background: "#f8fafc",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            borderBottom: "1px solid #e2e8f0",
            padding: "12px 16px",
            fontSize: 14,
            color: "#475569",
            flexWrap: "wrap",
          }}
        >
          <span>드래그해서 회전하고, 아래 슬라이더와 버튼으로 시점을 조절할 수 있습니다.</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              style={buttonSmallStyle}
              onClick={() => setZoom((prev) => clamp(prev - 0.15, 0.5, 2.4))}
            >
              -
            </button>
            <button
              type="button"
              style={buttonSmallStyle}
              onClick={() => setZoom((prev) => clamp(prev + 0.15, 0.5, 2.4))}
            >
              +
            </button>
            <button
              type="button"
              style={buttonSmallStyle}
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
          style={{
            width: "100%",
            height: 420,
            display: "block",
            background:
              "radial-gradient(circle at center, rgba(148,163,184,0.12), transparent 60%)",
            userSelect: "none",
            WebkitUserSelect: "none",
            msUserSelect: "none",
            touchAction: "none",
            cursor: isDragging ? "grabbing" : "grab",
          }}
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

          <g
            transform={`translate(${VIEW_CENTER}, ${VIEW_CENTER}) scale(${zoom}) translate(${-VIEW_CENTER}, ${-VIEW_CENTER})`}
          >
            <circle
              cx={VIEW_CENTER}
              cy={VIEW_CENTER}
              r={170}
              fill="none"
              stroke="#e2e8f0"
              strokeDasharray="6 6"
            />
            <circle
              cx={VIEW_CENTER}
              cy={VIEW_CENTER}
              r={120}
              fill="none"
              stroke="#edf2f7"
            />
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
                  style={{
                    userSelect: "none",
                    WebkitUserSelect: "none",
                    pointerEvents: "none",
                  }}
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
                  <line
                    x1={VIEW_CENTER}
                    y1={VIEW_CENTER}
                    x2={x2}
                    y2={y2}
                    stroke={entry.color}
                    strokeWidth={entry.strokeWidth}
                    opacity={0.92}
                  />
                  <ArrowHead x={x2} y={y2} angle={angle} color={entry.color} />
                  <circle cx={x2} cy={y2} r={radius} fill={entry.color} opacity={0.95} />
                  <g transform={`translate(${x2 + labelOffsetX}, ${y2 + labelOffsetY})`}>
                    <rect
                      x={-26}
                      y={-12}
                      width={52}
                      height={20}
                      rx={10}
                      fill={entry.score >= 85 ? "#fff7ed" : "white"}
                      stroke={entry.score >= 85 ? "#fdba74" : "#cbd5e1"}
                    />
                    <text
                      x={0}
                      y={2}
                      textAnchor="middle"
                      fontSize="11"
                      fill={entry.score >= 85 ? "#c2410c" : "#334155"}
                      style={{
                        userSelect: "none",
                        WebkitUserSelect: "none",
                        pointerEvents: "none",
                      }}
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
        <div style={cardStyle}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
            회전 및 확대 조절
          </div>

          <label style={{ display: "block", marginBottom: 12 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 6,
                fontSize: 13,
                color: "#475569",
              }}
            >
              <span>좌우 회전</span>
              <span>{yaw.toFixed(2)}</span>
            </div>
            <input
              style={{ width: "100%" }}
              type="range"
              min={-3.14}
              max={3.14}
              step={0.01}
              value={yaw}
              onChange={(e) => setYaw(Number(e.target.value))}
            />
          </label>

          <label style={{ display: "block", marginBottom: 12 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 6,
                fontSize: 13,
                color: "#475569",
              }}
            >
              <span>상하 회전</span>
              <span>{pitch.toFixed(2)}</span>
            </div>
            <input
              style={{ width: "100%" }}
              type="range"
              min={-1.35}
              max={1.35}
              step={0.01}
              value={pitch}
              onChange={(e) => setPitch(Number(e.target.value))}
            />
          </label>

          <label style={{ display: "block", marginBottom: 12 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 6,
                fontSize: 13,
                color: "#475569",
              }}
            >
              <span>확대 배율</span>
              <span>{zoom.toFixed(2)}x</span>
            </div>
            <input
              style={{ width: "100%" }}
              type="range"
              min={0.5}
              max={2.4}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </label>
        </div>
      </div>
    </div>
  );
}