import {
  castNonNegativeInteger,
  castPositiveInteger,
} from '@firfi/utils/positiveInteger';
import { evolve } from 'fp-ts/struct';
import { absurd, apply, constTrue, flow, pipe } from 'fp-ts/function';
import * as O from 'fp-ts/Option';
import { isNone, none, Option, some } from 'fp-ts/Option';
import * as NEA from 'fp-ts/NonEmptyArray';
import { NonEmptyArray } from 'fp-ts/NonEmptyArray';
import * as A from 'fp-ts/Array';
import * as ST from 'fp-ts/State';
import { State } from 'fp-ts/State';
import * as RE from 'fp-ts/Reader';
import { Reader } from 'fp-ts/Reader';
import { Newtype, prism } from 'newtype-ts';
import {
  prismRandom01,
  Random01,
  unwrapDecimal01,
  wrapDecimal01,
} from '@firfi/utils/rng';
import { defBiasedDistribution, defBiasedDistribution_, nlpa, nlpa_ } from './distribution';
import { AdjacencyList } from '@firfi/utils/graph/adjacencyList';
import {
  castHeterogeneity,
  prismHeterogeneity,
} from '@firfi/utils/graph/heterogeneity/prism';
import { Heterogeneity } from '@firfi/utils/graph/heterogeneity/types';
import {
  castDecimal01,
  prismDecimal01,
} from '@firfi/utils/number/decimal01/prism';
import { castToPrism } from '@firfi/utils/prism';
import { castDensity, prismDensity } from '@firfi/utils/graph/density/prism';
import { Density } from '@firfi/utils/graph/density/types';
import {
  castIndex,
  castListLength,
  prismIndex,
  prismListLength,
} from '@firfi/utils/list/prisms';
import { Index, ListLength } from '@firfi/utils/list/types';
import { scaleNLPAHeterogeneity } from './barabasiAlbert';
import { linearTransformation } from '@firfi/utils/math/distribution';
import { random } from '@firfi/utils/rng/random';
import { BranchingModel, GraphStreamOp, RngState } from './types';
import { castNonEmptyArray, getIthC } from '@firfi/utils/array';
import {
  BARABASI_ALBERT_BRANCHING_MODEL_NAME,
  DND_BRANCHING_MODEL_NAME,
} from '@firfi/graphgen/constants';
import { Decimal01 } from '@firfi/utils/number/decimal01/types';

type NodesCount = ListLength;

export type Settings<T extends BranchingModel> = {
  heterogeneity: Heterogeneity;
  branchingModel: T;
  density: Density;
  nodes: NodesCount;
};

export type GraphGeneratorSettingsInput = Partial<Settings<BranchingModel>>;

export const defaultSettingsInput: GraphGeneratorSettingsInput = {};

export const defaultSettings: Settings<
  typeof BARABASI_ALBERT_BRANCHING_MODEL_NAME
> = {
  heterogeneity: castHeterogeneity(0.3),
  density: castDensity(0.5),
  nodes: castListLength(30),
  branchingModel: BARABASI_ALBERT_BRANCHING_MODEL_NAME,
};

type Gravity = Newtype<{ readonly GRAVITY: unique symbol }, Decimal01>;

const prismGravity = prismDecimal01.compose(prism<Gravity>(constTrue));
const castGravity = castToPrism(prismGravity)(
  (n) => `Invalid cast, gravity is not in range 0-1: ${n}`
);
export const unwrapGravity = flow(prismGravity.reverseGet, castDecimal01);

// 1 to 1
const heterogeneityToGravity = (heterogeneity: Heterogeneity): Gravity =>
  castGravity(prismHeterogeneity.reverseGet(heterogeneity));

const gravitatedRandom_ = <RNGSTATE = RngState>() => flow(
  unwrapGravity,
  defBiasedDistribution_,
  (f) =>
    (random: State<RNGSTATE, Random01>): State<RNGSTATE, Random01> =>
    (state0: RNGSTATE) => {
      const [n, state1] = random(state0);
      return pipe(f(unwrapDecimal01(n))(random), ST.map(wrapDecimal01), apply(state1));
    }
);

