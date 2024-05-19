import { prismSeed, Seed } from './types';
import purerand from 'pure-rand';
import { RngState } from '@firfi/graphgen/types';
import { assertExists } from '@firfi/utils/index';

export const rngStateFromSeed = (seed: Seed): RngState => {
  const rng = purerand.xoroshiro128plus(prismSeed.reverseGet(seed));
  return assertExists(
    rng.getState,
    'getState expected on xoroshiro128plus'
  ).bind(rng)();
};
