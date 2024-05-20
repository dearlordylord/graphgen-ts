import { castSeed, Seed } from '@firfi/utils/rng/seed/types';
import { defGenerateGraph, GraphGeneratorSettingsInput } from './index';
import { GraphStreamOp, RngState } from './types';
import { absurd, flow, pipe } from 'fp-ts/function';
import { rngStateFromSeed } from '@firfi/utils/rng/seed/seed';
import { AnonymizedIdentityState, getRandomIdentityForNumber } from '@firfi/utils/identity/utils';
import * as ST from 'fp-ts/State';
import { State } from 'fp-ts/State';
import * as RE from 'fp-ts/Reader';
import { Reader } from 'fp-ts/Reader';
import * as RA from 'fp-ts/ReadonlyArray';
import { Index, ListLength } from '@firfi/utils/list/types';
import { match } from 'ts-pattern';
import * as A from 'fp-ts/Array';
import { prismIndex } from '@firfi/utils/list/prisms';
import { AdjacencyList } from '@firfi/utils/graph/adjacencyList';
import { BiMap } from '@rimbu/bimap';
import { fromEntries } from '@firfi/utils/object';
import { assertExists } from '@firfi/utils/index';
import { hash } from '@firfi/utils/string';
import { Random01 } from '@firfi/utils/rng';
import { appendStream, applyStatesStream, mapStream } from '@firfi/utils/stream';

const getRandomIdentityForIndex = flow(
  prismIndex.reverseGet,
  getRandomIdentityForNumber
);
const getRandomIdentityForIndexPair = flow(
  A.map(getRandomIdentityForIndex),
  RE.sequenceArray,
  RE.map(
    flow(
      RA.sequence(ST.Applicative),
      ST.map(([a, b]) => [a, b] as [string, string])
    )
  ),
  a => a,

) satisfies Reader<[Index, Index], Reader<
  State<RngState, Random01>,
  State<AnonymizedIdentityState, [string, string]>
>>;
const getRandomIdentityForGraphOp = flow(
  RE.ask(),
  (op) => match(op),
  (m) =>
    m.with({ op: 'addNode' }, (v) =>
      pipe(
        getRandomIdentityForIndex(v.id),
        RE.map(ST.map((id) => ({ ...v, id })))
      )
    ),
  (m) =>
    m.with({ op: 'addEdge' }, (v) =>
      pipe(
        getRandomIdentityForIndexPair([v.from, v.to]),
        RE.map(ST.map(([from, to]) => ({ ...v, from, to })))
      )
    ),
  (m) => m.exhaustive()
) satisfies Reader<
  GraphStreamOp,
  Reader<State<RngState, Random01>, State<AnonymizedIdentityState, GraphStreamOp<string>>>
>;
export type GraphStreamState = {
  edgesLeft: ListLength;
  totalEdges: ListLength;
};

export type GraphStreamElement<RNGSTATE = RngState> = [
  GraphStreamOp<string>,
  GraphStreamState,
  RNGSTATE
];

const uuidRngSeed = hash('uuidRngSeed');

export const getRandomGraph =
  (seed: Seed) =>
  <RNGSTATE = RngState>(
    settings: GraphGeneratorSettingsInput
  ) => (random: State<RngState, Random01>): () => Generator<GraphStreamElement<RNGSTATE>> =>
    pipe(
      seed,
      rngStateFromSeed,
      defGenerateGraph(settings)(random),
      mapStream(
        ([op, graphStreamState, rngState]) =>
          ((identityState: AnonymizedIdentityState) => {
            // TODO ST.map / .chain
            const [op1, uuidState1] =
              getRandomIdentityForGraphOp(op)(random)(identityState);
            return [[op1, graphStreamState, rngState], uuidState1] as [[GraphStreamOp<string>, GraphStreamState, RNGSTATE], AnonymizedIdentityState];
          })
      ),
      (states) => {

        return applyStatesStream({
          identityMap: {},
          rng: rngStateFromSeed(castSeed(uuidRngSeed)), // we use a new rng for more "stable" uuids generation
        })(states);

      }
    );

export type AdjacencyListWithMeta<M = string /*TODO uuid*/> = readonly [
  AdjacencyList,
  { [n in number]: M }
];

export type FinalizedGraphEvent =
  | { type: 'step'; streamState: GraphStreamState }
  | { type: 'end'; graph: AdjacencyListWithMeta };

const finalizedGraphComputationState = () => ({
  adjList: new AdjacencyList(),
  bimapMeta: BiMap.empty<number, string>(),
  nextId: 0,
});

type FinalizedGraphComputationState = ReturnType<typeof finalizedGraphComputationState>;

const generatedGraphStreamElementToFinalizedGraphApiElement = <RNGSTATE = RngState>([op, streamState, _randomState]: GraphStreamElement<RNGSTATE>): State<FinalizedGraphComputationState, FinalizedGraphEvent> => (computationState) => {
  if (op.op === 'addNode') {
    if (computationState.bimapMeta.hasValue(op.id))
      throw new Error(`panic! duplicate id ${op.id}`);
    computationState.bimapMeta = computationState.bimapMeta.set(computationState.nextId, op.id);
    computationState.adjList.addVertex(computationState.nextId);
    computationState.nextId++;
  } else if (op.op === 'addEdge') {
    const from = assertExists(
      computationState.bimapMeta.getKey(op.from),
      `panic! missing vertex id ${op.from}`
    );
    const to = assertExists(
      computationState.bimapMeta.getKey(op.to),
      `panic! missing vertex id ${op.to}`
    );
    computationState.adjList.addEdge(from, to);
  } else {
    absurd(op);
    throw new Error('unreachable');
  }
  return [{
    type: 'step' as const,
    streamState,
  }, computationState];
};

const finalizedGraphApiFinalElement = (computationState: FinalizedGraphComputationState): [FinalizedGraphEvent, FinalizedGraphComputationState] => ([{
  type: 'end' as const,
  graph: [computationState.adjList, fromEntries(computationState.bimapMeta.toArray())] as const,
}, computationState]);

const generatedGraphStreamToFinalizedGraphApi = flow(
  mapStream(generatedGraphStreamElementToFinalizedGraphApiElement),
  appendStream(finalizedGraphApiFinalElement),
  applyStatesStream(finalizedGraphComputationState())
);

export const getRandomFinalizedGraph = flow(getRandomGraph, RE.map(RE.map(generatedGraphStreamToFinalizedGraphApi)));
