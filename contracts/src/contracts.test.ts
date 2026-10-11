import { describe, expect, it } from 'vitest';
import { DriftEvent, Graph, Overview, ReviewItem, ServiceStatus, mockDrift, mockGraph, mockOverview, mockReview, mockStatus } from './index.js';

describe('mock data matches the contracts', () => {
  it('graph', () => expect(Graph.parse(mockGraph())).toBeTruthy());
  it('overview', () => expect(Overview.parse(mockOverview())).toBeTruthy());
  it('status', () => mockStatus().forEach((s) => ServiceStatus.parse(s)));
  it('drift', () => mockDrift().forEach((d) => DriftEvent.parse(d)));
  it('review', () => mockReview().forEach((r) => ReviewItem.parse(r)));
});
