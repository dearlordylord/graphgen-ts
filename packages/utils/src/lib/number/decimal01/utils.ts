import { Integer, prismInteger } from 'newtype-ts/lib/Integer';

export const intTo01 = (n: Integer) => (prismInteger.reverseGet(n) >>> 0) / 0x100000000;
