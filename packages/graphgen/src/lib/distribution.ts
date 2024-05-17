import { State as RngState } from 'seedrandom';
import { PositiveInteger, prismPositiveInteger } from 'newtype-ts/lib/PositiveInteger';
import { castNonNegativeInteger, castPositiveInteger } from '@firfi/utils/positiveInteger';
import { apply, constant, flow, pipe } from 'fp-ts/function';
import * as RA from 'fp-ts/ReadonlyArray';
import * as NEA from 'fp-ts/NonEmptyArray';
import { range } from 'fp-ts/NonEmptyArray';
import * as ST from 'fp-ts/State';
import { State } from 'fp-ts/State';
import * as O from 'fp-ts/Option';
import { castRandom01, prismRandom01, Random01 } from '@firfi/utils/rng';
import { match } from 'ts-pattern';
import { Newtype, prism } from 'newtype-ts';
import { castDecimal01, prismDecimal01 } from '@firfi/utils/number/decimal01/prism';
import { Decimal01 } from '@firfi/utils/number/decimal01/types';
import { castToPrism } from '@firfi/utils/prism';
import { NonNegativeInteger, prismNonNegativeInteger } from 'newtype-ts/lib/NonNegativeInteger';
import { castDecimal0n, prismDecimal0n } from '@firfi/utils/number/decimal0n/prism';
import { prismNonNegative } from 'newtype-ts/lib/NonNegative';
import { Index } from '@firfi/utils/list/types';
import { castIndex } from '@firfi/utils/list/prisms';
import { castDecimal1n, prismDecimal1n } from '@firfi/utils/number/decimal1n/prism';
import { mapDiscreet } from './dnd';
import { random } from '@firfi/utils/rng/random';
import { Semigroup } from 'fp-ts/Semigroup';
import { Eq } from 'fp-ts/Eq';
import { curry2 } from 'fp-ts-std/Function';
import { not } from 'fp-ts/Predicate';

type AdvantageOrDisadvantage = 'advantage' | 'disadvantage';

type TornDecimal01 = Newtype<{ readonly TORNDECIMAL01: unique symbol }, Decimal01>;
export const prismTornDecimal01 = prismDecimal01.compose(
  prism<TornDecimal01>(flow(prismDecimal01.reverseGet, (n) => n !== 0.5))
);
export const castTornDecimal01 = castToPrism(prismTornDecimal01)(
  (n) => `Invalid cast, prismTornDecimal01 can't have 0.5 value: ${n}`
);

const closestFloatTo1 = 1.0 - Number.EPSILON;

// inner usage; in a public API we'd probably allow Decimal01 with 0.5 value
const defDnDBiasedDistribution = (K_: TornDecimal01): State<RngState.Arc4, Random01> => {
  const K = prismTornDecimal01.reverseGet(K_);
  const advOrDisadv: AdvantageOrDisadvantage =
    K < 0.5
      ? 'disadvantage'
      : K > 0.5
      ? 'advantage'
      : (() => {
          throw new Error(`panic! unreachable K ${K}`);
        })();
  const mapMinMaxArgs = (f: typeof Math.max & typeof Math.min) => (a: Random01, b: Random01) =>
    castRandom01(f(prismRandom01.reverseGet(a), prismRandom01.reverseGet(b)));
  const [reducer, unit] = match(advOrDisadv)
    .with('advantage', constant([mapMinMaxArgs(Math.max), castRandom01(0)] as const))
    .with('disadvantage', constant([mapMinMaxArgs(Math.min), castRandom01(closestFloatTo1)] as const))
    .exhaustive();
  const times = mapDiscreet(castDecimal01(Math.abs(prismTornDecimal01.reverseGet(K_) - 0.5) * 2));
  return pipe(
    times,
    prismNonNegativeInteger.reverseGet,
    (n) => Array.from({ length: n }),
    RA.map(() => random),
    ST.sequenceArray,
    ST.map(RA.reduce(unit, reducer))
  );
};

type NodeIndex = Index;

export type DegreeFunction = (node: NodeIndex) => NonNegativeInteger;

const addPositiveIntegers = (a: PositiveInteger, b: PositiveInteger): PositiveInteger =>
  castPositiveInteger(prismPositiveInteger.reverseGet(a) + prismPositiveInteger.reverseGet(b));

const semigroupSumPositiveIntegers: Semigroup<PositiveInteger> = {
  concat: addPositiveIntegers,
};

const addNonNegativeIntegers = (a: NonNegativeInteger, b: NonNegativeInteger): NonNegativeInteger =>
  castNonNegativeInteger(prismNonNegativeInteger.reverseGet(a) + prismNonNegativeInteger.reverseGet(b));

const semigroupSumNonNegativeIntegers: Semigroup<NonNegativeInteger> = {
  concat: addNonNegativeIntegers
}

const dropPositiveIntegerToNonNegativeInteger = (n: PositiveInteger): NonNegativeInteger =>
  castNonNegativeInteger(prismPositiveInteger.reverseGet(n));

const nonNegativeIntegerEq: Eq<NonNegativeInteger> = {
  equals: (a, b) => prismNonNegativeInteger.reverseGet(a) === prismNonNegativeInteger.reverseGet(b),
}

const positiveIntegerEq: Eq<PositiveInteger> = {
  equals: (a, b) => prismPositiveInteger.reverseGet(a) === prismPositiveInteger.reverseGet(b),
};

