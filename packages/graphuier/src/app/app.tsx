import { ForceGraph2D } from 'react-force-graph';
import styles from './app.module.scss';
import { GraphData, useLocalGraph } from './data';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useUuidV4 from 'react-uuid-hook';
import hash from 'object-hash';
import { castHeterogeneity, prismHeterogeneity } from '@firfi/utils/graph/heterogeneity/prism';
import { castDensity, prismDensity } from '@firfi/utils/graph/density/prism';
import { castListLength, prismListLength } from '@firfi/utils/list/prisms';
import { BranchingModel } from '@firfi/graphgen/types';
import { isoSeed } from '@firfi/utils/rng/seed/iso';
import { assertExists } from '@firfi/utils/index';
import { GraphUrlParamsSetters, GraphUrlParamsStrict, useGraphQueryParams } from './useQueryParams';
import { BRANCHING_MODELS } from '@firfi/graphgen/constants';
import * as A from 'fp-ts/Array';
import { flow, pipe } from 'fp-ts/function';
import * as NEA from 'fp-ts/NonEmptyArray';
import * as R from 'fp-ts/Record';
import { castNonEmptyArray } from '@firfi/utils/array';
import { hashMemoParams, memo1 } from './memos';

type Coords = {
  x: number;
  y: number;
  z: number;
};

type ForceGraphMethods = Exclude<Exclude<Parameters<typeof ForceGraph2D>[0]['ref'], undefined>['current'], undefined>;

// Hook
const useDebounce = <T,>(value: T, delay: number) => {
  // State and setters for debounced value
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(
    () => {
      // Update debounced value after delay
      const handler = setTimeout(() => {
        setDebouncedValue(value);
      }, delay);
      // Cancel the timeout if value changes (also on delay change or unmount)
      // This is how we prevent debounced value from updating if value is changed ...
      // .. within the delay period. Timeout gets cleared and restarted.
      return () => {
        clearTimeout(handler);
      };
    },
    [value, delay] // Only re-call effect if value or delay changes
  );
  return debouncedValue;
};

// TODO dry
const useHeterogeneity = () => {
  const { heterogeneity, setHeterogeneity } = useGraphQueryParams();
  const [value, set] = useState(heterogeneity === null ? castHeterogeneity(0.3) : heterogeneity);
  return [value, useCallback((v: typeof value) => {
    set(v);
    setHeterogeneity(v);
  }, [])] as const;
};

const useSeed = () => {
  const { seed, setSeed } = useGraphQueryParams();
  const [value, set] = useState(seed === null ? isoSeed.from('seed') : seed);
  return [value, useCallback((v: typeof value) => {
    set(v);
    setSeed(v);
  }, [])] as const;
};

const useDensity = () => {
  const { density, setDensity } = useGraphQueryParams();
  const [value, set] = useState(density === null ? castDensity(0): density);
  return [value, useCallback((v: typeof value) => {
    set(v);
    setDensity(v);
  }, [])] as const;
};

const useNodesCount = () => {
  const { nodes, setNodes } = useGraphQueryParams();
  const [value, set] = useState(nodes === null ? castListLength(10) : nodes);
  return [value, useCallback((v: typeof value) => {
    set(v);
    setNodes(v);
  }, [])] as const;
};

const useBranchingModel = () => {
  const { model, setModel } = useGraphQueryParams();
  const [value, set] = useState(model === null ? BRANCHING_MODELS[0] : model);
  return [value, useCallback((v: typeof value) => {
    set(v);
    setModel(v);
  }, [])] as const;
};

const useGraphSettings = (): GraphUrlParamsStrict & GraphUrlParamsSetters => {
  const [seed, setSeed] = useSeed();
  const [heterogeneity, setHeterogeneity] = useHeterogeneity();
  const [density, setDensity] = useDensity();
  const [nodes, setNodes] = useNodesCount();
  const [branchingModel, setBranchingModel] = useBranchingModel();
  return useMemo(() => ({
    seed,
    setSeed,
    heterogeneity,
    setHeterogeneity,
    density,
    setDensity,
    nodes,
    setNodes,
    model: branchingModel,
    setModel: setBranchingModel,
  }), [seed, setSeed, heterogeneity, setHeterogeneity, density, setDensity, nodes, setNodes, branchingModel, setBranchingModel]);
};

const useMemoizedLayout = (graphHash: string, graphSettings: GraphUrlParamsStrict, graphData: GraphData): readonly [GraphData, boolean] => {
  return useMemo(() => {
    const hash = hashMemoParams({
      ...graphSettings,
      graphHash,
    });
    if (memo1[0] === hash) {
      return [{
        ...graphData,
        nodes: graphData.nodes.map(n => {
          const data = assertExists(memo1[1][n.id as keyof typeof memo1[1]]);
          return {
            ...n,
            x: data.x,
            y: data.y,
            vx: data.vx,
            vy: data.vy,
          };
        })
      }, true] as const
    } else {
      return [graphData, false] as const;
    }
  }, [graphHash])

}

