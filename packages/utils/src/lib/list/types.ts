import { Newtype } from 'newtype-ts';
import { NonNegativeInteger } from 'newtype-ts/lib/NonNegativeInteger';

export type ListLength = Newtype<{ readonly LIST_LENGTH: unique symbol }, NonNegativeInteger>;

export type Index = Newtype<{ readonly LIST_LENGTH: unique symbol }, NonNegativeInteger>;
