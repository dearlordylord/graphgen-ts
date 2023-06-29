import { castToPrism } from '../../prism';
import { prismPositive } from 'newtype-ts/lib/Positive';
export const prismDecimal1n = prismPositive;
export const castDecimal1n = castToPrism(prismDecimal1n)(
  (n) => `Invalid cast, prismDecimal1n is not in range 1+: ${n}`
);
