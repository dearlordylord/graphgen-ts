import { Heterogeneity } from '@firfi/utils/graph/heterogeneity/types';
import { Decimal0n } from '@firfi/utils/number/decimal0n/types';
import { castDecimal0n } from '@firfi/utils/number/decimal0n/prism';
import { prismHeterogeneity } from '@firfi/utils/graph/heterogeneity/prism';

export const scaleNLPAHeterogeneity =
  (heterogeneity: Heterogeneity): Decimal0n =>
    castDecimal0n(
      2 * prismHeterogeneity.reverseGet(heterogeneity)
    );
