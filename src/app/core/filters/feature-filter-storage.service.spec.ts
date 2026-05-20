import { TestBed } from '@angular/core/testing';

import { FeatureFilterStorageService } from './feature-filter-storage.service';

describe('FeatureFilterStorageService', () => {
  let service: FeatureFilterStorageService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [FeatureFilterStorageService] });
    service = TestBed.inject(FeatureFilterStorageService);
    localStorage.clear();
  });

  afterEach(() => localStorage.clear());

  it('stores and loads filters per account and feature', () => {
    service.setFilters('expenses', 1, { status: 'ACTIVE' });
    service.setFilters('expenses', 2, { status: 'CANCELLED' });
    service.setFilters('analytics', 1, { groupBy: 'MONTH' });

    expect(service.getFilters<{ status: string }>('expenses', 1)).toEqual({ status: 'ACTIVE' });
    expect(service.getFilters<{ status: string }>('expenses', 2)).toEqual({ status: 'CANCELLED' });
    expect(service.getFilters<{ groupBy: string }>('analytics', 1)).toEqual({ groupBy: 'MONTH' });
  });

  it('clears filters for a single feature and account', () => {
    service.setFilters('expenses', 1, { status: 'ACTIVE' });
    service.setFilters('expenses', 2, { status: 'CANCELLED' });

    service.clearFilters('expenses', 1);

    expect(service.getFilters('expenses', 1)).toBeNull();
    expect(service.getFilters<{ status: string }>('expenses', 2)).toEqual({ status: 'CANCELLED' });
  });

  it('ignores invalid JSON without throwing', () => {
    localStorage.setItem('easyFinance.filters.expenses.1', '{broken');

    expect(service.getFilters('expenses', 1)).toBeNull();
    expect(localStorage.getItem('easyFinance.filters.expenses.1')).toBeNull();
  });
});
