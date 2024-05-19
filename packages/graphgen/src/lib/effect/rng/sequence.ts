import {
  Effect,
  Context,
  Layer,
  Stream,
  Sink,
  pipe,
  Chunk,
  Clock,
  HashMap,
  Option,
  FiberSet,
} from 'effect';
import prand from 'pure-rand';
import { v4 } from 'uuid';
import { AdjacencyList } from '@firfi/utils/graph/adjacencyList';
import { NonNegative } from 'newtype-ts/lib/NonNegative';
import { PositiveInteger } from 'newtype-ts/lib/PositiveInteger';
import { NonNegativeInteger } from 'newtype-ts/lib/NonNegativeInteger';
import { DegreeFunction, nlpa, nlpa_ } from '../../distribution';
import { castRandom01 } from '@firfi/utils/rng';
import {
  addEdge,
  addNode,
  defaultSettings,
  defaultSettingsInput,
  GraphGeneratorSettingsInput,
  link,
  link_,
  paramsFromSettings_,
} from '../../index';
import {
  castIndex,
  castListLength,
  prismIndex,
  prismListLength,
} from '@firfi/utils/list/prisms';
import { isNone } from 'fp-ts/Option';
import { absurd, apply, flow } from 'fp-ts/function';
import {
  castNonNegativeInteger,
  castPositiveInteger,
} from '@firfi/utils/positiveInteger';
import { scaleNLPAHeterogeneity } from '../../barabasiAlbert';
import { GraphStreamOp, RngState } from '@firfi/graphgen/types';
import { intTo01 } from '@firfi/utils/number/decimal01/utils';
import { castInteger } from '@firfi/utils/number/integer';
import { assertExists } from '@firfi/utils/index';
import { rngStateFromSeed } from '@firfi/utils/rng/seed/seed';
import { castSeed } from '@firfi/utils/rng/seed/types';

// to eliminate the connaiscence of random generator algorithms
const randomFromState = (state: RngState) =>
  prand.xoroshiro128plus.fromState(state);
const stateFromSeed = rngStateFromSeed;

export class Random extends Context.Tag('Random')<
  Random,
  {
    readonly next: Effect.Effect<number>;
    surface: () => RngState /*TODO something with scope*/;
    dive: (state: RngState) => void;
  }
