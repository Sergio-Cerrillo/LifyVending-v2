export const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export const boundedPercent = (value: number) => Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));

export function simpleMachineCommission(gross: number, hiddenPercent: number, paymentPercent: number) {
  const visible = roundMoney(gross * (1 - boundedPercent(hiddenPercent) / 100));
  return { gross, visible, hidden: roundMoney(gross - visible), commission: roundMoney(visible * boundedPercent(paymentPercent) / 100) };
}

export function productCommission(sold: number, tests: number, sale: number, purchase: number, percent: number, fixedPerBottle: number | null = null) {
  const testUnits = Math.min(Math.max(0, sold), Math.max(0, tests));
  const payableUnits = Math.max(0, sold - testUnits);
  const difference = roundMoney(sale - purchase);
  const commissionAmount = roundMoney(payableUnits * (fixedPerBottle === null ? Math.max(0, difference) * boundedPercent(percent) / 100 : Math.max(0, fixedPerBottle)));
  return { testUnits, payableUnits, difference, commissionAmount };
}

// Cada extremo usa su propio desfase: octubre y marzo pueden cambiar de hora.
export function previousMadridMonthRange(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', year: 'numeric', month: 'numeric' }).formatToParts(now);
  const yearNow = Number(parts.find(p => p.type === 'year')?.value);
  const monthNow = Number(parts.find(p => p.type === 'month')?.value);
  const previous = new Date(Date.UTC(yearNow, monthNow - 2, 1));
  const year = previous.getUTCFullYear();
  const month = previous.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const localIso = (day: number, time: string) => {
    const probe = new Date(Date.UTC(year, month - 1, day, 12));
    const offset = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Madrid', timeZoneName: 'longOffset' }).formatToParts(probe).find(p => p.type === 'timeZoneName')!.value.replace('GMT', '');
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${time}${offset}`;
  };
  return { year, month, startDate: localIso(1, '00:00:00'), endDate: localIso(lastDay, '23:59:59.999') };
}
