import { enumLabel } from './enum-labels';

describe('enumLabel', () => {
  it('translates known enum values to spanish labels', () => {
    expect(enumLabel('ACTIVE')).toBe('Activo');
    expect(enumLabel('ACCOUNT_ADMIN')).toBe('Administrador');
    expect(enumLabel('INSTALLMENT')).toBe('En cuotas');
  });

  it('returns original value when enum label is unknown', () => {
    expect(enumLabel('SOME_FUTURE_ENUM')).toBe('SOME_FUTURE_ENUM');
  });

  it('returns empty string for nullish values', () => {
    expect(enumLabel(null)).toBe('');
    expect(enumLabel(undefined)).toBe('');
  });
});
