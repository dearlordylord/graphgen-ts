import { linearTransformation } from './distribution';

describe('distribution', () => {
  describe('linear transformation', () => {
    test('maps from [0, 1] to [0, 10]', () => {
      const result = linearTransformation(0.5)([0, 1])([0, 10]);
      expect(result).toBeCloseTo(5);
    });

    test('maps from [-5, 5] to [0, 100]', () => {
      const result = linearTransformation(0)([-5, 5])([0, 100]);
      expect(result).toBeCloseTo(50);
    });

    test('maps from [0, 100] to [-1, 1]', () => {
      const result = linearTransformation(50)([0, 100])([-1, 1]);
      expect(result).toBeCloseTo(0);
    });

    test('maps from [0, 1] to [0, 1] (identity)', () => {
      const result = linearTransformation(0.25)([0, 1])([0, 1]);
      expect(result).toBeCloseTo(0.25);
    });
    test('maps from [0, 1] to [1, 1] (zero range)', () => {
      const result = linearTransformation(0.5)([0, 1])([1, 1]);
      expect(result).toBeCloseTo(1);
    });

    test('throws an error when input range has zero width', () => {
      expect(() => linearTransformation(1)([1, 1])([0, 10])).toThrowError(
        'Invalid input range: the lower and upper bounds of the input range must be different.'
      );
    });

    test('maps from [-5, 5] to [-5, -5] (zero output range)', () => {
      const result = linearTransformation(0)([-5, 5])([-5, -5]);
      expect(result).toBeCloseTo(-5);
    });

    test('maps the lower boundary of the input range', () => {
      const result = linearTransformation(0)([0, 1])([10, 20]);
      expect(result).toBeCloseTo(10);
    });

    test('maps the upper boundary of the input range', () => {
      const result = linearTransformation(1)([0, 1])([10, 20]);
      expect(result).toBeCloseTo(20);
    });
  });
});
