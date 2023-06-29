import { ForceGraph2D } from 'react-force-graph';
import styles from './app.module.scss';
import { useLocalGraph } from './data';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useUuidV4 from 'react-uuid-hook';
import hash from 'object-hash';
import { castHeterogeneity, prismHeterogeneity } from '@firfi/utils/graph/heterogeneity/prism';
import { castDensity, prismDensity } from '@firfi/utils/graph/density/prism';
import { castListLength, prismListLength } from '@firfi/utils/list/prisms';
import { BranchingModel } from '@firfi/graphgen/types';
import { isoSeed } from '@firfi/utils/rng/seed/iso';
import { assertExists } from '@firfi/utils/index';

type Coords = {
  x: number;
  y: number;
  z: number;
};

interface ForceGraphMethods {
  // Link styling
  // emitParticle(link: LinkObject$1): ForceGraph3DInstance;
  //
  // // Force engine (d3-force) configuration
  // d3Force(forceName: 'link' | 'charge' | 'center' | string): ForceFn$1 | undefined;
  // d3Force(forceName: 'link' | 'charge' | 'center' | string, forceFn: ForceFn$1): ForceGraph3DInstance;
  // d3ReheatSimulation(): ForceGraph3DInstance;
  //
  // // Render control
  // pauseAnimation(): ForceGraph3DInstance;
  // resumeAnimation(): ForceGraph3DInstance;
  cameraPosition(position: Partial<Coords>, lookAt?: Coords, transitionMs?: number): void;
  // zoomToFit(durationMs?: number, padding?: number, nodeFilter?: (node: NodeObject$1) => boolean): ForceGraph3DInstance;
  // postProcessingComposer(): EffectComposer;
  // scene(): Scene;
  // camera(): Camera;
  // renderer(): WebGLRenderer;
  // controls(): object;
  // refresh(): ForceGraph3DInstance;
  //
  // // Utility
  // getGraphBbox(nodeFilter?: (node: NodeObject$1) => boolean): { x: [number, number], y: [number, number], z: [number, number] };
  // screen2GraphCoords(x: number, y: number, distance: number): Coords;
  // graph2ScreenCoords(x: number, y: number, z: number): Coords;
}

const useCameraRotation = () => {
  const distance = 3000;
  const fgRef = useRef<ForceGraphMethods>();
  const animationFrameHandleRef = useRef<number>();
  const mainHandleRef = useRef<number>();
  const angleRef = useRef<number>(0);
  const allowRun = useRef<boolean>(false);
  const f = useCallback(
    (ref: ForceGraphMethods, t = 3000 /*give some time initially before it bounces around*/) =>
      setTimeout(() => {
        // fgRef.current!.cameraPosition({ z: distance }); // TODO maybe not at all
        animationFrameHandleRef.current = window.requestAnimationFrame(() => {
          if (allowRun.current) {
            // any changes only on allowRun
            ref.cameraPosition({
              x: distance * Math.sin(angleRef.current),
              z: distance * Math.cos(angleRef.current),
            });
          }
          angleRef.current += Math.PI / 300;
          f(ref, 100);
        });
      }, t),
    []
  );
  const cleanup = useCallback(() => {
    if (typeof mainHandleRef.current !== 'undefined') clearTimeout(mainHandleRef.current);
    if (typeof animationFrameHandleRef.current !== 'undefined')
      window.cancelAnimationFrame(animationFrameHandleRef.current);
    angleRef.current = 0;
    allowRun.current = false;
  }, []);

  const cb = useCallback(
    (ref: ForceGraphMethods | null) => {
      if (ref === null) {
        cleanup();
        return;
      }
      f(ref);
    },
    [fgRef, cleanup]
  );
  return {
    ref: cb,
    run: useCallback((b: boolean) => {
      allowRun.current = b;
    }, []),
  };
};

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

const BRANCHING_MODELS = ['barabasi-albert', 'dnd'] as BranchingModel[];

const useGraphData = () => {
  const DEBOUNCE = 500;
  const [seed, setSeed] = useState(isoSeed.from('seed'));
  const seedDebounced = useDebounce(seed, DEBOUNCE);
  const [heterogeneity, setHeterogeneity] = useState(castHeterogeneity(0.3));
  const heterogeneityDebounced = useDebounce(heterogeneity, DEBOUNCE);
  const [density, setDensity] = useState(castDensity(0));
  const densityDebounced = useDebounce(density, DEBOUNCE);
  const [nodes, setNodes] = useState(castListLength(10));
  const nodesDebounced = useDebounce(nodes, DEBOUNCE);
  const [branchingModel, setBranchingModel] = useState(BRANCHING_MODELS[0]);
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
  const { ref, run } = useCameraRotation();
  const { data: data_, isLoading, progress, ...controls } = useGraphData();
  const data = data_ || empty;
  const graphHash = useMemo(() => (data ? hash(data) : 'not ready'), [data]);
  const dataMemoized = useMemo(() => data, [graphHash]);
  return (
    <div className={styles.app}>
      <div className={styles.settingsAndHash}>
        <Settings {...controls} />
        {isLoading ? <div>Loading...</div> : <div>Hash: {graphHash}</div>}
        {progress !== undefined ? <progress value={progress} max={100} /> : null}
      </div>
      <ForceGraph2D
        onEngineStop={() => run(true)}
        nodeColor={(n) => ((n as any).type === 'user' ? 'red' : 'blue')}
        linkColor={(e) => ((e as any).type === 'settlement' ? 'yellow' : 'white')}
        ref={ref as any}
        graphData={dataMemoized}
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={1}
        linkCurvature={0.25}
        nodeLabel={(n) => `${n.id!}`}
      />
    </div>
  );
};

export default App;
