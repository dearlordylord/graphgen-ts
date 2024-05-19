import { Index } from '@firfi/utils/list/types';
import {
  BARABASI_ALBERT_BRANCHING_MODEL_NAME,
  BRANCHING_MODELS,
  DND_BRANCHING_MODEL_NAME,
} from '@firfi/graphgen/constants';
import * as S from '@effect/schema/Schema';

export type GraphStreamOp<Id = Index> =
  | { op: 'addNode'; id: Id }
  | { op: 'addEdge'; from: Id; to: Id };

export const BranchingModelSchema = S.literal(...BRANCHING_MODELS);
export type BranchingModel = S.To<typeof BranchingModelSchema>;

// using purerand xoroshiro128plus
export type RngState = readonly number[];
