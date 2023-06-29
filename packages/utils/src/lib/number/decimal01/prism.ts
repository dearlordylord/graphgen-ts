import { prism } from 'newtype-ts';
import { Decimal01 } from './types';
import { castToPrism } from '../../prism';
import { prismNonNegative } from 'newtype-ts/lib/NonNegative';
import { constTrue } from 'fp-ts/function';

export const isNot01 = (n: number) => n < 0 || n > 1;

export const prismDecimal01 = prismNonNegative.compose(prism<Decimal01>(constTrue));

export const castDecimal01 = castToPrism(prismDecimal01)(
  (n) => `Invalid cast, prismDecimal01 is not in range 0-1: ${n}`
);
