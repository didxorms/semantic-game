type RuleCardProps = {
  isLoadingWordBank: boolean;
  wordCount: number;
};

export default function RuleCard({
  isLoadingWordBank,
  wordCount,
}: RuleCardProps) {
  const cardStyle = {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    boxShadow: "0 12px 28px rgba(15, 23, 42, 0.07)",
    padding: 18,
  };

  const sideTextStyle = {
    fontSize: 14,
    lineHeight: 1.6,
    color: "#475569",
    margin: "0 0 8px 0",
  };

  const alertStyle = {
    marginTop: 16,
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    padding: 14,
    fontSize: 14,
    lineHeight: 1.5,
    color: "#0f172a",
  };

  return (
    <div style={cardStyle}>
      <h2 style={{ marginTop: 0, marginBottom: 14, fontSize: 22 }}>기본 규칙</h2>
      <p style={sideTextStyle}>
        1. 단어를 입력하면 서버가 정답과의 유사도를 계산합니다.
      </p>
      <p style={sideTextStyle}>2. 점수는 0~100이며 높을수록 정답에 가깝습니다.</p>
      <p style={sideTextStyle}>
        3. 순위는 전체 단어 집합 안에서 얼마나 가까운지 의미합니다.
      </p>
      <p style={sideTextStyle}>4. 랭킹은 1순위 유사도, 2순위 시간입니다.</p>
      <p style={sideTextStyle}>
        5. 같은 와이파이에서 접속하면 함께 참여할 수 있습니다.
      </p>
      <p style={sideTextStyle}>
        6. 현재 단어 수: {isLoadingWordBank ? "불러오는 중" : `${wordCount}개`}
      </p>

      <div style={alertStyle}>
        정답 확인 버튼은 숨겨져 있습니다.
        <div style={{ marginTop: 6, fontSize: 12, color: "#64748b" }}>
          운영자는 별도 스크립트로 오늘의 정답을 확인하면 됩니다.
        </div>
      </div>
    </div>
  );
}