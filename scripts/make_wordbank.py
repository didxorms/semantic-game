import json
from pathlib import Path

INPUT_DIR = Path(r"D:\Users\rmsxo\Downloads\전체 내려받기_한국어기초사전_json_20260319")
OUTPUT_PATH = Path(r"D:\Users\rmsxo\Downloads\전체 내려받기_한국어기초사전_json_20260319\noun.json")

FILE_PATTERN = "*_5000_20260319.json"


def get_feat_value(feat_obj, target_att):
    if isinstance(feat_obj, dict):
        if feat_obj.get("att") == target_att:
            return feat_obj.get("val")
    elif isinstance(feat_obj, list):
        for x in feat_obj:
            if isinstance(x, dict) and x.get("att") == target_att:
                return x.get("val")
    return None


def extract_written_form(entry):
    lemma = entry.get("Lemma")
    if not isinstance(lemma, dict):
        return None

    feat = lemma.get("feat")
    word = get_feat_value(feat, "writtenForm")
    return word.strip() if isinstance(word, str) else None


def find_part_of_speech(entry):
    def dfs(obj):
        if isinstance(obj, dict):
            if obj.get("att") == "partOfSpeech" and "val" in obj:
                return obj["val"]
            for v in obj.values():
                result = dfs(v)
                if result is not None:
                    return result
        elif isinstance(obj, list):
            for item in obj:
                result = dfs(item)
                if result is not None:
                    return result
        return None

    result = dfs(entry)
    return result.strip() if isinstance(result, str) else None


def valid_word(word: str) -> bool:
    if not word:
        return False
    if len(word) < 2:
        return False
    if " " in word:
        return False
    if not all("가" <= ch <= "힣" for ch in word):
        return False
    return True


all_files = sorted(INPUT_DIR.glob(FILE_PATTERN))
all_files.append(Path(r"D:\Users\rmsxo\Downloads\전체 내려받기_한국어기초사전_json_20260319\11_3439_20260319.json"))

if not all_files:
    raise FileNotFoundError(f"입력 파일을 찾지 못했습니다: {INPUT_DIR} / {FILE_PATTERN}")

nouns = []
seen = set()

total_entries = 0

for file_path in all_files:
    print(f"처리 중: {file_path.name}")

    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    entries = data["LexicalResource"]["Lexicon"]["LexicalEntry"]
    total_entries += len(entries)

    for entry in entries:
        word = extract_written_form(entry)
        pos = find_part_of_speech(entry)

        if not word or not pos:
            continue

        if pos != "명사":
            continue

        if not valid_word(word):
            continue

        if word in seen:
            continue
        seen.add(word)

        nouns.append({
            "word": word,
            "pos": pos,
        })

with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
    json.dump(nouns, f, ensure_ascii=False, indent=2)

print(f"\n총 파일 수: {len(all_files)}")
print(f"총 엔트리 수: {total_entries}")
print(f"최종 명사 수(중복 제거 후): {len(nouns)}")
print(f"저장 완료: {OUTPUT_PATH}")