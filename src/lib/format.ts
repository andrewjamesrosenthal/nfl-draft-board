export function formatHeight(inches?: number | null): string {
  if (!inches) return "--";
  const ft = Math.floor(inches / 12);
  const inch = inches % 12;
  return `${ft}'${inch}"`;
}

export function formatWeight(weight?: number | null): string {
  if (!weight) return "--";
  return `${weight} lbs`;
}

export function formatForty(sec?: number | null): string {
  if (!sec) return "--";
  return sec.toFixed(2);
}

export function formatFloat(value?: number | null, digits = 2): string {
  if (value == null) return "--";
  return value.toFixed(digits);
}

export function formatInches(inches?: number | null): string {
  if (inches == null) return "--";
  return `${inches.toFixed(2)}"`;
}

export function formatAge(age?: number | null): string {
  if (!age) return "--";
  return age.toFixed(1);
}

export function formatRating(rating: number): string {
  return Math.round(rating).toString();
}

export function formatPickNumber(pick: number): string {
  const round = Math.ceil(pick / 32);
  const slot = ((pick - 1) % 32) + 1;
  return `R${round}.${slot.toString().padStart(2, "0")} (${pick})`;
}