const gravitatedScaledRandom_ = <RNGSTATE = RngState>() => pipe(
  RE.asks<
    (n: Random01) => Index,
    Reader<Gravity, Reader<State<RNGSTATE, Random01>, State<RNGSTATE, Index>>>
  >((f) => pipe(gravitatedRandom_<RNGSTATE>(), RE.map(RE.map(ST.map(f))))),
  RE.local(
    flow(
      prismListLength.reverseGet,
      (NC) => (n: Random01) =>
        castIndex(Math.floor(prismRandom01.reverseGet(n) * NC))
    )
  )
) satisfies Reader<
  ListLength,
  Reader<Gravity, Reader<State<RNGSTATE, Random01>, State<RNGSTATE, Index>>>
>;

const maxEdges = flow(
  prismListLength.reverseGet,
  (nodeCount) => Math.pow(nodeCount + 1, 2) - 3 * (nodeCount + 1) + 2,
  castListLength
);

export const paramsFromSettings_ = <RNGSTATE = RngState>(
  settings: Settings<BranchingModel | never>
) => {
  const {
    heterogeneity,
    density,
    nodes: nodeCount,
    branchingModel,
  } = pipe(
    settings,
    evolve({
      heterogeneity: (x) => x,
      density: prismDensity.reverseGet,
      nodes: prismListLength.reverseGet,
      branchingModel: (x) => x,
    })
  );
  const MAX_EDGES = Math.max(4000, nodeCount - 1); // when it's too too much, but let nodeCount not be < min
  const MAX_EDGES_BIG = Math.min(
    MAX_EDGES,
    pipe(settings.nodes, maxEdges, prismListLength.reverseGet)
  );
  // min edges is nodeCount - 1
  const edgeCount = pipe(
    Math.max(
      0 /*no nodes(?)*/,
      pipe(
        density,
        linearTransformation,
        apply([0, 1] as const),
        apply([nodeCount - 1, MAX_EDGES_BIG] as const)
      )
    ),
    Math.ceil,
    castListLength
  );

  const scaledNLPAHeterogeneity = scaleNLPAHeterogeneity(heterogeneity);

  const gravitate: Gravitate_<RNGSTATE> =
    branchingModel === DND_BRANCHING_MODEL_NAME
      ? flow(
          (l: Pick<AdjacencyList, 'numVertices'>) => l.numVertices(),
          castListLength,
          gravitatedScaledRandom_<RNGSTATE>(),
          apply(heterogeneityToGravity(heterogeneity))
        )
      : flow(
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
          nlpa_(scaledNLPAHeterogeneity),
        );
  return { edgeCount, nodeCount: settings.nodes, gravitate };
};

// TODO gravitate makes no sense for 0 length list
type Gravitate_<RNGSTATE = RngState> = (
  l: Pick<AdjacencyList, 'numVertices' | 'numEdges' | 'degree'>
) => (random: ST.State<RNGSTATE, Random01>) => ST.State<RNGSTATE, Index>;

// dangeros
// we could really use reactive streams here and zip them for better composition; implementation with an array is POOP
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const randomUntil =
  <T, RNGSTATE = RngState>(fs: NonEmptyArray<State<RNGSTATE, T>>) =>
  (
    filter: (ns: NonEmptyArray<T>) => boolean
  ): State<RNGSTATE, NonEmptyArray<T>> =>
    pipe(
      fs,
      NEA.sequence(ST.Applicative),
      ST.chain((ns) => (filter(ns) ? ST.of(ns) : randomUntil(fs)(filter)))
    );

const scaleRandomToListIndex =
  (n: Random01) =>
  (vertices: ListLength): Index =>
    castIndex(
      Math.floor(
        prismRandom01.reverseGet(n) * prismListLength.reverseGet(vertices)
      )
    );
type LinkConfig = {
  targetNodeCount: ListLength;
  targetEdgeCount: ListLength;
};
type LinkState = {
  graph: Pick<
    AdjacencyList,
    'numVertices' | 'numEdges' | 'degree' | 'hasEdge' | 'vertices'
  >;
  nextVertexId: Index;
};

export const addNode =
  (graph: Pick<AdjacencyList, 'addVertex'>) => (id: Index) => {
    const ix_ = prismIndex.reverseGet(id);
    // if (graph.hasVertex(ix_)) return;
    graph.addVertex(ix_);
  };
