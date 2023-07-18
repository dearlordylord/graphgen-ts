import { useQuery } from 'react-query';
import { Heterogeneity } from '@firfi/utils/graph/heterogeneity/types';
import { Density } from '@firfi/utils/graph/density/types';
import { ListLength } from '@firfi/utils/list/types';
import { BranchingModel } from '@firfi/graphgen/types';
import { Seed } from '@firfi/utils/rng/seed/types';
import { useEffect, useReducer } from 'react';
import hash from 'object-hash';
import {
  AdjacencyListWithMeta,
  FinalizedGraphEvent
} from '@firfi/graphgen/getRandomGraph';
import { absurd } from 'fp-ts/function';
import { AdjacencyList } from '@firfi/utils/graph/adjacencyList';
import { prismListLength } from '@firfi/utils/list/prisms';
import { assertExists } from '@firfi/utils/index';
import { assertNonEmptyOrNA } from '@firfi/utils/string';

type Data = {
  nodes: { [k in string]: { type: 'channel' | 'user' } };
  edges: {
    [k in string]: {
      type: 'beneficiary' | 'settlement';
      start: string;
      end: string;
    };
  };
};

export type GraphData = {
  nodes: { id: string }[];
  links: {
    source: string;
    target: string;
  }[];
};

export const dataToGraphData = (d: Data): GraphData => {
  const nodes = Object.keys(d.nodes).map((id) => ({ id, type: d.nodes[id]!.type }));
  const links = Object.keys(d.edges).map((id) => ({
    id,
    source: d.edges[id]!.start,
    target: d.edges[id]!.end,
    type: d.edges[id]!.type,
  }));
  return { nodes, links };
};

export type Settings = {
  heterogeneity?: Heterogeneity;
  density?: Density;
  nodes?: ListLength;
  branchingModel?: BranchingModel;
};

const fetchGraph = (seed: Seed, { heterogeneity, density, nodes, branchingModel }: Settings = {}) =>
  fetch(
    `${assertNonEmptyOrNA(
      import.meta.env.VITE_GRAPH_API_BASE_URI,
      'VITE_GRAPH_API_BASE_URI not provided'
    )}/api/v1/discoball/random/${seed}?${new URLSearchParams({
      ...(heterogeneity !== undefined ? { heterogeneity: `${heterogeneity}` } : {}),
      ...(density !== undefined ? { density: `${density}` } : {}),
      ...(nodes !== undefined ? { nodes: `${nodes}` } : {}),
      ...(branchingModel !== undefined ? { branchingModel: `${branchingModel}` } : {}),
    })}`
  )
    .then((r) => r.json())
    .then((r) => r as Data)
    .then(dataToGraphData);

export const useGraphQuery = (seed: Seed, { heterogeneity, density, nodes, branchingModel }: Settings = {}) =>
  useQuery(['graph', seed, branchingModel, heterogeneity, density, nodes], () =>
    fetchGraph(seed, {
      heterogeneity,
      density,
      nodes,
      branchingModel,
    })
  );
//
// export const useGraphLocalGenerator = (seed: string, settings: Settings = {}) => {
//   getRandomGraph(isoSeed.from('seed'))(settings);
// };

type UseLocalGraphState = { data?: AdjacencyListWithMeta } & (
  | {
      progress: number;
      isLoading: true;
    }
  | {
      isLoading: false;
    }
);

const reducer = (
  state: UseLocalGraphState,
  action:
    | { type: 'loadingStarted' }
    | { type: 'progress'; progress: number }
    | { type: 'data'; data: AdjacencyListWithMeta }
): UseLocalGraphState => {
  switch (action.type) {
    case 'loadingStarted': {
      return {
        ...state,
        isLoading: true,
        progress: 0,
      };
    }
    case 'progress': {
      return {
        ...state,
        isLoading: true,
        progress: action.progress,
      };
    }
    case 'data': {
      return {
        ...state,
        isLoading: false,
        data: action.data,
      };
    }
    default: {
      absurd(action);
      throw new Error('unreachable');
    }
  }
};

const useLocalGraph_ = (...params: Parameters<typeof useGraphQuery>): UseLocalGraphState => {
  const [seed, settings = {}] = params;
  const [state, dispatch] = useReducer(reducer, {
    isLoading: false,
  });
  useEffect(() => {
    const worker = new Worker(new URL('./graphgen-webworker.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.postMessage({
      seed,
      settings,
    });
    worker.onmessage = (e: MessageEvent<FinalizedGraphEvent>) => {
      if (e.data.type === 'step') {
        dispatch({
          type: 'progress',
          progress:
            ((prismListLength.reverseGet(e.data.streamState.totalEdges) -
              prismListLength.reverseGet(e.data.streamState.edgesLeft)) /
              prismListLength.reverseGet(e.data.streamState.totalEdges)) *
            100,
        });
      } else if (e.data.type === 'end') {
        // lil' misbehaviour here
        const al = new AdjacencyList(
          e.data.graph[0].adjacency.map((v, i) => v.map((v) => [i, v] as [number, number])).flat(1)
        );
        dispatch({ type: 'data', data: [al, e.data.graph[1]] });
      } else {
        absurd(e.data);
      }
    };
    return () => {
      worker.terminate();
    };
  }, [hash({ seed, settings })]);
  return state;
};

const localGraphToGraphData = (g: AdjacencyListWithMeta): GraphData => {
  const nodes: GraphData['nodes'] = [];
  const links: GraphData['links'] = [];
  for (const id of g[0].vertices()) {
    const uuid = assertExists(g[1][id]);
    nodes.push({ id: uuid });
  }
  for (const [start, end] of g[0].edges()) {
    const uuidStart = assertExists(g[1][start]);
    const uuidEnd = assertExists(g[1][end]);
    links.push({ source: uuidStart, target: uuidEnd });
  }
  return { nodes, links };
};

export const useLocalGraph = (...params: Parameters<typeof useGraphQuery>) => {
  const { data, ...rest } = useLocalGraph_(...params);
  return {
    ...rest,
    data: data ? localGraphToGraphData(data) : undefined,
  };
};
