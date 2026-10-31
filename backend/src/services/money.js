// All values are whole paise; the tax rate is in basis points (1800 = 18%)
export function calcLine(quantity, unitPrice, taxRateBps = 0) {
  const subtotal = quantity * unitPrice;
  const tax = Math.round((subtotal * taxRateBps) / 10000);
  return { subtotal, tax, total: subtotal + tax };
}