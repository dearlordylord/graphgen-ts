import { Prism } from 'monocle-ts';
import { pipe } from 'fp-ts/function';
import { getFromOptionC } from './option';

export const castToPrism =
  <From, To>(p: Prism<From, To>) =>
  (e?: ((v: From) => string) | string) =>
  (v: From): To =>
    pipe(
      v,
      p.getOption,
      getFromOptionC(typeof e === 'string' ? e : e ? e(v) : `Invalid cast, value not in prism: ${v}`)
    );
