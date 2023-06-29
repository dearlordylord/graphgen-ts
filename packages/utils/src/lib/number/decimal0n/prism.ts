import { castToPrism } from '../../prism';
import { prismNonNegative } from 'newtype-ts/lib/NonNegative';
export const prismDecimal0n = prismNonNegative;
export const castDecimal0n = castToPrism(prismDecimal0n)(
  (n) => `Invalid cast, prismDecimal0n is not in range 0+: ${n}`
);
