import { nlpa, defBiasedDistribution } from './distribution';
import { castRandom01, prismRandom01, Random01, unwrapDecimal01 } from '@firfi/utils/rng';
import { rngStateFromSeed } from '@firfi/utils/rng/seed/seed';
import * as RA from 'fp-ts/ReadonlyArray';
import * as ST from 'fp-ts/State';
import { pipe } from 'fp-ts/function';
import { isoSeed } from '@firfi/utils/rng/seed/iso';
import { castDecimal01, prismDecimal01 } from '@firfi/utils/number/decimal01/prism';
import { castNonNegativeInteger, castPositiveInteger } from '@firfi/utils/positiveInteger';
import { Index } from '@firfi/utils/list/types';
import { prismIndex } from '@firfi/utils/list/prisms';
import { hash } from '@firfi/utils/string';
import { RngState } from './types';

const noll = castDecimal01(0);
const nollR = castRandom01(0);
const middle = castDecimal01(0.5);
const middleR = castRandom01(0.5);
const one = castDecimal01(1);
const oneE = castDecimal01(0.9999999999999998);
const oneR = castRandom01(1 - Number.EPSILON);

const seed = rngStateFromSeed(isoSeed.from(hash('seed1')));

describe('distribution', () => {
  describe('barabasiAlbert', () => {
    it('returns index of a very very heavy node', () => {
      const ba = nlpa()({
        // TODO check cardinality max somewhere
        totalNodes: castPositiveInteger(500),
        totalEdges: castNonNegativeInteger(99999),
        getDegree: (n: Index) => {
          const n_ = prismIndex.reverseGet(n);
          return castNonNegativeInteger(n_ === 420 ? 99999 : 0);
        },
      });
      const seed0 = rngStateFromSeed(isoSeed.from(hash('seed1')));
      expect(ba(seed0)[0]).toBe(castNonNegativeInteger(420));
    });
  });
  describe('biasedDistribution', () => {
    it('returns 0 when K is 0 and n is any value', () => {
      const biasedDistribution = (n: Random01) => defBiasedDistribution(noll)(unwrapDecimal01(n))(seed)[0];
      expect(biasedDistribution(nollR)).toBe(nollR);
      expect(biasedDistribution(middleR)).toBe(nollR);
      expect(biasedDistribution(oneR)).toBe(nollR);
    });

    it('returns 1 when K is 1 and n is any value', () => {
      const biasedDistribution = (n: Random01) => defBiasedDistribution(one)(unwrapDecimal01(n))(seed)[0];
      expect(biasedDistribution(nollR)).toBe(oneE);
      expect(biasedDistribution(middleR)).toBe(oneE);
      expect(biasedDistribution(oneR)).toBe(oneE);
    });

    it('returns n when K is 0.5 and n is any value', () => {
      const biasedDistribution = (n: Random01) => defBiasedDistribution(middle)(unwrapDecimal01(n))(seed)[0];
      expect(biasedDistribution(nollR)).toBe(noll);
      expect(biasedDistribution(middleR)).toBe(middle);
      expect(biasedDistribution(oneR)).toBe(oneE);
    });
    it('returns a result biased towards 1 when K is close to 1', () => {
      const [a1, a2, a3] = [0.6, 0.75, 0.999];
      const [b1, b2, b3] = pipe(
        RA.fromArray([a1, a2, a3]),
        RA.map((k) => (seed: RngState) => defBiasedDistribution(castDecimal01(k))(unwrapDecimal01(middleR))(seed)),
        ST.sequenceArray,
        ST.map(RA.map(prismDecimal01.reverseGet))
      )(seed)[0];
      // and sequence is not guaranteed
      expect(b1).toBeGreaterThan(prismRandom01.reverseGet(middleR));
      expect(b2).toBeGreaterThan(prismRandom01.reverseGet(middleR));
      expect(b3).toBeGreaterThan(prismRandom01.reverseGet(middleR));
    });
  });
});
