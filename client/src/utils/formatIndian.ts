/**
 * Format a number using Indian numbering system (lakhs/crores) with 2 decimal places.
 * Example: 1234567.89 -> "12,34,567.89"
 */
export function formatIndianNumber(num: number | null | undefined): string {
  if (num == null || isNaN(num)) return '0.00';
  const isNegative = num < 0;
  const absNum = Math.abs(num);
  const parts = absNum.toFixed(2).split('.');
  let intPart = parts[0];
  const decPart = parts[1];

  let lastThree = intPart.slice(-3);
  const rest = intPart.slice(0, -3);
  if (rest.length > 0) {
    lastThree = ',' + lastThree;
    const formatted = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    intPart = formatted + lastThree;
  } else {
    intPart = lastThree;
  }

  return (isNegative ? '-' : '') + intPart + '.' + decPart;
}
