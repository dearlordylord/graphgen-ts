import { prismNonNegativeInteger } from 'newtype-ts/lib/NonNegativeInteger';
import { prism } from 'newtype-ts';
import { constTrue } from 'fp-ts/function';
import { castToPrism } from '../prism';
import { Index, ListLength } from './types';

export const prismListLength = prismNonNegativeInteger.compose(
  prism<ListLength>(constTrue)
);
export const castListLength = castToPrism(prismListLength)(
  (n) => `Invalid cast, list length: ${n}`
);

export const prismIndex = prismNonNegativeInteger.compose(
  prism<Index>(constTrue)
);
export const castIndex = castToPrism(prismIndex)(
  (n) => `Invalid cast, index: ${n}`
);
