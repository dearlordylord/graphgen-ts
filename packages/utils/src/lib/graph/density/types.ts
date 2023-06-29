import { Newtype } from 'newtype-ts';
import { Decimal01 } from '../../number/decimal01/types';

export type Density = Newtype<{ readonly DENSITY: unique symbol }, Decimal01>;
