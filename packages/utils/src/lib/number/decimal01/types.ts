import { Newtype } from 'newtype-ts';
import { NonNegative } from 'newtype-ts/lib/NonNegative';

export type Decimal01 = Newtype<
  { readonly DECIMAL01: unique symbol },
  NonNegative
>;
