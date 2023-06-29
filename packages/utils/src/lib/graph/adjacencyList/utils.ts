import type { Edge, IGraph } from './api';

/** @internal */
export const __into = (graph: IGraph, edges: Iterable<Edge>) => {
  for (const e of edges) {
    graph.addEdge(e[0], e[1]);
  }
};

/** @internal */
export const __invert = <T extends IGraph>(graph: T, edges: Iterable<Edge>) => {
  for (const e of edges) {
    graph.addEdge(e[1], e[0]);
  }
  return graph;
};
