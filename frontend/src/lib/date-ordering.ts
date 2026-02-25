type DueComparable = {
  id?: string
  due_date?: string | null
  updated_at?: string | null
}

function toTime(value: string | null | undefined, fallback: number) {
  if (!value) {
    return fallback
  }

  const time = Date.parse(value)
  return Number.isNaN(time) ? fallback : time
}

function compareText(left: string | undefined, right: string | undefined) {
  return (left ?? '').localeCompare(right ?? '')
}

export function compareByNearestDue(left: DueComparable, right: DueComparable) {
  const dueDiff = toTime(left.due_date, Number.POSITIVE_INFINITY) - toTime(right.due_date, Number.POSITIVE_INFINITY)
  if (dueDiff !== 0) {
    return dueDiff
  }

  const updatedDiff = toTime(right.updated_at, 0) - toTime(left.updated_at, 0)
  if (updatedDiff !== 0) {
    return updatedDiff
  }

  return compareText(left.id, right.id)
}

type DueGroupComparable = {
  due_date: string
}

export function compareGroupsByNearestDue(left: DueGroupComparable, right: DueGroupComparable) {
  const dueDiff = toTime(left.due_date, Number.POSITIVE_INFINITY) - toTime(right.due_date, Number.POSITIVE_INFINITY)
  if (dueDiff !== 0) {
    return dueDiff
  }

  return left.due_date.localeCompare(right.due_date)
}