const useGraphData = (graphSettings: ReturnType<typeof useGraphSettings>)=> {
  const DEBOUNCE = 500;
  const {
    seed,
    setSeed,
    heterogeneity,
    setHeterogeneity,
    density,
    setDensity,
    nodes,
    setNodes,
    model: branchingModel,
    setModel: setBranchingModel,
  } = graphSettings;
  const seedDebounced = useDebounce(seed, DEBOUNCE);
  const heterogeneityDebounced = useDebounce(heterogeneity, DEBOUNCE);
  const densityDebounced = useDebounce(density, DEBOUNCE);
  const nodesDebounced = useDebounce(nodes, DEBOUNCE);
  const branchingModelDebounced = useDebounce(branchingModel, DEBOUNCE);
  //const { data, isLoading } = useGraphQuery(seedDebounced, {
  const g = useLocalGraph(seedDebounced, {
    heterogeneity: heterogeneityDebounced,
    density: densityDebounced,
    nodes: nodesDebounced,
    branchingModel: branchingModelDebounced,
  });
  const { data, isLoading } = g;
  return {
    setSeed,
    seed,
    setHeterogeneity,
    heterogeneity,
    setDensity,
    density,
    setNodes,
    nodes,
    setBranchingModel,
    branchingModel,
    branchingModels: BRANCHING_MODELS,
    data,
    isLoading: isLoading || seed !== seedDebounced,
    progress: g.isLoading ? g.progress : undefined,
  };
};

const empty = { nodes: [], links: [] };

const Settings = ({
  seed,
  setSeed,
  heterogeneity,
  setHeterogeneity,
  density,
  setDensity,
  nodes,
  setNodes,
  branchingModel,
  setBranchingModel,
  branchingModels,
}: Omit<ReturnType<typeof useGraphData>, 'data' | 'isLoading' | 'progress'>) => {
  const [seedInputId] = useUuidV4();
  const [heterogeneityInputId] = useUuidV4();
  const [densityInputId] = useUuidV4();
  const [nodesInputId] = useUuidV4();
  const [branchingModelInputId] = useUuidV4();
  return (
    <div className={styles.settings}>
      <label htmlFor={seedInputId}>Seed</label>
      <input id={seedInputId} value={isoSeed.get(seed)} onChange={(e) => setSeed(isoSeed.from(e.target.value))} />
      <label htmlFor={branchingModelInputId}>Branching model</label>
      <select
        id={branchingModelInputId}
        value={branchingModel}
        onChange={(e) => setBranchingModel(assertExists(BRANCHING_MODELS.find((m) => m === e.target.value)))}
      >
        {branchingModels.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <label htmlFor={heterogeneityInputId}>Heterogeneity</label>
      <input
        id={heterogeneityInputId}
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={prismHeterogeneity.reverseGet(heterogeneity)}
        onChange={(e) => setHeterogeneity(castHeterogeneity(parseFloat(e.target.value)))}
      />
      <label htmlFor={densityInputId}>Density</label>
      <input
        id={densityInputId}
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={prismDensity.reverseGet(density)}
        onChange={(e) => setDensity(castDensity(parseFloat(e.target.value)))}
      />
      <label htmlFor={nodesInputId}>Nodes</label>
      <input
        id={nodesInputId}
        type="range"
        min="0"
        max="5000"
        step="1"
        value={prismListLength.reverseGet(nodes)}
        onChange={(e) => setNodes(castListLength(parseInt(e.target.value)))}
      />
    </div>
  );
};

const App = () => {
  const [ref, setRef] = useState<ForceGraphMethods>();
  const graphSettings = useGraphSettings();
  const { data: data_, isLoading, progress, ...controls } = useGraphData(graphSettings);
  const data = data_ || empty;
  const graphHash = useMemo(() => (data ? hash(data) : 'not ready'), [data]);
  const dataMemoized = useMemo(() => data, [graphHash]);
  const [dataMemoizedMaybeLayoutEnhanced, memoizeMatched] = useMemoizedLayout(graphHash, graphSettings, dataMemoized);
  const onStop = useCallback(() => {
    pipe(dataMemoizedMaybeLayoutEnhanced.nodes, castNonEmptyArray, NEA.groupBy(c => c.id), R.map(flow(NEA.head, r => {
      const rr = {...r};
      // @ts-ignore
      delete rr.id;
      // @ts-ignore
      delete rr.__indexColor;
      return rr;
    })), o => JSON.stringify(o, null, 2), console.log.bind(console));
  }, [ref, dataMemoizedMaybeLayoutEnhanced]);
  return (
    <div className={styles.app}>
      <div className={styles.settingsAndHash}>
        <Settings {...controls} />
        {isLoading ? <div>Loading...</div> : <div>Hash: {graphHash}</div>}
        {progress !== undefined ? <progress value={progress} max={100} /> : null}
      </div>
      <ForceGraph2D
        cooldownTicks={memoizeMatched ? 0 : 100}
        nodeColor={(n) => ((n as any).type === 'user' ? 'red' : 'blue')}
        linkColor={(e) => ((e as any).type === 'settlement' ? 'yellow' : 'white')}
        graphData={dataMemoizedMaybeLayoutEnhanced}
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={1}
        linkCurvature={0.25}
        nodeLabel={(n) => `${n.id!}`}
      />
    </div>
  );
};

export default App;
