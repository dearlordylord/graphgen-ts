export const linearTransformation =
  (x: number) =>
  ([a1, a2]: [number, number] | readonly [number, number]) =>
  ([b1, b2]: [number, number] | readonly [number, number]): number => {
    if (a1 === a2) {
      throw new Error(
        'Invalid input range: the lower and upper bounds of the input range must be different.'
      );
    }
    return ((x - a1) * (b2 - b1)) / (a2 - a1) + b1;
  };
