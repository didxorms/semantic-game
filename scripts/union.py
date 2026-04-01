import json
from pathlib import Path

NOUN_PATH = Path(r"D:\Users\rmsxo\Downloads\전체 내려받기_한국어기초사전_json_20260319\noun.json")
WORD_LIST_PATH = Path(r"D:\Users\rmsxo\충북과학고\두루누리\2026 두루누리\꼬맨틀\korean_word_list.json")
OUTPUT_PATH = Path(r"D:\Users\rmsxo\충북과학고\두루누리\2026 두루누리\꼬맨틀\korean_word_bank.json")


def normalize_word(word: str) -> str:
    return str(word).strip().replace(" ", "")


def valid_word(word: str) -> bool:
    if not word:
        return False
    # 한 글자도 허용하려면 이대로 두면 됨
    # 두 글자 이상만 원하면 len(word) < 2 로 바꾸기
    if len(word) < 1:
        return False
    # 한글만 허용. 외래어/영문도 살리고 싶으면 이 조건 삭제
    if not all("가" <= ch <= "힣" for ch in word):
        return False
    return True


def load_json(path: Path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


noun_data = load_json(NOUN_PATH)
word_list_data = load_json(WORD_LIST_PATH)

seen = set()
merged = []

for source in (noun_data, word_list_data):
    if not isinstance(source, list):
        continue

    for item in source:
        if not isinstance(item, dict):
            continue

        word = item.get("word")
        if not isinstance(word, str):
            continue

        word = normalize_word(word)

        if not valid_word(word):
            continue

        if word in seen:
            continue
        seen.add(word)

        merged.append({"word": word})

with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
    json.dump(merged, f, ensure_ascii=False, indent=2)

print(f"총 {len(merged)}개 저장 완료")
print(f"저장 위치: {OUTPUT_PATH}")