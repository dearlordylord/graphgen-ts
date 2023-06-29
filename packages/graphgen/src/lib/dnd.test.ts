import { mapDiscreet } from './dnd';
import { castDecimal01 } from '@firfi/utils/number/decimal01/prism';
import { prismNonNegativeInteger } from 'newtype-ts/lib/NonNegativeInteger';

describe('dnd', () => {
  describe('map discreet', () => {
    it('should map 0 to 0', () => {
      expect(prismNonNegativeInteger.reverseGet(mapDiscreet(castDecimal01(0)))).toBe(0);
    });
    it('should map 0.5 to 6', () => {
      expect(prismNonNegativeInteger.reverseGet(mapDiscreet(castDecimal01(0.5)))).toBe(6);
    });
    it('should map 1 to 13', () => {
      expect(prismNonNegativeInteger.reverseGet(mapDiscreet(castDecimal01(1)))).toBe(13);
    });
  });
});
