/// <reference lib="webworker" />

import { pipe } from 'fp-ts/function';
import { Seed } from '@firfi/utils/rng/seed/types';
import { GraphGeneratorSettingsInput } from '@firfi/graphgen/index';
import { getRandomFinalizedGraph } from '@firfi/graphgen/getRandomGraph';
import { random } from '@firfi/utils/rng/random';
import { mapStream, streamToArray } from '@firfi/utils/stream';

// terminate with .terminate()?
onmessage = (
  e: MessageEvent<{
    seed: Seed;
    settings: GraphGeneratorSettingsInput;
  }>
) => {
  pipe(
    getRandomFinalizedGraph(e.data.seed)(e.data.settings)(random),
    mapStream((e) => {
      postMessage(e);
    }),
    streamToArray
  );
};
