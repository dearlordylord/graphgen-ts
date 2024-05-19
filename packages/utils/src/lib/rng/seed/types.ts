import { Newtype } from 'newtype-ts';

export type Seed = Newtype<{ readonly SEED: unique symbol }, number>;
