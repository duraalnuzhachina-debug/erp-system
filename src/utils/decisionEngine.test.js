import { describe, expect, it } from 'vitest';

import {
  calculateBaseMetrics,
  calculateDecisionScore,
  filterOutliers,
  getValidPrices,
  calculateRootCause,
  enrichPurchasesWithScores
} from './decisionEngine';

describe('decisionEngine', () => {
  describe('filterOutliers', () => {
    it('removes a clear high outlier while keeping normal prices', () => {
      expect(filterOutliers([100, 102, 101, 260])).toEqual([100, 102, 101]);
    });

    it('keeps at least the latest price when fallback filtering removes everything', () => {
      expect(filterOutliers([1, 1, 1, 1000])).toEqual([1000]);
    });

    it('handles empty or very small arrays safely', () => {
      expect(filterOutliers([])).toEqual([]);
      expect(filterOutliers([50])).toEqual([50]);
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

    it('handles corrupted records by ignoring NaN or missing prices', () => {
      const purchases = [
        { price: null, timestamp: 100 },
        { price: 50, timestamp: 200 },
        { price: "invalid", timestamp: 300 },
      ];

      expect(getValidPrices(purchases)).toEqual([50]);
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
        sample_count: 1
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

  describe('calculateRootCause', () => {
    it('identifies supplier as the root cause when only supplier deviates', () => {
      const current = { code: 'A', branch: 'Branch 1', vendor: 'Vendor X', price: 120 };
      const history = [
        { code: 'A', branch: 'Branch 1', vendor: 'Vendor Y', price: 100, timestamp: 1 },
        { code: 'A', branch: 'Branch 2', vendor: 'Vendor Z', price: 100, timestamp: 2 },
        { code: 'A', branch: 'Branch 1', vendor: 'Vendor X', price: 120, timestamp: 3 },
      ];
      
      const result = calculateRootCause(current, history);
      expect(result.source).toBe('supplier');
    });

    it('identifies branch as the root cause when branch averages are higher', () => {
      const current = { code: 'A', branch: 'Branch X', vendor: 'Vendor 1', price: 130 };
      const history = [
        { code: 'A', branch: 'Branch X', vendor: 'Vendor 1', price: 130, timestamp: 1 },
        { code: 'A', branch: 'Branch Y', vendor: 'Vendor 1', price: 100, timestamp: 2 },
        { code: 'A', branch: 'Branch Z', vendor: 'Vendor 2', price: 100, timestamp: 3 },
      ];
      
      const result = calculateRootCause(current, history);
      expect(result.source).toBe('branch');
    });
  });

  describe('enrichPurchasesWithScores', () => {
    it('processes an array of purchases and attaches scores using historical contexts', () => {
      const purchases = [
        { id: 1, code: 'ITEM1', price: 100, timestamp: 1000 },
        { id: 2, code: 'ITEM1', price: 105, timestamp: 2000 },
        { id: 3, code: 'ITEM1', price: 150, timestamp: 3000 }, // Huge jump
      ];

      const enriched = enrichPurchasesWithScores(purchases, {});
      
      expect(enriched).toHaveLength(3);
      // The first two shouldn't have scores (not enough history yet)
      expect(enriched[0].score).toBeNull();
      // The third one should have a bad grade due to the jump
      expect(enriched[2].score).toBeLessThan(0);
      expect(enriched[2].grade).toBe('C');
    });
  });
});
