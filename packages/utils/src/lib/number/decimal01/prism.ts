import { prism } from 'newtype-ts';
import { Decimal01 } from './types';
import { castToPrism } from '../../prism';
import { NonNegative, prismNonNegative } from 'newtype-ts/lib/NonNegative';
import { constTrue, flow } from 'fp-ts/function';
import { not } from 'fp-ts/Predicate';

export const isNot01 = (n: number) => n < 0 || n > 1;
export const is01 = not(isNot01);
export const nonNegativeIsDecimal01 = flow(prismNonNegative.reverseGet, is01);
export const prismDecimal01 = prismNonNegative.compose(prism<Decimal01>(nonNegativeIsDecimal01));

export const castDecimal01 = castToPrism(prismDecimal01)(
  (n) => `Invalid cast, prismDecimal01 is not in range 0-1: ${n}`
);
