import { prism } from 'newtype-ts';
import { Heterogeneity } from './types';
import { prismDecimal01 } from '../../number/decimal01/prism';
import { castToPrism } from '../../prism';
import { constTrue } from 'fp-ts/function';

export const prismHeterogeneity = prismDecimal01.compose(
  prism<Heterogeneity>(constTrue)
);
export const castHeterogeneity = castToPrism(prismHeterogeneity)(
  (n) => `Invalid cast, heterogeneity is not in range 0-1: ${n}`
);
