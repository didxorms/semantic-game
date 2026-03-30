type GuessInputProps = {
  input: string;
  setInput: (value: string) => void;
  nickname: string;
  setNickname: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  onReset: () => void | Promise<void>;
  isLoading: boolean;
  isMobile: boolean;
  isTablet: boolean;
  message: string;
};

export default function GuessInput({
  input,
  setInput,
  nickname,
  setNickname,
  onSubmit,
  onReset,
  isLoading,
  isMobile,
  isTablet,
  message,
}: GuessInputProps) {
  const inputStyle = {
    width: "100%",
    height: 48,
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    padding: "0 14px",
    fontSize: 16,
    boxSizing: "border-box" as const,
    outline: "none",
    background: "#ffffff",
    color: "#0f172a",
    boxShadow: "inset 0 1px 2px rgba(15, 23, 42, 0.04)",
  };

  const buttonStyle = {
    height: 48,
    borderRadius: 14,
    border: "1px solid #111827",
    background: "#111827",
    color: "#ffffff",
    padding: "0 18px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  };

  const secondaryButtonStyle = {
    height: 48,
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#f1f5f9",
    color: "#0f172a",
    padding: "0 18px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  };

  const nicknameInputStyle = {
    height: 42,
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    padding: "0 12px",
    fontSize: 14,
    color: "#0f172a",
    background: "#ffffff",
    boxSizing: "border-box" as const,
    width: isMobile ? "100%" : 220,
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
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile
            ? "1fr"
            : isTablet
              ? "1fr 1fr"
              : "1fr auto auto",
          gap: 12,
          marginTop: 20,
        }}
      >
        <input
          style={inputStyle}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void onSubmit();
          }}
          placeholder={isLoading ? "단어 데이터 로딩 중..." : "단어를 입력하세요"}
          disabled={isLoading}
        />
        <button
          type="button"
          style={buttonStyle}
          onClick={() => void onSubmit()}
          disabled={isLoading}
        >
          제출
        </button>
        <button
          type="button"
          style={secondaryButtonStyle}
          onClick={() => void onReset()}
        >
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
        <span style={{ fontSize: 14, color: "#475569", fontWeight: 700 }}>
          닉네임
        </span>
        <input
          style={nicknameInputStyle}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="랭킹에 표시할 이름"
          maxLength={20}
        />
      </div>

      <div style={alertStyle}>{message}</div>
    </>
  );
}