export const addEdge =
  (graph: Pick<AdjacencyList, 'addEdge'>) => (i1: Index, i2: Index) => {
    const i1_ = prismIndex.reverseGet(i1);
    const i2_ = prismIndex.reverseGet(i2);
    graph.addEdge(i1_, i2_);
  };

const linkCandidates =
  (inOut: 'in' | 'out') =>
  (graph: Pick<AdjacencyList, 'vertices' | 'degree' | 'numVertices'>) =>
    pipe(
      [...graph.vertices()],
      A.filterMap((v) =>
        O.fromPredicate(() => graph.degree(v, inOut) < graph.numVertices() - 1)(
          castIndex(v)
        )
      )
    );

const scaledIndexRandom_ = (
  candidates: NonEmptyArray<Index>
): Reader<Random01, Index> =>
  flow(
    scaleRandomToListIndex,
    apply(castListLength(candidates.length)),
    prismIndex.reverseGet,
    castNonNegativeInteger,
    (n) =>
      getIthC(
        n,
        `out of bounds of candidates.length: ${candidates.length}: ${n}`
      )()(candidates)
  );

const scaledIndexRandom = (
  candidates: NonEmptyArray<Index>
): State<RngState, Index> =>
  pipe(
    random,
    ST.map(
      flow(
        scaleRandomToListIndex,
        apply(castListLength(candidates.length)),
        prismIndex.reverseGet,
        castNonNegativeInteger,
        (n) =>
          getIthC(
            n,
            `out of bounds of candidates.length: ${candidates.length}: ${n}`
          )()(candidates)
      )
    )
  );

export const genesis_ =
  (linkState: LinkState) =>
    <RNGSTATE = RngState>(gravitate: Gravitate_<RNGSTATE>) =>
  (
    random: State<RNGSTATE, Random01>
  ): State<RNGSTATE, Option<GraphStreamOp[]>> =>
  (state0) => {
    const { nextVertexId, graph } = linkState;
    const nextVertexId_ = prismIndex.reverseGet(nextVertexId);
    const [i1, state1] = gravitate(graph)(random)(state0);
    const i2 = castIndex(nextVertexId_);
    const i1_ = prismIndex.reverseGet(i1);
    const i2_ = prismIndex.reverseGet(i2);
    if (i1_ === i2_) throw new Error('panic! assumption is i1 !== i2');
    // TODO why option?
    return [
      some([
        // TODO why haven't I added i1 here?
        {
          op: 'addNode',
          id: i2,
        },
        {
          op: 'addEdge',
          from: i1,
          to: i2,
        },
      ]),
      state1,
    ];
  };

const abundance_ =
  (graph: LinkState['graph']) =>
  <RNGSTATE = RngState>(
    random: State<RNGSTATE, Random01>
  ): State<RNGSTATE, Option<GraphStreamOp[]>> =>
  (state0) => {
    // TODO optimize, it's n^2 or something, and in the main loop at least n^3
    const incomingCandidates = castNonEmptyArray(
      linkCandidates('in')(graph),
      'incomingCandidates assumed to be non empty'
    );
    const outgoingCandidates_ = linkCandidates('out')(graph);
    const scaledRandomIn = scaledIndexRandom_(incomingCandidates);
    const [n1, state1] = random(state0);
    const i2 = scaledRandomIn(n1);
    const outgoingCandidates = outgoingCandidates_.filter((i) => {
      const i_ = prismIndex.reverseGet(i);
      const i2_ = prismIndex.reverseGet(i2);
      return i_ !== i2_ && !graph.hasEdge(i_, i2_);
    });
    const scaledRandomOut = scaledIndexRandom_(
      castNonEmptyArray(
        outgoingCandidates,
        'outgoingCandidates assumed to be non empty'
      )
    );
    const [n2, state2] = random(state1);
    const i1 = scaledRandomOut(n2);
    return [
      some([
        {
          op: 'addEdge',
          from: i1,
          to: i2,
        },
      ]),
      state2,
    ];
  };

const abundance = (
  graph: LinkState['graph']
): State<RngState, Option<GraphStreamOp[]>> => abundance_(graph)(random);

