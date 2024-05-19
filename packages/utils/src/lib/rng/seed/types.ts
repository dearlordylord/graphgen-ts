import { Newtype, prism } from 'newtype-ts';
import { Integer, prismInteger } from 'newtype-ts/lib/Integer';
import { flow } from 'fp-ts/function';
import { castToPrism } from '@firfi/utils/prism';

export type Seed = Newtype<{ readonly SEED: unique symbol }, Integer>;

export const prismSeed = prismInteger.compose(
  prism<Seed>(flow(prismInteger.reverseGet, () => true))
);

export const castSeed = castToPrism(prismSeed)(
  (n) => `Invalid cast, prismSeed: ${n}`
);
