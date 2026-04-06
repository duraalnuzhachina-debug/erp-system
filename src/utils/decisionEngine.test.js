import { describe, expect, it } from 'vitest';

import {
  calculateBaseMetrics,
  calculateDecisionScore,
  filterOutliers,
  getValidPrices,
} from './decisionEngine';

describe('decisionEngine', () => {
  describe('filterOutliers', () => {
    it('removes a clear high outlier while keeping normal prices', () => {
      expect(filterOutliers([100, 102, 101, 260])).toEqual([100, 102, 101]);
    });

    it('keeps at least the latest price when fallback filtering removes everything', () => {
      expect(filterOutliers([1, 1, 1, 1000])).toEqual([1000]);
    });
  });

  describe('getValidPrices', () => {
    it('sorts records by timestamp before taking the most recent values', () => {
      const purchases = [
        { price: 90, timestamp: 300 },
        { price: 70, timestamp: 100 },
        { price: 80, timestamp: 200 },
      ];

      expect(getValidPrices(purchases)).toEqual([70, 80, 90]);
    });
  });

  describe('calculateBaseMetrics', () => {
    it('returns stable metrics when history is insufficient', () => {
      expect(calculateBaseMetrics(120, [{ price: 100, timestamp: 1 }])).toEqual({
        current_price: 120,
        avg_price: 0,
        last_price: 0,
        change_value: 0,
        change_percent: 0,
        trend_percent: 0,
        trend_direction: 'stable',
      });
    });

    it('computes average, change, and trend from filtered history', () => {
      expect(
        calculateBaseMetrics(95, [
          { price: 100, timestamp: 1 },
          { price: 110, timestamp: 2 },
          { price: 90, timestamp: 3 },
        ])
      ).toEqual({
        current_price: 95,
        avg_price: 100,
        last_price: 90,
        change_value: -5,
        change_percent: -0.05,
        trend_percent: 0.0556,
        trend_direction: 'increasing',
        sample_count: 3,
      });
    });
  });

  describe('calculateDecisionScore', () => {
    it('returns null when there is not enough valid history', () => {
      expect(calculateDecisionScore(100, [{ price: 99, timestamp: 1 }])).toBeNull();
    });

    it('downgrades to Monitor when history is good but sample size is still thin', () => {
      const result = calculateDecisionScore(90, [
        { price: 100, timestamp: 1 },
        { price: 100, timestamp: 2 },
      ]);

      expect(result).toMatchObject({
        grade: 'B',
        decisionEn: 'Monitor',
        avgPrice: 100,
        sampleCount: 2,
      });
      expect(result.score).toBe(37);
    });

    it('blocks purchases when the direct increase breaches safety guardrails', () => {
      const result = calculateDecisionScore(
        120,
        [
          { price: 100, timestamp: 1 },
          { price: 100, timestamp: 2 },
          { price: 100, timestamp: 3 },
        ],
        { currentQuantity: 20 }
      );

      expect(result).toMatchObject({
        grade: 'C',
        decisionEn: 'Do Not Buy',
        avgPrice: 100,
        sampleCount: 3,
      });
      expect(result.warnings.some((warning) => warning.en.includes('High expected financial impact'))).toBe(true);
    });
  });
});