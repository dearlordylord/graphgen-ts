import { GraphUrlParamsStrict, parseGraphUrlParamsStrict, QUERY_KEYS } from './useQueryParams';
import { isNone, none, Option } from 'fp-ts/Option';
import * as O from 'fp-ts/Option';
import * as S from '@effect/schema/Schema';
import { flow, pipe } from 'fp-ts/function';
import { useEffect, useState } from 'react';
import * as A from 'fp-ts/Array';
import { Isomorphism } from 'fp-ts-std/Isomorphism';


export const MemoParamsSerializedSchema = S.string.pipe(S.brand("MemoParamsSerialized"));
export type MemoParamsSerialized = S.To<typeof MemoParamsSerializedSchema>;

const KV_SEPARATOR = '>' as const;
const GROUP_SEPARATOR = '|' as const;

export const serializeMemoParams = (params: GraphUrlParamsStrict): MemoParamsSerialized => {
  return pipe(params,
      p => Object.entries(p),
    A.filter(([k]) => QUERY_KEYS.includes(k as typeof QUERY_KEYS[number])),
    A.sort<[string, unknown]>({
      equals: ([k1], [k2]) => k1 === k2,
      compare: ([k1], [k2]) => ((n) => n === 0 ? 0 : n > 0 ? 1 : -1)(k1.localeCompare(k2))
    }),
    A.map(([k, v]) => `${k}${KV_SEPARATOR}${v}`),
    a => a.join(GROUP_SEPARATOR) as MemoParamsSerialized
  );
};

export const deserializeMemoParams = (s: MemoParamsSerialized): GraphUrlParamsStrict => {
  const params = s.split(GROUP_SEPARATOR).map(s => s.split(KV_SEPARATOR));
  const o = pipe(params,
    A.filter(([k]) => QUERY_KEYS.includes(k as typeof QUERY_KEYS[number])),
    A.map(([k, v]) => [k, v] as [typeof k, typeof v]),
    Object.fromEntries,
    parseGraphUrlParamsStrict,
  );
  if (isNone(o)) {
    throw new Error(`panic! MemoParamsSerialized assumed to be always correct serialisation ${s}`);
  }
  return o.value;
}

export const memoParamsIsomorphism: Isomorphism<GraphUrlParamsStrict, MemoParamsSerialized> = {
  to: serializeMemoParams,
  from: deserializeMemoParams
};

const LayoutMemoNodeSchema = S.struct({
  index: S.number,
  x: S.number,
  y: S.number,
  vx: S.number,
  vy: S.number
});
const LayoutMemoSchema = S.record(S.string, LayoutMemoNodeSchema);

type LayoutMemo = S.From<typeof LayoutMemoSchema>;

// what files we have - don't make the user going through the network excessively
export const LAYOUT_MEMO_INDEX = [
  'density>0.08|heterogeneity>0.44|model>barabasi-albert|nodes>788|seed>seed2' as MemoParamsSerialized,
];

export const PresetLabelSchema = S.string.pipe(S.brand("PresetLabel"));
export type PresetLabel = S.To<typeof PresetLabelSchema>;

export const LAYOUT_MEMO_INDEX_LABELED: {
  [k in typeof LAYOUT_MEMO_INDEX[number]]: PresetLabel
} = {
  [LAYOUT_MEMO_INDEX[0]]: 'organic-medium' as PresetLabel
}

const tryLayoutMemo = (params: GraphUrlParamsStrict): Promise<Option<LayoutMemo>> => fetch(`/layout/memo/${serializeMemoParams(params)}.json`).then(r => r.json()).then(flow(S.parseOption(LayoutMemoSchema))).catch(() => none);

const getLayoutMemo = (params: GraphUrlParamsStrict): Promise<Option<LayoutMemo>> => LAYOUT_MEMO_INDEX.includes(serializeMemoParams(params)) ? tryLayoutMemo(params) : Promise.resolve(none);

export const useLayoutMemo = (params: GraphUrlParamsStrict): {
  layoutMemo: LayoutMemo | null,
  loading: boolean,
  loaded: boolean,
} => {
  const [layoutMemo, setLayoutMemo] = useState<LayoutMemo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // I'll be called twice with React.Strict mode but not on production!
    setLoading(true);
    setLayoutMemo(null);
    setLoaded(false);
    getLayoutMemo(params).then((layoutMemo) => {
      setLayoutMemo(pipe(layoutMemo, O.getOrElseW(() => null)));
      setLoading(false);
      setLoaded(true);
    });
  }, [serializeMemoParams(params)]);

  return { layoutMemo, loading, loaded };
}
