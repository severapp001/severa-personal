import { describe, expect, it } from '@jest/globals';
import { MASKED_AMOUNT, displayAmount, formatCLP } from '../money';

describe('formatCLP', () => {
  it('usa punto de miles y sin decimales', () => {
    expect(formatCLP(412300)).toBe('$412.300');
    expect(formatCLP(1250000.6)).toBe('$1.250.001');
    expect(formatCLP(0)).toBe('$0');
    expect(formatCLP(999)).toBe('$999');
  });

  it('marca los negativos', () => {
    expect(formatCLP(-15000)).toBe('−$15.000');
  });
});

describe('displayAmount', () => {
  it('oculta el monto hasta que se toca el ojo', () => {
    expect(displayAmount(412300, false)).toBe(MASKED_AMOUNT);
    expect(displayAmount(412300, true)).toBe('$412.300');
  });

  it('la máscara no deja adivinar la cantidad de dígitos', () => {
    expect(displayAmount(5, false)).toBe(displayAmount(12345678, false));
  });
});
