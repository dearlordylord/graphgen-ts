import { State } from 'fp-ts/State';

export const mapStream = <T, U>(f: (x: T) => U) => (g: () => Generator<T>): () => Generator<U> => {
  return function* (): Generator<U> {
    for (const x of g()) {
      yield f(x);
    }
  };
};
export const applyStatesStream = <S>(computationState: S) => <R>(states: () => Generator<State<S, R>>) => {
  // TODO https://github.com/incetarik/fp-ts-stream/issues/3 should be .sequence(ST.Applicative)
  return function* (): Generator<R> {
    let state = computationState;
    for (const s of states()) {
      const [r, s1] = s(state);
      state = s1;
      yield r;
    }
  };
};
export const appendStream = <T>(y: T) => (g: () => Generator<T>): () => Generator<T> => {
  return function* (): Generator<T> {
    for (const x of g()) {
      yield x;
    }
    yield y;
  };
};

export const streamToArray = <T>(g: () => Generator<T>): T[] => {
  const result: T[] = [];
  for (const x of g()) {
    result.push(x);
  }
  return result;
}
