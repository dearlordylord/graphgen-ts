import { isNone, Option } from 'fp-ts/Option';

export const getFromOptionC =
  <E extends Error = Error>(e?: string | (() => E)) =>
  <A>(o: Option<A>): A => {
    if (isNone(o)) {
      if (typeof e === 'function') throw e();
      throw new Error(e || 'panic! getFromOption: None');
    }
    return o.value;
  };
