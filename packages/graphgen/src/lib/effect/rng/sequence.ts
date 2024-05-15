import { Effect, Context, Layer, Stream, Sink, pipe, Chunk, Clock, HashMap, Option } from 'effect';
import prand from 'pure-rand';
import { v4 } from 'uuid';
import { monotonicFactory } from 'ulidx';



export class Random extends Context.Tag("Random")<
  Random,
  { readonly next: Effect.Effect<number> }
>() {
  static Live = (seed: number) => {
    let rng = prand.xoroshiro128plus(seed);
    return Layer.succeed(
      Random,
      Random.of({
        next: Effect.sync(() => {
          const [next, rng1] = rng.next();
          rng = rng1;
          return next;
        })
      })
    )
  }
}

export class UuidMemory extends Context.Tag("UuidMemory")<
  UuidMemory,
  { readonly put: (id: number, v: string) => 'existsDifferent' | 'exists' | 'ok', readonly get: (id: number) => Option.Option<string> }
>() {
  static Live = () => {
    let map = HashMap.empty<number, string>();
    return Layer.succeed(
      UuidMemory,
      UuidMemory.of({
        put: (id, v) => {
          const existing = HashMap.get(id)(map);
          switch(existing._tag) {
            case 'None': {
              map = HashMap.set(id, v)(map);
              return 'ok';
            }
            case 'Some': {
              if(existing.value === v) {
                return 'exists';
              } else {
                return 'existsDifferent';
              }
            }
          }
        },
        get: (id) => HashMap.get(id)(map)

      })
    );
  }}

export const randomIntEffect = Effect.gen(function* () {
  const random = yield* Random
  return yield* random.next;
});

// scale the random number to [0, 1); no negatives
export const random01Effect = Effect.map(randomIntEffect, n => (n >>> 0) / 0x100000000);

export const random0255Effect = Effect.map(random01Effect, n => Math.floor(n * 256));

export const random16255Effect = Stream.run(Stream.repeatEffect(random0255Effect), Sink.collectAllN(16));

export const uuidEffect = Effect.map(random16255Effect, c => v4({
  random: Chunk.toArray(c)
}));

export const uuidForIndexEffect = (uuidEffect: Effect.Effect<string, never, Random>) => (i: number) => Effect.gen(function* () {
  const uuidMemory = yield* UuidMemory;
  const existing = uuidMemory.get(i);
  if (Option.isSome(existing)) {
    return existing.value;
  } else {
    const uuid = yield* uuidEffect;
    const res = uuidMemory.put(i, uuid);
    if (res !== 'ok') {
      // TODO Defect?
      throw new Error(`uuidForIndexEffect: unexpected ${res}`);
    }
    return uuid;
  }
});

export const uuidForPairEffect = (uuidEffect: Effect.Effect<string, never, Random>) => (i: number, j: number) => Effect.gen(function* () {
  const generate = uuidForIndexEffect(uuidEffect);
  if (i === j) {
    console.warn('uuidForPairEffect: i === j', i, j);
  }
  const x = yield* generate(i);
  const y = yield* generate(j);
  return [x, y] as const;
});

// const program = Stream.repeatEffect(uuidEffect);
const program = Stream.range(1, 10).pipe(Stream.concat(Stream.range(1, 10))).pipe(Stream.rechunk(2)).pipe(Stream.chunks).pipe(Stream.flatMap(c => uuidForPairEffect(uuidEffect)(Chunk.unsafeGet(0)(c), Chunk.unsafeGet(1)(c))));

const prints = Stream.run(program, Sink.forEach(r => Effect.sync(() => console.log(r))));

const runnable = Effect.provide(prints, Layer.merge(Random.Live(42), UuidMemory.Live()));

Effect.runPromise(runnable);
