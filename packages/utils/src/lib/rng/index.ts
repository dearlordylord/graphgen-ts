import { Newtype, prism } from 'newtype-ts';
import { flow } from 'fp-ts/function';
import { castDecimal01, prismDecimal01 } from '../number/decimal01/prism';
import { Decimal01 } from '../number/decimal01/types';
import { castToPrism } from '../prism';

export type Random01 = Newtype<{ readonly RANDOM01: unique symbol }, Decimal01>;


export const prismRandom01 = prismDecimal01.compose(prism<Random01>(flow(prismDecimal01.reverseGet, (n) => n < 1)));
export const castRandom01 = castToPrism(prismRandom01)((n) => `Invalid cast, prismRandom01 is not in range 0-1: ${n}`);

export const unwrapDecimal01 = flow(prismRandom01.reverseGet, castDecimal01);

export const wrapDecimal01 = flow(prismDecimal01.reverseGet, castRandom01);
