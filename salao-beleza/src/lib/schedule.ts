const HOUR_IN_MILLISECONDS = 60 * 60_000;

export function getOccupiedHourKeys(startDate: Date, durationMinutes: number): string[] {
  const start = startDate.getTime();
  if (Number.isNaN(start) || !Number.isInteger(durationMinutes) || durationMinutes <= 0) {
    throw new RangeError('A data de início e a duração do serviço devem ser válidas.');
  }

  const end = start + durationMinutes * 60_000;
  const firstHour = Math.floor(start / HOUR_IN_MILLISECONDS) * HOUR_IN_MILLISECONDS;
  const occupiedKeys: string[] = [];

  for (let slotStart = firstHour; slotStart < end; slotStart += HOUR_IN_MILLISECONDS) {
    occupiedKeys.push(new Date(slotStart).toISOString());
  }

  return occupiedKeys;
}