export const link_ =
  (linkState: LinkState) =>
  (linkConfig: LinkConfig) =>
  <RNGSTATE = RngState>(gravitate: Gravitate_<RNGSTATE>) =>
  (
    random: State<RNGSTATE, Random01>
  ): State<RNGSTATE, Option<GraphStreamOp[]>> => {
    const { graph, nextVertexId } = linkState;
    const { targetNodeCount, targetEdgeCount } = linkConfig;
    const numVertices = castListLength(graph.numVertices()),
      numVertices_ = prismListLength.reverseGet(numVertices),
      numEdges = castListLength(graph.numEdges()),
      numEdges_ = prismListLength.reverseGet(numEdges),
      targetNodeCount_ = prismListLength.reverseGet(targetNodeCount),
      targetEdgeCount_ = prismListLength.reverseGet(targetEdgeCount);
    // first node step -> genesis -> [abundance] -> done
    return numVertices_ === 0 &&
      targetNodeCount_ >
        0 /*special case, if we want 0 nodes we don't even add an initial node*/
      ? ST.of(some([{ op: 'addNode', id: nextVertexId }]))
      : targetEdgeCount_ === 0 || graph.numEdges() === targetEdgeCount_
      ? ST.of(none)
      : targetNodeCount_ > numVertices_
      ? genesis_(linkState)(gravitate)(random)
      : targetEdgeCount_ > numEdges_
      ? (() => {
          const maxEdgesNow = maxEdges(castListLength(graph.numVertices()));
          if (graph.numEdges() >= prismListLength.reverseGet(maxEdgesNow)) {
            throw new Error(
              `panic! assumption is graph.numVertices < maxEdgesNow ${graph.numVertices()} < ${prismListLength.reverseGet(
                maxEdgesNow
              )}`
            );
          }
          return abundance_(graph)(random);
        })()
      : ST.of(none);
  };

export const link =
  (linkState: LinkState) =>
  (linkConfig: LinkConfig) =>
  (gravitate: Gravitate_): State<RngState, Option<GraphStreamOp[]>> =>
    link_(linkState)(linkConfig)(gravitate)(random);

export type GraphGeneratorItem<RNGSTATE = RngState> = [
  GraphStreamOp,
  { edgesLeft: ListLength; totalEdges: ListLength },
  RNGSTATE
];

export const defGenerateGraph = <RNGSTATE = RngState>(
  settings: GraphGeneratorSettingsInput | undefined
) =>
  pipe(
    paramsFromSettings_<RNGSTATE>({ ...defaultSettings, ...(settings || defaultSettingsInput) }),
    ({ edgeCount, gravitate, nodeCount }) => {
      const totalEdges = edgeCount;
      const totalEdges_ = prismListLength.reverseGet(edgeCount);
      return (random: State<RNGSTATE, Random01>) =>

      (rngState_: RNGSTATE) =>
        function* (): Generator<
          GraphGeneratorItem<RNGSTATE>
        > {
          // recursion substituted with a loop since we have a ton of those calls
          // still doesn't help much; applicatives of fp-ts are recursive too; left here for illustration though
          let rngState = rngState_;
          const graph = new AdjacencyList();
          const linkState: LinkState = {
            graph,
            nextVertexId: castIndex(0),
          };
          const getEdgesLeft = () =>
            castListLength(totalEdges_ - graph.numEdges());
          // again, reactive streams would be nice here
          // eslint-disable-next-line no-constant-condition
          while (
            prismListLength.reverseGet(getEdgesLeft()) >=
            0 /*eq to while true but here for expressiveness and assertion*/
            ) {
            const [r, rngState2] = link_(linkState)({
              targetNodeCount: nodeCount,
              targetEdgeCount: edgeCount,
            })(gravitate)(random)(rngState);
            rngState = rngState2;
            if (isNone(r)) return;
            const ops = r.value;
            for (const op of ops) {
              switch (op.op) {
                case 'addNode':
                  addNode(graph)(op.id);
                  linkState.nextVertexId = castIndex(
                    prismIndex.reverseGet(op.id) + 1
                  );
                  yield [
                    op,
                    { edgesLeft: getEdgesLeft(), totalEdges },
                    rngState,
                  ];
                  break;
                case 'addEdge':
                  addEdge(graph)(op.from, op.to);
                  yield [
                    op,
                    { edgesLeft: getEdgesLeft(), totalEdges },
                    rngState,
                  ];
                  break;
                default:
                  absurd(op);
              }
            }
          }
          throw new Error('unreachable');
        };
    }
  );

export default {};
