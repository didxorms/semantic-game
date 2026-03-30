import type { GuessResult } from "../types/game";
import {
  formatElapsed,
  formatOrdinal,
  levelLabel,
  scoreBarColor,
} from "../lib/format";

type GuessHistoryProps = {
  sortedHistory: GuessResult[];
  isMobile: boolean;
};

export default function GuessHistory({
  sortedHistory,
  isMobile,
}: GuessHistoryProps) {
  const cardStyle = {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    boxShadow: "0 12px 28px rgba(15, 23, 42, 0.07)",
    padding: 18,
  };

  const emptyBoxStyle = {
    borderRadius: 16,
    border: "1px dashed #cbd5e1",
    padding: 32,
    textAlign: "center" as const,
    color: "#64748b",
    fontSize: 14,
  };

  const historyLabelRowStyle = {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap" as const,
  };

  const wordPillStyle = {
    display: "inline-block",
    padding: "6px 12px",
    borderRadius: 999,
    background: "#eef2ff",
    color: "#3730a3",
    fontSize: 13,
    fontWeight: 700,
  };

  const meterTrackStyle = {
    width: "100%",
    height: 8,
    borderRadius: 999,
    background: "#e2e8f0",
    overflow: "hidden" as const,
    marginTop: 4,
  };

  return (
    <div style={cardStyle}>
      <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: 22 }}>제출 기록</h2>

      {sortedHistory.length === 0 ? (
        <div style={emptyBoxStyle}>아직 제출 기록이 없습니다.</div>
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
              <div style={historyLabelRowStyle}>
                <span style={wordPillStyle}>{item.word}</span>
                <span style={{ fontSize: 13, color: "#64748b" }}>
                  {levelLabel(item.score)}
                </span>
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  color: "#64748b",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>점수</span>
                <span>{item.score}</span>
              </div>
              <div style={meterTrackStyle}>
                <div
                  style={{
                    width: `${item.score}%`,
                    height: "100%",
                    background: scoreBarColor(item.score),
                  }}
                />
              </div>
            </div>

            <div style={{ fontSize: 14, fontWeight: 700 }}>
              {formatOrdinal(item.rank)}
            </div>

            <div style={{ fontSize: 14, color: "#64748b" }}>
              {item.elapsedMs != null ? formatElapsed(item.elapsedMs) : "-"}
            </div>
          </div>
        ))
      )}
    </div>
  );
}