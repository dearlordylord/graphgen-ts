import { Index } from '@firfi/utils/list/types';
import { BARABASI_ALBERT_BRANCHING_MODEL_NAME, DND_BRANCHING_MODEL_NAME } from '@firfi/graphgen/constants';

export type GraphStreamOp<Id = Index> = { op: 'addNode'; id: Id } | { op: 'addEdge'; from: Id; to: Id };
export type BranchingModel = typeof BARABASI_ALBERT_BRANCHING_MODEL_NAME | typeof DND_BRANCHING_MODEL_NAME;
