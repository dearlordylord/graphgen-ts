import isNil from 'lodash/isNil';

export const assertExists = <T>(x: T | null | undefined, msg?: string): T => {
  if (isNonExistent(x)) {
    throw new Error(msg || 'Expected value to be defined');
  }
  return x;
};

export const isNonExistent = <T>(
  x: T | null | undefined
): x is null | undefined => !isExistent(x);
export const isExistent = <T>(x: T | null | undefined): x is T => !isNil(x);
