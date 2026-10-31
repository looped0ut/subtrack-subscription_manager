export function todayUTC() {
  return new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
}

export function addDays(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}