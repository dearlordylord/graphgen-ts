import {
  Effect,
  Context,
  Stream,
  Sink,
  pipe,
  Chunk,
  HashMap,
  Option,
  Runtime
} from 'effect';
import prand from 'pure-rand';
import { v4 } from 'uuid';
import { castRandom01, Random01 } from '@firfi/utils/rng';
import {
  defaultSettingsInput, defGenerateGraph, GraphGeneratorItem,
  GraphGeneratorSettingsInput,
} from '../../index';
import { flow } from 'fp-ts/function';
import { RngState } from '@firfi/graphgen/types';
import { intTo01 } from '@firfi/utils/number/decimal01/utils';
import { castInteger } from '@firfi/utils/number/integer';
import { assertExists } from '@firfi/utils/index';
import { rngStateFromSeed } from '@firfi/utils/rng/seed/seed';
import { castSeed } from '@firfi/utils/rng/seed/types';
import * as TU from 'fp-ts/Tuple';

// to eliminate the connaiscence of random generator algorithms
const randomFromState = (state: RngState) =>
  prand.xoroshiro128plus.fromState(state);
const stateFromSeed = rngStateFromSeed;

export class Random extends Context.Tag('Random')<
  Random,
  {
    readonly getState: Effect.Effect<RngState>;
    readonly next: Effect.Effect<number>;
    readonly nextStateful: (state: RngState) => Effect.Effect<[number, RngState]>;
  }
>() {
  static Live = (seed: number) => {
    let rng = pipe(seed, castSeed, stateFromSeed, randomFromState);
    const getState = (rng_: typeof rng): RngState => assertExists(rng_.getState, 'getState supposed to be here').bind(rng_)();
    return {
      getState: Effect.sync(() => getState(rng)),
      next: Effect.sync(() => {
        const [next, rng1] = rng.next();
        rng = rng1;
        return next;
      }),
      // asserts state state is not desynchronized
      nextStateful: (state: RngState) => Effect.sync((): [number, RngState] => {
          const currentState = getState(rng);
          // compare two number[] arrays
          for (let i = 0; i < currentState.length; i++) {
            if (currentState[i] !== state[i]) {
              throw new Error('nextStateful: state mismatch');
            }
          }
          const [next, rng1] = rng.next();
          rng = rng1;
          return [next, getState(rng)];
        }
      )
    }
  };
}

export class UuidMemory extends Context.Tag('UuidMemory')<
  UuidMemory,
  {
    readonly put: (
      id: number,
      v: string
    ) => 'existsDifferent' | 'exists' | 'ok';
    readonly get: (id: number) => Option.Option<string>;
  }
>() {
  static Live = () => {
    let map = HashMap.empty<number, string>();
    return {
      put: (id: number, v: string) => {
        const existing = HashMap.get(id)(map);
        switch (existing._tag) {
          case 'None': {
            map = HashMap.set(id, v)(map);
            return 'ok';
          }
          case 'Some': {
            if (existing.value === v) {
              return 'exists';
            } else {
              return 'existsDifferent';
            }
          }
        }
      },
      get: (id: number) => HashMap.get(id)(map),
    };
  };
}

export const randomIntEffect = Effect.gen(function* () {
  const random = yield* Random;
  return yield* random.next;
});

export const randomIntStatefulEffect = (state: RngState) => Effect.gen(function* () {
  const random = yield* Random;
  return yield* random.nextStateful(state)
});

// scale the random number to [0, 1); no negatives
export const random01Effect = Effect.map(
  randomIntEffect,
  flow(castInteger, intTo01)
);

export const random01StatefulEffect = (state: RngState) =>
  Effect.map(randomIntStatefulEffect(state), TU.mapFst(flow(castInteger, intTo01)));

export const random01TypedEffect = Effect.map(random01Effect, castRandom01);

export const random01TypedStatefulEffect = (state: RngState) =>
  Effect.map(random01StatefulEffect(state), TU.mapFst(castRandom01));

export const random0255Effect = Effect.map(random01Effect, (n) =>
  Math.floor(n * 256)
);

export const random16255Effect = Stream.run(
  Stream.repeatEffect(random0255Effect),
  Sink.collectAllN(16)
);

export const uuidEffect = Effect.map(random16255Effect, (c) =>
  v4({
    random: Chunk.toArray(c),
  })
);

export const uuidForIndexEffect =
  (uuidEffect: Effect.Effect<string, never, Random>) => (i: number) =>
    Effect.gen(function* () {
      const uuidMemory = yield* UuidMemory;
      const existing = uuidMemory.get(i);
      if (Option.isSome(existing)) {
        return existing.value;
      } else {
        const uuid = yield* uuidEffect;
        const res = uuidMemory.put(i, uuid);
        if (res !== 'ok') {
          throw new Error(`uuidForIndexEffect: unexpected ${res}`);
        }
        return uuid;
      }
    });

export const uuidForPairEffect =
  (uuidEffect: Effect.Effect<string, never, Random>) =>
  (i: number, j: number) =>
    Effect.gen(function* () {
      const generate = uuidForIndexEffect(uuidEffect);
      if (i === j) {
        console.warn('uuidForPairEffect: i === j', i, j);
      }
      const x = yield* generate(i);
      const y = yield* generate(j);
      return [x, y] as const;
    });

export const graphStream = (
  settings: GraphGeneratorSettingsInput = defaultSettingsInput
): Stream.Stream<GraphGeneratorItem, never, Random> => Stream.fromIterableEffect(Effect.gen(function* () {
  const random = yield* Random;
  // recommendation https://discord.com/channels/795981131316985866/1241860145286348860/1241861616686071890
  const runtime = yield* Effect.runtime<Random>()
  const runSync = Runtime.runSync(runtime);
  const state0 = yield* random.getState;
  const getRandom = (state: RngState): [Random01, RngState] => runSync(random01TypedStatefulEffect(state));
  return defGenerateGraph(settings)(getRandom)(state0)();
}));

const prints = Stream.run(
  graphStream(),
  Sink.forEach((r) => Effect.sync(() => console.log(r)))
);

const runnable = prints.pipe(
  Effect.provideService(Random, Random.Live(42)),
  Effect.provideService(UuidMemory, UuidMemory.Live())
);

Effect.runPromise(runnable);
