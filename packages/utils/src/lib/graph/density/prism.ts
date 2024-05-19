import { castToPrism } from '../../prism';
import { prism } from 'newtype-ts';
import { prismDecimal01 } from '../../number/decimal01/prism';
import { Density } from './types';
import { constTrue } from 'fp-ts/function';

export const prismDensity = prismDecimal01.compose(prism<Density>(constTrue));
export const castDensity = castToPrism(prismDensity)(
  (n) => `Invalid cast, density is not in range 0-1: ${n}`
);
