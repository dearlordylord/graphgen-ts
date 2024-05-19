import {
  PositiveInteger,
  prismPositiveInteger,
} from 'newtype-ts/lib/PositiveInteger';
import {
  NonNegativeInteger,
  prismNonNegativeInteger,
} from 'newtype-ts/lib/NonNegativeInteger';
import { castToPrism } from './prism';

// I throw; use for unsafe code like tests
export const castPositiveInteger = castToPrism(prismPositiveInteger)(
  (n) => `Invalid cast, integer not positive: ${n}`
);

// I throw; use for unsafe code like tests
export const castNonNegativeInteger = castToPrism(prismNonNegativeInteger)(
  (n) => `Invalid cast, integer is negative or invalid: ${n}`
);

// assumption that prismNonNegativeInteger would work for PositiveInteger, geez...
export const nonNegativeReverseGet = (
  n: NonNegativeInteger | PositiveInteger
): number => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  return prismNonNegativeInteger.reverseGet(n as any);
};
