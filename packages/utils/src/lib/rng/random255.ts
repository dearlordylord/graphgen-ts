import { NonNegativeInteger, prismNonNegativeInteger } from 'newtype-ts/lib/NonNegativeInteger';
import { Newtype, prism } from 'newtype-ts';
import { flow, pipe } from 'fp-ts/function';
import { prismRandom01 } from './index';
import * as ST from 'fp-ts/State';
import { castToPrism } from '../prism';
import { random } from './random';

export type Random0255 = Newtype<{ readonly RANDOM0255: unique symbol }, NonNegativeInteger>;

export const prismRandom0255 = prismNonNegativeInteger.compose(
  prism<Random0255>(flow(prismNonNegativeInteger.reverseGet, (n) => n >= 0 && n <= 255))
);
export const castRandom0255 = castToPrism(prismRandom0255)(
  (n) => `Invalid cast, castRandom0255 is not in range 0-255: ${n}`
);
export const random0255 = pipe(
  random,
  ST.map(flow(prismRandom01.reverseGet, (n) => Math.floor(n * 256), castRandom0255))
);
