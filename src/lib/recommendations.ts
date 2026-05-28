export interface RecommendationSignal {
  categoryMatch: number;
  engagementRate: number;
  completionRate: number;
  sameCountry: boolean;
  ageHours: number;
  followsCreator: boolean;
}

export const calculateRecommendationScore = (signal: RecommendationSignal) => {
  const recency = signal.ageHours < 48 ? 1 : Math.max(0, 1 - signal.ageHours / 720);
  return Math.round(
    signal.categoryMatch * 30 +
      Math.min(signal.engagementRate, 1) * 25 +
      Math.min(signal.completionRate, 1) * 20 +
      (signal.sameCountry ? 10 : 0) +
      recency * 10 +
      (signal.followsCreator ? 5 : 0)
  );
};