>() {
  static Live = (seed: number) => {
    let rng = pipe(seed, castSeed, stateFromSeed, randomFromState);
    return Layer.succeed(
      Random,
      Random.of({
        next: Effect.sync(() => {
          const [next, rng1] = rng.next();
          rng = rng1;
          return next;
        }),
        surface: () =>
          assertExists(
            rng.getState,
            'xoroshiro supposed to have getState()'
          ).bind(rng)(),
        dive: (state) => {
          rng = prand.xoroshiro128plus.fromState(state);
        },
      })
    );
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
    return Layer.succeed(
      UuidMemory,
      UuidMemory.of({
        put: (id, v) => {
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
        get: (id) => HashMap.get(id)(map),
      })
    );
  };
}

export const randomIntEffect = Effect.gen(function* () {
  const random = yield* Random;
  return yield* random.next;
});

// scale the random number to [0, 1); no negatives
export const random01Effect = Effect.map(
  randomIntEffect,
  flow(castInteger, intTo01)
);

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

export const nlpaEffect =
  (alpha: NonNegative) =>
  ({
    totalNodes,
    getDegree,
    totalEdges,
  }: {
    totalNodes: PositiveInteger;
    getDegree: DegreeFunction;
    totalEdges: NonNegativeInteger;
  }) =>
    random01Effect.pipe(
      Effect.map(castRandom01),
      Effect.flatMap((r) =>
        Effect.gen(function* () {
          const random = yield* Random;
          const state0 = random.surface();

          const [i, state1] = nlpa(alpha)({
            totalEdges,
            totalNodes,
            getDegree,
          })(state0);

          random.dive(state1);

          return i;
        })
      )
    );

export const graphStream = (
  settings: GraphGeneratorSettingsInput = defaultSettingsInput
) => {
  const {
    edgeCount,
    gravitate: gravitate,
    nodeCount,
  } = paramsFromSettings_({ ...defaultSettings, ...settings });
  const scaledNLPAHeterogeneity = scaleNLPAHeterogeneity(
    settings.heterogeneity || defaultSettings.heterogeneity
  );
  const totalEdges = edgeCount;
  const totalEdges_ = prismListLength.reverseGet(edgeCount);
  return Stream.unfoldEffect(
    {
      graph: new AdjacencyList(),
      nextVertexId: castIndex(0),
      totalEdges,
      edgesLeft: totalEdges,
    },
    (
      s
    ): Effect.Effect<
      Option.Option<[GraphStreamOp, typeof s]>,
      never,
      Random
    > => {
      const getEdgesLeft = () =>
        castListLength(totalEdges_ - s.graph.numEdges());
      return Effect.gen(function* () {
        if (prismListLength.reverseGet(getEdgesLeft()) < 0)
          return Option.none();
        const random = yield* Random;
        const state0 = random.surface();
        // again, reactive streams would be nice here
        // eslint-disable-next-line no-constant-condition
        const [r, state1] = link(s)({
          targetNodeCount: nodeCount,
          targetEdgeCount: edgeCount,
        })(
          flow(
            (
              l: Pick<
                AdjacencyList,
                'numVertices' | 'numEdges' | 'degree'
              > /*TODO NonEmpty version?*/
            ) => ({
              totalEdges: castNonNegativeInteger(l.numEdges()),
              totalNodes: castPositiveInteger(l.numVertices()),
              getDegree: flow(
                prismIndex.reverseGet,
                l.degree.bind(l),
                castNonNegativeInteger
              ),
            }),
            nlpa_(scaledNLPAHeterogeneity)
          )
        )(state0);

        if (isNone(r)) return Option.none();
        const ops = r.value;
        for (const op of ops) {
          switch (op.op) {
            case 'addNode':
              addNode(s.graph)(op.id);
              s.nextVertexId = castIndex(prismIndex.reverseGet(op.id) + 1);
              // return Option.some([op, { edgesLeft: getEdgesLeft(), totalEdges }]);
              return Option.some([
                op,
                { ...s, edgesLeft: getEdgesLeft(), totalEdges },
              ]);
            case 'addEdge':
              addEdge(s.graph)(op.from, op.to);
              // return Option.some([op, { edgesLeft: getEdgesLeft(), totalEdges }]);
              return Option.some([
                op,
                { ...s, edgesLeft: getEdgesLeft(), totalEdges },
              ]);
            default:
              absurd(op);
          }
        }
        throw new Error('unreachable');
      });
    }
  );
};

/*
(l: Pick<AdjacencyList, 'numVertices' | 'numEdges' | 'degree'>) => ({
  totalEdges: castNonNegativeInteger(l.numEdges()),
  totalNodes: castPositiveInteger(l.numVertices()),
  getDegree: flow(prismIndex.reverseGet, l.degree.bind(l), castNonNegativeInteger),
}),
 */

// const program = Stream.repeatEffect(uuidEffect);
// const program = Stream.range(1, 10).pipe(Stream.concat(Stream.range(1, 10))).pipe(Stream.rechunk(2)).pipe(Stream.chunks).pipe(Stream.flatMap(c => uuidForPairEffect(uuidEffect)(Chunk.unsafeGet(0)(c), Chunk.unsafeGet(1)(c))));

const prints = Stream.run(
  graphStream(),
  Sink.forEach((r) => Effect.sync(() => console.log(r)))
);

const runnable = Effect.provide(
  prints,
  Layer.merge(Random.Live(42), UuidMemory.Live())
);

Effect.runPromise(runnable);
