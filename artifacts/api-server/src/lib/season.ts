// Determine current La Liga season year (the year the season started in).
// La Liga typically runs August → May, so months Jan–Jun belong to the previous calendar year's season.
export function currentSeasonStartYear(now: Date = new Date()): number {
  const month = now.getUTCMonth() + 1; // 1..12
  const year = now.getUTCFullYear();
  return month >= 7 ? year : year - 1;
}

export function seasonLabel(startYear: number = currentSeasonStartYear()): string {
  const y2 = (startYear + 1) % 100;
  return `${startYear}-${String(y2).padStart(2, "0")}`;
}
