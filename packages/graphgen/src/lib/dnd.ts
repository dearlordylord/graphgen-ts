import { castPositiveInteger } from '@firfi/utils/positiveInteger';
import { map01To0n } from '@firfi/utils/number/range/map01To0n';

const MAX_ROLLS = 13;
export const mapDiscreet = map01To0n(castPositiveInteger(MAX_ROLLS));
