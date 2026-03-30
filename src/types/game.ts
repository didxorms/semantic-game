export type WordEntry = {
  word: string;
  vector: number[];
  category: string;
  pca3?: [number, number, number];
};

export type GuessResult = {
  word: string;
  score: number;
  rank: number;
  similarity: number;
  guessedAt: number;
  elapsedMs?: number;
};

export type LeaderboardRow = {
  rank: number;
  nickname: string;
  bestSimilarity: number;
  bestElapsedMs: number;
  updatedAt: number;
};

export type GuessApiResponse = {
  ok: true;
  word: string;
  score: number;
  rank: number;
  similarity: number;
  solved: boolean;
  elapsedMs: number;
};