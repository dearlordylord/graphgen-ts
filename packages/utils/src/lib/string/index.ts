import { isNonExistent } from '@firfi/utils/index';

// useful for parsers when we know it's a string but a parser still expects unknown


export const isEmpty = <S extends string>(s: S): s is S & '' => s.length === 0;

// note: change isEmpty(s) and isNonExistent(s) places, see how it doesn't compile (for tech talk)
export const isEmptyOrNA = <S extends string | undefined | null>(s: S): s is S & ('' | null | undefined) =>
  isNonExistent(s) || isEmpty(s);
export const isNonEmptyOrNA = <S extends string | undefined | null>(s: S): s is Exclude<S, '' | null | undefined> =>
  !isEmptyOrNA(s);
export const assertNonEmptyOrNA = <S extends string | undefined | null>(
  s: S,
  e?: string
): Exclude<S, '' | null | undefined> => {
  if (!isNonEmptyOrNA(s)) throw new Error(e || 'Expected non-empty string');
  return s;
};
