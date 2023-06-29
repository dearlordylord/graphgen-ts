import { flow } from 'fp-ts/function';
import * as ST from 'fp-ts/State';
import { State } from 'fp-ts/State';
import seedrandom, { State as RngState } from 'seedrandom';
import * as TU from 'fp-ts/Tuple';
import { castRandom01, Random01 } from './index';

export const random = flow(
  ST.gets((state) =>
    seedrandom(undefined, {
      state,
    })
  ),
  TU.fst,
  (rng) => [castRandom01(rng()), rng.state()] as [Random01, RngState.Arc4]
) satisfies State<RngState.Arc4, Random01>;
