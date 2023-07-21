import { prism } from 'newtype-ts';
import { Decimal01 } from './types';
import { castToPrism } from '../../prism';
import { NonNegative, prismNonNegative } from 'newtype-ts/lib/NonNegative';
import { apply, constTrue, flow, pipe } from 'fp-ts/function';
import { not } from 'fp-ts/Predicate';

const moreThanOne = (n: number) => n > 1;
const oneOrLess = not(moreThanOne);
const nonNegativeIsDecimal01 = flow(prismNonNegative.reverseGet, oneOrLess);
export const prismDecimal01 = pipe(prism<Decimal01>, apply(nonNegativeIsDecimal01), prismNonNegative.compose);

export const castDecimal01 = castToPrism(prismDecimal01)(
  (n) => `Invalid cast, prismDecimal01 is not in range 0-1: ${n}`
);
