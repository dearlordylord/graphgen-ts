import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { BranchingModel, BranchingModelSchema } from '@firfi/graphgen/types';
import { Heterogeneity } from '@firfi/utils/graph/heterogeneity/types';
import { castSeed, prismSeed, Seed } from '@firfi/utils/rng/seed/types';
import { Density } from '@firfi/utils/graph/density/types';
import * as RA from 'fp-ts/ReadonlyArray';
import { flow, pipe } from 'fp-ts/function';
import * as S from '@effect/schema/Schema';
import * as O from 'fp-ts/Option';
import { prismHeterogeneity } from '@firfi/utils/graph/heterogeneity/prism';
import { prismDensity } from '@firfi/utils/graph/density/prism';
import {
  Pipe,
  Objects,
  Strings,
  Booleans,
  Fn,
  Functions,
  Compose,
} from 'hotscript';
import { prismListLength } from '@firfi/utils/list/prisms';
import { ListLength } from '@firfi/utils/list/types';
import { Option } from 'fp-ts/Option';
import * as Struct from 'fp-ts/struct';
import { sequenceS } from 'fp-ts/Apply';
import { hash } from '@firfi/utils/string';

export const useQueryParams = (): readonly [
  URLSearchParams,
  (k: string) => (v: string | null) => void
] => {
  const [queryParams, setQueryParams] = useState(
    new URLSearchParams(window.location.search)
  );

  useEffect(() => {
    const onHistoryChange = () => {
      setQueryParams(new URLSearchParams(window.location.search));
    };

    window.addEventListener('popstate', onHistoryChange);
    return () => window.removeEventListener('popstate', onHistoryChange);
  }, []);

  const setParam = useCallback(
    (key: string) => (value: string | null) => {
      if (value === null) {
        queryParams.delete(key);
      } else {
        queryParams.set(key, value);
      }

      setQueryParams(new URLSearchParams(queryParams));
    },
    [queryParams]
  );

  const lastQueryParamsRef = useRef(queryParams.toString());
  // hope is this will catch the case when I change many query parameters one by one in one loop
  useEffect(() => {
    if (lastQueryParamsRef.current === queryParams.toString()) return;
    window.location.search = queryParams.toString();
    lastQueryParamsRef.current = queryParams.toString();
  }, [queryParams.toString()]);

  return [queryParams, setParam] as const;
};

const SEED_KEY = 'seed' as const;
const MODEL_KEY = 'model' as const;
const HETEROGENEITY_KEY = 'heterogeneity' as const;
const DENSITY_KEY = 'density' as const;
const NODES_KEY = 'nodes' as const;

export const QUERY_KEYS = [
  SEED_KEY,
  MODEL_KEY,
  HETEROGENEITY_KEY,
  DENSITY_KEY,
  NODES_KEY,
] as const;

export type GraphUrlParamsStrict = {
  [SEED_KEY]: Seed;
  [MODEL_KEY]: BranchingModel;
  [HETEROGENEITY_KEY]: Heterogeneity;
  [DENSITY_KEY]: Density;
  [NODES_KEY]: ListLength;
};

const graphUrlParamsParsers = {
  [SEED_KEY]: flow(hash, prismSeed.getOption),
  [MODEL_KEY]: S.parseOption(BranchingModelSchema),
  [HETEROGENEITY_KEY]: flow(
    parseFloat,
    S.parseOption(S.number),
    O.chain(prismHeterogeneity.getOption)
  ),
  [DENSITY_KEY]: flow(
    parseFloat,
    S.parseOption(S.number),
    O.chain(prismDensity.getOption)
  ),
  [NODES_KEY]: flow(
    parseFloat,
    S.parseOption(S.number),
    O.chain(prismListLength.getOption)
  ),
};

export const parseGraphUrlParamsStrict = (queryParams: {
  [k in (typeof QUERY_KEYS)[number]]: string;
}): Option<GraphUrlParamsStrict> =>
  pipe(
    queryParams,
    Struct.evolve(graphUrlParamsParsers),
    sequenceS(O.Applicative)
  );

interface Nulliate extends Fn {
  return: this['arg0'] | null;
}

interface Setterize extends Fn {
  return: (s: this['arg0']) => void;
}

export type GraphUrlParamsSetters = Pipe<
  GraphUrlParamsStrict,
  [
    Objects.MapKeys<Compose<[Strings.Prepend<'set'>, Strings.Capitalize]>>,
    Objects.MapValues<Setterize>
  ]
>;
type GraphUrlParams = Pipe<GraphUrlParamsStrict, [Objects.MapValues<Nulliate>]>;

type Res = Pipe<GraphUrlParams, [Objects.Assign<GraphUrlParamsSetters>]>;

export const useGraphQueryParams = (): Res => {
  const [queryParams, set] = useQueryParams();

  const {
    seed: { value: seed, setter: setSeed },
    model: { value: model, setter: setModel },
    heterogeneity: { value: heterogeneity, setter: setHeterogeneity },
    density: { value: density, setter: setDensity },
    nodes: { value: nodes, setter: setNodes },
  } = useMemo(
    () =>
      pipe(
        QUERY_KEYS,
        RA.map(
          (k) =>
            [
              k,
              {
                value: queryParams.get(k),
                setter: set(k),
              },
            ] as const
        ),
        (es) => Object.fromEntries(es),
        (r) =>
          r as {
            [K in (typeof QUERY_KEYS)[number]]: (typeof r)[string];
          }
      ),
    [queryParams]
  );

  // TODO dry me
  return useMemo(() => {
    const nonStrictParser = <T>(f: (s: string) => Option<T>) =>
      flow(
        O.fromNullable<string | null>,
        O.chain(f),
        O.getOrElseW(() => null)
      );
    const nonStrictParsers = pipe(
      graphUrlParamsParsers,
      Struct.evolve({
        [SEED_KEY]: (f) => nonStrictParser(f),
        [MODEL_KEY]: (f) => nonStrictParser(f),
        [HETEROGENEITY_KEY]: (f) => nonStrictParser(f),
        [DENSITY_KEY]: (f) => nonStrictParser(f),
        [NODES_KEY]: (f) => nonStrictParser(f),
      })
    );
    return {
      ...nonStrictParsers,
      seed: pipe(seed, nonStrictParsers[SEED_KEY]),
      setSeed: flow(prismSeed.reverseGet, (a) => a.toString(), setSeed),
      model: pipe(model, nonStrictParsers[MODEL_KEY]),
      setModel: flow(S.encodeOption(BranchingModelSchema), O.map(setModel)),
      heterogeneity: pipe(heterogeneity, nonStrictParsers[HETEROGENEITY_KEY]),
      setHeterogeneity: flow(
        prismHeterogeneity.reverseGet,
        (n) => n.toString(),
        setHeterogeneity
      ),
      density: pipe(density, nonStrictParsers[DENSITY_KEY]),
      setDensity: flow(
        prismDensity.reverseGet,
        (n) => n.toString(),
        setDensity
      ),
      nodes: pipe(nodes, nonStrictParsers[NODES_KEY]),
      setNodes: flow(prismListLength.reverseGet, (n) => n.toString(), setNodes),
    };
  }, [seed, model, heterogeneity, density, nodes]);
};
