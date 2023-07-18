import { useState, useEffect, useMemo, useCallback } from 'react';
import { BranchingModel, BranchingModelSchema } from '@firfi/graphgen/types';
import { Heterogeneity } from '@firfi/utils/graph/heterogeneity/types';
import { Seed } from '@firfi/utils/rng/seed/types';
import { Density } from '@firfi/utils/graph/density/types';
import * as RA from 'fp-ts/ReadonlyArray';
import { flow, pipe } from 'fp-ts/function';
import * as S from '@effect/schema/Schema';
import * as O from 'fp-ts/Option';
import { isoSeed } from '@firfi/utils/rng/seed/iso';
import { prismHeterogeneity } from '@firfi/utils/graph/heterogeneity/prism';
import { prismDensity } from '@firfi/utils/graph/density/prism';
import { Pipe, Objects, Strings, Booleans, Fn, Functions, Compose } from 'hotscript';
import { prismListLength } from '@firfi/utils/list/prisms';
import { ListLength } from '@firfi/utils/list/types';


export const useQueryParams = (): readonly [URLSearchParams, (k: string) => (v: string | null) => void] => {
  const [queryParams, setQueryParams] = useState(new URLSearchParams(window.location.search));

  useEffect(() => {
    const onHistoryChange = () => {
      setQueryParams(new URLSearchParams(window.location.search));
    };

    window.addEventListener('popstate', onHistoryChange);
    return () => window.removeEventListener('popstate', onHistoryChange);
  }, []);

  const setParam = useCallback((key: string) => (value: string | null) => {
    if (value === null) {
      queryParams.delete(key);
    } else {
      queryParams.set(key, value);
    }

    setQueryParams(new URLSearchParams(queryParams));
    window.location.search = queryParams.toString();
  }, [queryParams]);

  return [queryParams, setParam] as const;
};

const SEED_KEY = 'seed' as const;
const MODEL_KEY = 'model' as const;
const HETEROGENEITY_KEY = 'heterogeneity' as const;
const DENSITY_KEY = 'density' as const;
const NODES_KEY = 'nodes' as const;

export const QUERY_KEYS = [SEED_KEY, MODEL_KEY, HETEROGENEITY_KEY, DENSITY_KEY, NODES_KEY] as const;

export type GraphUrlParamsStrict = {
  [SEED_KEY]: Seed,
  [MODEL_KEY]: BranchingModel,
  [HETEROGENEITY_KEY]: Heterogeneity,
  [DENSITY_KEY]: Density,
  [NODES_KEY]: ListLength
}

interface Nulliate extends Fn {
  return: this["arg0"] | null;
}

interface Setterize extends Fn {
  return: (s: this["arg0"]) => void
}

export type GraphUrlParamsSetters = Pipe<GraphUrlParamsStrict, [Objects.MapKeys<Compose<[Strings.Prepend<'set'>, Strings.Capitalize]>>, Objects.MapValues<Setterize>]>
type GraphUrlParams = Pipe<GraphUrlParamsStrict, [Objects.MapValues<Nulliate>]>;

type Res = Pipe<GraphUrlParams, [Objects.Assign<GraphUrlParamsSetters>]>;

export const useGraphQueryParams = (): Res => {
  const [queryParams, set] = useQueryParams();

  const {seed: {value: seed, setter: setSeed}, model: {value: model, setter: setModel}, heterogeneity: {value: heterogeneity, setter: setHeterogeneity}, density: {value: density, setter: setDensity}, nodes: {value: nodes, setter: setNodes}} =
    useMemo(() => pipe(
      QUERY_KEYS,
      RA.map(k => [k, {
        value: queryParams.get(k),
        setter: set(k)
      }] as const),
      es => Object.fromEntries(es),
      r => r as {
        [K in typeof QUERY_KEYS[number]]: typeof r[string]
      }
    ), [queryParams]);

  return useMemo(() => ({
    seed: pipe(seed, O.fromNullable, O.map(isoSeed.from), O.getOrElseW(() => null)),
    setSeed: flow(isoSeed.to, setSeed),
    model: pipe(model, O.fromNullable, O.chain(S.parseOption(BranchingModelSchema)), O.getOrElseW(() => null)),
    setModel: flow(S.encodeOption(BranchingModelSchema), O.map(setModel)),
    heterogeneity: pipe(heterogeneity, O.fromNullable, O.map(parseFloat), O.chain(S.parseOption(S.number)), O.chain(prismHeterogeneity.getOption), O.getOrElseW(() => null)),
    setHeterogeneity: flow(prismHeterogeneity.reverseGet, n => n.toString(), setHeterogeneity),
    density: pipe(density, O.fromNullable, O.map(parseFloat), O.chain(S.parseOption(S.number)), O.chain(prismDensity.getOption), O.getOrElseW(() => null)),
    setDensity: flow(prismDensity.reverseGet, n => n.toString(), setDensity),
    nodes: pipe(nodes, O.fromNullable, O.map(parseFloat), O.chain(S.parseOption(S.number)), O.chain(prismListLength.getOption), O.getOrElseW(() => null)),
    setNodes: flow(prismListLength.reverseGet, n => n.toString(), setNodes)
  }), [seed, model, heterogeneity, density, nodes]);

}
