import type { GuessResult } from "../types/game";
import { formatOrdinal } from "../lib/format";

type StatusCardsProps = {
  topGuess: GuessResult | null;
  historyLength: number;
  isSolved: boolean;
  isLoadingWordBank: boolean;
  isMobile: boolean;
  isTablet: boolean;
};

export default function StatusCards({
  topGuess,
  historyLength,
  isSolved,
  isLoadingWordBank,
  isMobile,
  isTablet,
}: StatusCardsProps) {
  const statCardStyle = {
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 16,
    background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  };

  const statLabelStyle = {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 8,
  };

  const statValueStyle = {
    fontSize: 28,
    fontWeight: 800,
    marginBottom: 6,
    color: "#0f172a",
  };

  const statSubStyle = {
    fontSize: 13,
    color: "#64748b",
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isMobile
          ? "1fr 1fr"
          : isTablet
            ? "1fr 1fr"
            : "repeat(4, 1fr)",
        gap: 14,
        marginTop: 16,
      }}
    >
      <div style={statCardStyle}>
        <div style={statLabelStyle}>최고 점수</div>
        <div style={statValueStyle}>{topGuess ? `${topGuess.score}` : "-"}</div>
        <div style={statSubStyle}>{topGuess ? topGuess.word : "아직 없음"}</div>
      </div>

      <div style={statCardStyle}>
        <div style={statLabelStyle}>최고 순위</div>
        <div style={statValueStyle}>{topGuess ? topGuess.rank : "-"}</div>
        <div style={statSubStyle}>
          {topGuess ? formatOrdinal(topGuess.rank) : "아직 없음"}
        </div>
      </div>

      <div style={statCardStyle}>
        <div style={statLabelStyle}>제출 횟수</div>
        <div style={statValueStyle}>{historyLength}</div>
        <div style={statSubStyle}>오늘 기준</div>
      </div>

      <div style={statCardStyle}>
        <div style={{ ...statValueStyle, fontSize: 24 }}>
          {isSolved ? "정답 성공" : isLoadingWordBank ? "로딩 중" : "진행 중"}
        </div>
        <div style={statLabelStyle}>상태</div>
        <div style={statSubStyle}>
          {isSolved
            ? "오늘의 단어를 맞혔습니다."
            : isLoadingWordBank
              ? "단어 데이터를 불러오고 있습니다."
              : "계속 시도해 보세요."}
        </div>
      </div>
    </div>
  );
}