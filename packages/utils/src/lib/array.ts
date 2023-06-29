
import { NonNegativeInteger, prismNonNegativeInteger } from 'newtype-ts/lib/NonNegativeInteger';
import * as O from 'fp-ts/Option';
import { isNone, none, Option, some } from 'fp-ts/Option';
import { fromArray, NonEmptyArray } from 'fp-ts/NonEmptyArray';
import { castNonNegativeInteger } from './positiveInteger';

export const ZERO = castNonNegativeInteger(0);
export const getIthO =
  (iN: NonNegativeInteger) =>
  <T>(a: T[] | readonly T[]): Option<T> => {
    const i = prismNonNegativeInteger.reverseGet(iN);
    if (a.length <= i) return none;
    return some(a[i]);
  };
export const getIth =
  (iN: NonNegativeInteger, e0?: string) =>
  <T>(a: T[] | readonly T[], e?: string): T => {
    const i = prismNonNegativeInteger.reverseGet(iN);
    const r = getIthO(iN)(a);
    if (isNone(r)) throw new Error(e || e0 || `getIth expects ${i} elements, got ${a.length}`);
    return a[i];
  };
export const getIthC =
  (i: NonNegativeInteger, e0?: string) =>
  (e?: string) =>
  <T>(a: T[] | readonly T[]) =>
    getIth(i, e0)(a, e);
getIth(ZERO, 'panic! getFirst expects > 0 elements, got 0');
getIthC(ZERO, 'panic! getFirst expects > 0 elements, got 0');
getIthO(ZERO);


export const assertNonEmptyC =
  (e = 'assertNonEmpty expects non-empty array') =>
  <T>(a: T[]): NonEmptyArray<T> => {
    const r = fromArray(a);
    if (O.isNone(r)) throw new Error(e);
    return r.value;
  };
assertNonEmptyC();


// parametrised RNA.groupBy; not safe for finite amount of keys

// parametrised NA.groupBy; not safe for finite amount of keys


export const castNonEmptyArray = <T>(a: T[], e?: string) => castNonEmptyArrayC(e)(a);
export const castNonEmptyArrayC =
  (e?: string) =>
  <T>(a: T[]): NonEmptyArray<T> => {
    if (a.length === 0) throw new Error(e || 'castNonEmptyArray expects non-empty array');
    return a as NonEmptyArray<T>;
  };