const assertDenormalizedProbabilitiesTotal = (denormalizedProbabilitiesTotal: PositiveInteger, totalEdges: NonNegativeInteger, totalNodesFairnessModificator: NonNegativeInteger) => {
  if (
    pipe(
      nonNegativeIntegerEq.equals,
      curry2,
      apply(dropPositiveIntegerToNonNegativeInteger(denormalizedProbabilitiesTotal)),
      not,
      apply(addNonNegativeIntegers(totalEdges, totalNodesFairnessModificator))
    )
  ) {
    throw new Error(
      `panic! denormalizedProbabilitiesTotal_ !== sumOfDegrees_ + totalNodesFairnessModificator: ${prismPositiveInteger.reverseGet(denormalizedProbabilitiesTotal)} !== ${prismNonNegativeInteger.reverseGet(totalEdges)} + ${totalNodesFairnessModificator}`
    );
  }
}

export const nlpa_ = (alpha = castDecimal0n(1)) =>
  ({
     totalNodes,
     getDegree,
     totalEdges,
   }: {
    totalNodes: PositiveInteger;
    getDegree: DegreeFunction;
    totalEdges: NonNegativeInteger;
  }) => (seed: Random01) => {
    const ZERO_CONNECTION_NODE_FAIRNESS = castNonNegativeInteger(1); // signifies that we want to give the nodes with 0 connections some chance
    const nodeFairnessK = prismNonNegativeInteger.reverseGet(ZERO_CONNECTION_NODE_FAIRNESS);
    const totalNodes_ = prismPositiveInteger.reverseGet(totalNodes);
    const totalNodesFairnessModificator = castNonNegativeInteger(totalNodes_ * nodeFairnessK);
    // number of edges ONCE cause the graph is directed
    const sumOfDegrees_ = prismNonNegativeInteger.reverseGet(totalEdges);
    // because floats would lose some precision and would make the sum !== 1
    const denormalizedProbabilities = pipe(
      range(0, prismNonNegativeInteger.reverseGet(castNonNegativeInteger(totalNodes_ - 1))),
      NEA.map(
        flow(castIndex, getDegree, prismNonNegativeInteger.reverseGet, (i) => i + nodeFairnessK, castPositiveInteger)
      )
    );
    const denormalizedProbabilitiesCount = castPositiveInteger(denormalizedProbabilities.length); // is non empty array
    // floats...
    // assert.equal(pipe(probabilities, NEA.map(prismDecimal0n.reverseGet), RA.reduce(0, (a, b) => a + b)), 1);
    const denormalizedProbabilitiesTotal = pipe(
      denormalizedProbabilities,
      NEA.concatAll(semigroupSumPositiveIntegers),
    );
    const denormalizedProbabilitiesTotal_ = prismPositiveInteger.reverseGet(denormalizedProbabilitiesTotal);
    assertDenormalizedProbabilitiesTotal(denormalizedProbabilitiesTotal, totalEdges, totalNodesFairnessModificator);
    if (pipe(positiveIntegerEq.equals, curry2, apply(denormalizedProbabilitiesCount), not, apply(totalNodes))) {
      throw new Error(
        `panic! denormalizedProbabilities.length !== totalNodes_: ${denormalizedProbabilities.length} !== ${totalNodes_}`
      );
    }
    const randomValue_ = prismRandom01.reverseGet(seed);
    const randomValueDenormalized = castDecimal1n(randomValue_ * denormalizedProbabilitiesTotal_ + 1);
    const randomValueDenormalizedAndAlfaScaled = castDecimal1n(
      prismDecimal1n.reverseGet(randomValueDenormalized) ** prismDecimal0n.reverseGet(alpha)
    );
    // Select a node based on the calculated probabilities
    // TODO probably should be a transducer but we don't thi.ng currently
    let cumulativeDenormalizedProbability = castDecimal0n(0);
    for (let i = 0; i < totalNodes_; i++) {
      // TODO better way to do this?
      cumulativeDenormalizedProbability = castDecimal0n(
        prismDecimal0n.reverseGet(cumulativeDenormalizedProbability) +
        Math.pow(prismPositiveInteger.reverseGet(denormalizedProbabilities[i]), prismNonNegative.reverseGet(alpha))
      );
      if (
        prismNonNegative.reverseGet(randomValueDenormalizedAndAlfaScaled) <=
        prismDecimal0n.reverseGet(cumulativeDenormalizedProbability)
      ) {
        return castIndex(i);
      }
    }

    // TODO check this, this is what chatgpt says; note that randomValue never == 1
    // In the rare case that the randomValue is close to 1, return the last node
    return castIndex(totalNodes_ - 1);
  }

// https://en.wikipedia.org/wiki/Non-linear_preferential_attachment
export const nlpa =
  (alpha = castDecimal0n(1)) =>
  ({
    totalNodes,
    getDegree,
    totalEdges,
  }: {
    totalNodes: PositiveInteger;
    getDegree: DegreeFunction;
    totalEdges: NonNegativeInteger;
  }) =>
  (rngState: RngState.Arc4): [NodeIndex, RngState.Arc4] => {
    const [randomValue, rngState1] = random(rngState);
    const nodeIndex = nlpa_(alpha)({ totalNodes, getDegree, totalEdges })(randomValue);
    return [nodeIndex, rngState1];
  };

export const defBiasedDistribution =
  (K_: Decimal01) =>
  (n_: Random01): State<RngState.Arc4, Random01> => {
    const K = prismDecimal01.reverseGet(K_);
    const n = prismRandom01.reverseGet(n_);
    const hardcoded = pipe(
      K === 0 ? 0 : K === 1 ? closestFloatTo1 : K === 0.5 ? n : null,
      O.fromNullable,
      O.map(castRandom01)
    );
    return pipe(
      hardcoded,
      O.fold(() => defDnDBiasedDistribution(castTornDecimal01(K)), ST.of)
    );
  };
