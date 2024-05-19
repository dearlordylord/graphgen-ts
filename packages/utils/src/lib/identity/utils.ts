import * as ST from 'fp-ts/State';
import { State } from 'fp-ts/State';
import { apply, flow, pipe } from 'fp-ts/function';
import * as A from 'fp-ts/Array';
import { v4 } from 'uuid';
import { prismRandom0255, random0255 } from '../rng/random255';
import { RngState } from '@firfi/graphgen/types';

export type AnonymizedIdentityState = { identityMap: IdentityMap; rng: RngState };
export const getRandomIdentityForNumber = (id: number): State<AnonymizedIdentityState, string> =>
  flow(
    ST.gets(({ identityMap, rng }) => {
      const existing = identityMap[id];
      if (existing) return [existing, { identityMap, rng }] as [string, AnonymizedIdentityState];
      const [rand16, newRng] = pipe(
        Array.from({
          length: 16,
        }),
        A.map(() => random0255),
        A.sequence(ST.Applicative),
        apply(rng)
      );
      const newId = v4({
        random: rand16.map(prismRandom0255.reverseGet),
      });
      return [newId, { identityMap: { ...identityMap, [id]: newId }, rng: newRng }] as [
        string,
        AnonymizedIdentityState
      ];
    }),
    ([[id, toAdd], map]) => [id, { ...map, ...toAdd }]
  );
export type IdentityMap = { [id in number]: string };
