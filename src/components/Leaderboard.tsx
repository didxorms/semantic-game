import type { LeaderboardRow } from "../types/game";
import { formatElapsed } from "../lib/format";

type LeaderboardProps = {
  leaderboard: LeaderboardRow[];
};

export default function Leaderboard({ leaderboard }: LeaderboardProps) {
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

  const leaderboardTableStyle = {
    width: "100%",
    borderCollapse: "collapse" as const,
    minWidth: 420,
  };

  const leaderboardThStyle = {
    textAlign: "left" as const,
    fontSize: 13,
    color: "#64748b",
    padding: "10px 8px",
    borderBottom: "1px solid #e2e8f0",
  };

  const leaderboardTdStyle = {
    fontSize: 14,
    color: "#0f172a",
    padding: "12px 8px",
    borderBottom: "1px solid #f1f5f9",
  };

  return (
    <div style={cardStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 22 }}>실시간 랭킹</h2>
        <div style={{ fontSize: 13, color: "#64748b" }}>
          1순위 유사도 · 2순위 시간
        </div>
      </div>

      {leaderboard.length === 0 ? (
        <div style={emptyBoxStyle}>아직 랭킹 기록이 없습니다.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={leaderboardTableStyle}>
            <thead>
              <tr>
                <th style={leaderboardThStyle}>순위</th>
                <th style={leaderboardThStyle}>닉네임</th>
                <th style={leaderboardThStyle}>유사도 점수</th>
                <th style={leaderboardThStyle}>시간</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((row) => (
                <tr key={`${row.nickname}-${row.rank}-${row.updatedAt}`}>
                  <td style={leaderboardTdStyle}>{row.rank}</td>
                  <td style={leaderboardTdStyle}>{row.nickname}</td>
                  <td style={leaderboardTdStyle}>
                    {Number(
                      (
                        ((Math.max(-1, Math.min(1, row.bestSimilarity)) + 1) / 2) *
                        100
                      ).toFixed(1),
                    )}
                  </td>
                  <td style={leaderboardTdStyle}>
                    {formatElapsed(row.bestElapsedMs)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}