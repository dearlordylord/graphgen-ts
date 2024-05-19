import { flow } from 'fp-ts/function';
import * as ST from 'fp-ts/State';
import { State } from 'fp-ts/State';
import * as TU from 'fp-ts/Tuple';
import { castRandom01, Random01 } from './index';
import purerand from 'pure-rand';
import { assertExists } from '@firfi/utils/index';
import { RngState } from '@firfi/graphgen/types';
import { intTo01 } from '@firfi/utils/number/decimal01/utils';
import { castInteger } from '@firfi/utils/number/integer';

export const random = flow(
  ST.gets((state) => purerand.xoroshiro128plus.fromState(state)),
  TU.fst,
  (rng) => {
    const [next, rng1] = rng.next();
    return [castRandom01(intTo01(castInteger/*accommodate to initial expectations of 01 from previously used library*/(next))), assertExists(rng1.getState, 'xoroshiro supposed to have getState()').bind(rng1)()] as [Random01, RngState]
  },
) satisfies State<RngState, Random01>;
