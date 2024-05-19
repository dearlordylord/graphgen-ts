import {
  castDecimal01,
  prismDecimal01,
} from '@firfi/utils/number/decimal01/prism';

describe('decimal01', () => {
  test('cant be less than 0', () => {
    expect(() => castDecimal01(-0.1)).toThrow();
  });
  test('cant be more than 1', () => {
    expect(() => castDecimal01(1.1)).toThrow();
  });
  test('can be something in between', () => {
    expect(prismDecimal01.reverseGet(castDecimal01(0.5))).toBe(0.5);
  });
});
