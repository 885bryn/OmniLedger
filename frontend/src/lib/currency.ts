function hasFractionalCents(value: number) {
  return Math.abs(value % 1) > Number.EPSILON
}

export function formatCurrency(value: number, locale?: string | string[]) {
  const includeCents = hasFractionalCents(value)

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: includeCents ? 2 : 0,
    maximumFractionDigits: includeCents ? 2 : 0,
  }).format(value)
}

export function formatNullableCurrency(value: number | null, locale?: string | string[]) {
  if (value === null || Number.isNaN(value)) {
    return null
  }

  return formatCurrency(value, locale)
}
