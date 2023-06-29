import { PositiveInteger, prismPositiveInteger } from 'newtype-ts/lib/PositiveInteger';
import { Heterogeneity } from '@firfi/utils/graph/heterogeneity/types';
import { Decimal0n } from '@firfi/utils/number/decimal0n/types';
import { castDecimal0n } from '@firfi/utils/number/decimal0n/prism';
import { prismHeterogeneity } from '@firfi/utils/graph/heterogeneity/prism';

export const scaleNLPAHeterogeneity =
  (n: PositiveInteger) =>
  (heterogeneity: Heterogeneity): Decimal0n =>
    /*
  f(x) = {
2 * x, if 0 <= x < 0.5,
1 + (n - 1) * (2 * (x - 0.5)), if 0.5 <= x <= 1
}
   */
    castDecimal0n(
      prismHeterogeneity.reverseGet(heterogeneity) < 0.5
        ? 2 * prismHeterogeneity.reverseGet(heterogeneity)
        : 1 + (prismPositiveInteger.reverseGet(n) - 1) * (2 * (prismHeterogeneity.reverseGet(heterogeneity) - 0.5))
    );
