import { Integer, prismInteger } from 'newtype-ts/lib/Integer';
import { castToPrism } from '@firfi/utils/prism';

export const castInteger = castToPrism(prismInteger)(
  (n) => `Invalid cast, prismInteger is not in range: ${n}`
);
