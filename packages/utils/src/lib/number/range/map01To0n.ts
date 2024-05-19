import {
  PositiveInteger,
  prismPositiveInteger,
} from 'newtype-ts/lib/PositiveInteger';
import { Decimal01 } from '../decimal01/types';
import { NonNegativeInteger } from 'newtype-ts/lib/NonNegativeInteger';
import { prismDecimal01 } from '../decimal01/prism';
import { castNonNegativeInteger } from '../../positiveInteger';

export const map01To0n =
  (k_: PositiveInteger) =>
  (decimal_: Decimal01): NonNegativeInteger => {
    const k = prismPositiveInteger.reverseGet(k_);
    const decimal = prismDecimal01.reverseGet(decimal_);
    const rangeSize = 1 / k;
    return castNonNegativeInteger(Math.floor(decimal / rangeSize));
  };
