/// <reference lib="webworker" />

import { pipe } from 'fp-ts/function';
import * as STR from 'fp-ts-stream/Stream';
import { Seed } from '@firfi/utils/rng/seed/types';
import { GraphGeneratorSettingsInput } from '@firfi/graphgen/index';
import { getRandomFinalizedGraph } from '@firfi/graphgen/getRandomGraph';
import { random } from '@firfi/utils/rng/random';

// terminate with .terminate()?
onmessage = (
  e: MessageEvent<{
    seed: Seed;
    settings: GraphGeneratorSettingsInput;
  }>
) => {
  pipe(
    getRandomFinalizedGraph(e.data.seed)(e.data.settings)(random),
    STR.map((e) => {
      postMessage(e);
    }),
    STR.toArray
  );
};
