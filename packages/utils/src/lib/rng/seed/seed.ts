import seedrandom, { State as RngState } from 'seedrandom';
import { isoSeed } from './iso';
import type { Seed } from './types';

export const rngStateFromSeed = (seed: Seed): RngState.Arc4 =>
  seedrandom(isoSeed.get(seed), {
    state: true,
  }).state();
