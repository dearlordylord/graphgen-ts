import { Newtype } from 'newtype-ts';
import { Decimal01 } from '../../number/decimal01/types';

export type Heterogeneity = Newtype<{ readonly HETEROGENEITY: unique symbol }, Decimal01>;
