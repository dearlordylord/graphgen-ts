import { scaleNLPAHeterogeneity } from './barabasiAlbert';
import { castHeterogeneity } from '@firfi/utils/graph/heterogeneity/prism';
import { castPositiveInteger } from '@firfi/utils/positiveInteger';
import { prismDecimal0n } from '@firfi/utils/number/decimal0n/prism';
import { prismPositiveInteger } from 'newtype-ts/lib/PositiveInteger';

describe('barabasiAlbert scale', () => {
  it('scales heterogeneity in the range [0, 0.5] to [0, 1]', () => {
    const n = castPositiveInteger(5);
    expect(prismDecimal0n.reverseGet(scaleNLPAHeterogeneity(n)(castHeterogeneity(0)))).toBeCloseTo(0);
    expect(prismDecimal0n.reverseGet(scaleNLPAHeterogeneity(n)(castHeterogeneity(0.25)))).toBeCloseTo(0.5);
    expect(prismDecimal0n.reverseGet(scaleNLPAHeterogeneity(n)(castHeterogeneity(0.5)))).toBeCloseTo(1);
  });

  it('scales heterogeneity in the range (0.5, 1] to (1, n]', () => {
    const n = castPositiveInteger(5);
    expect(prismDecimal0n.reverseGet(scaleNLPAHeterogeneity(n)(castHeterogeneity(0.75)))).toBeCloseTo(
      (1 + prismPositiveInteger.reverseGet(n)) / 2
    );
    expect(prismDecimal0n.reverseGet(scaleNLPAHeterogeneity(n)(castHeterogeneity(1)))).toBeCloseTo(
      prismPositiveInteger.reverseGet(n)
    );
  });
});
