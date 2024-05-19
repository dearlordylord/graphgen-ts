import { Seed } from '@firfi/utils/rng/seed/types';
import { defGenerateGraph, GraphGeneratorSettingsInput } from './index';
import * as STR from 'fp-ts-stream/Stream';
import { GraphStreamOp, RngState } from './types';
import { absurd, flow, pipe } from 'fp-ts/function';
import { rngStateFromSeed } from '@firfi/utils/rng/seed/seed';
import { AnonymizedIdentityState, getRandomIdentityForNumber } from '@firfi/utils/identity/utils';
import * as ST from 'fp-ts/State';
import { State } from 'fp-ts/State';
import { isoSeed } from '@firfi/utils/rng/seed/iso';
import * as RE from 'fp-ts/Reader';
import { Reader } from 'fp-ts/Reader';
import { Index, ListLength } from '@firfi/utils/list/types';
import { match } from 'ts-pattern';
import * as A from 'fp-ts/Array';
import { prismIndex } from '@firfi/utils/list/prisms';
import { AdjacencyList } from '@firfi/utils/graph/adjacencyList';
import { BiMap } from '@rimbu/bimap';
import { fromEntries } from '@firfi/utils/object';
import { assertExists } from '@firfi/utils/index';
import { hash } from '@firfi/utils/string';

const getRandomIdentityForIndex = flow(prismIndex.reverseGet, getRandomIdentityForNumber);
const getRandomIdentityForIndexPair = flow(
  A.map(getRandomIdentityForIndex),
  A.sequence(ST.Applicative),
  ST.map(([a, b]) => [a, b])
) satisfies Reader<[Index, Index], State<AnonymizedIdentityState, [string, string]>>;
const getRandomIdentityForGraphOp = flow(
  RE.ask(),
  (op) => match(op),
  (m) =>
    m.with({ op: 'addNode' }, (v) =>
      pipe(
        getRandomIdentityForIndex(v.id),
        ST.map((id) => ({ ...v, id }))
      )
    ),
  (m) =>
    m.with({ op: 'addEdge' }, (v) =>
      pipe(
        getRandomIdentityForIndexPair([v.from, v.to]),
        ST.map(([from, to]) => ({ ...v, from, to }))
      )
    ),
  (m) => m.exhaustive()
) satisfies Reader<GraphStreamOp, State<AnonymizedIdentityState, GraphStreamOp<string>>>;
export type GraphStreamState = { edgesLeft: ListLength; totalEdges: ListLength };

export type GraphStreamElement<RNGSTATE = RngState> = [GraphStreamOp<string>, GraphStreamState, RNGSTATE];

const uuidRngSeed = hash('uuidRngSeed');

export const getRandomGraph =
  (seed: Seed) =>
  <RNGSTATE = RngState>(settings: GraphGeneratorSettingsInput): STR.Stream<GraphStreamElement<RNGSTATE>> =>
    pipe(
      seed,
      rngStateFromSeed,
      defGenerateGraph(settings),
      STR.map(
        ([op, state, seed0]) =>
          ((uuidState: AnonymizedIdentityState) => {
            // TODO ST.map / .chain
            const [op1, uuidState1] = getRandomIdentityForGraphOp(op)(uuidState);
            return [[op1, state, seed0], uuidState1];
          }) as State<AnonymizedIdentityState, [GraphStreamOp<string>, GraphStreamState, RNGSTATE]>
      ),
      (states) => {
        // TODO https://github.com/incetarik/fp-ts-stream/issues/3 should be .sequence(ST.Applicative)
        let state = {
          identityMap: {},
          rng: rngStateFromSeed(isoSeed.from(uuidRngSeed)), // we use a new rng for more "stable" uuids generation
        };
        return STR.comprehension([states], (s) => {
          const [r, s1] = s(state);
          state = s1;
          return r;
        });
      }
    );

export type AdjacencyListWithMeta<M = string /*TODO uuid*/> = readonly [AdjacencyList, { [n in number]: M }];

export type FinalizedGraphEvent =
  | { type: 'step'; streamState: GraphStreamState }
  | { type: 'end'; graph: AdjacencyListWithMeta };

export const getRandomFinalizedGraph =
  (seed: Seed) =>
  (settings: GraphGeneratorSettingsInput): STR.Stream<FinalizedGraphEvent> => {
    const adjList = new AdjacencyList();
    let bimapMeta = BiMap.empty<number, string>();
    let nextId = 0;
    return pipe(
      getRandomGraph(seed)(settings),
      (str) =>
        STR.comprehension([str], (e) => {
          const [op, streamState, randomState] = e;
          if (op.op === 'addNode') {
            if (bimapMeta.hasValue(op.id)) throw new Error(`panic! duplicate id ${op.id}`);
            bimapMeta = bimapMeta.set(nextId, op.id);
            adjList.addVertex(nextId);
            nextId++;
          } else if (op.op === 'addEdge') {
            const from = assertExists(bimapMeta.getKey(op.from), `panic! missing vertex id ${op.from}`);
            const to = assertExists(bimapMeta.getKey(op.to), `panic! missing vertex id ${op.to}`);
            adjList.addEdge(from, to);
          } else {
            absurd(op);
            throw new Error('unreachable');
          }
          return {
            type: 'step' as const,
            streamState,
          };
        }),
      STR.concatW(
        pipe(
          STR.of(undefined),
          STR.map(() => ({ type: 'end' as const, graph: [adjList, fromEntries(bimapMeta.toArray())] as const }))
        )
      )
    );
  };
