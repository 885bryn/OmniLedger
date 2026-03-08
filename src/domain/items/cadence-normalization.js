"use strict";

const WEEKS_PER_YEAR = 52;
const MONTHS_PER_YEAR = 12;
const CADENCE_EQUIVALENCE_TOLERANCE = 0.01;

const RECURRING_FREQUENCY_YEARLY_FACTORS = Object.freeze({
  weekly: WEEKS_PER_YEAR,
  biweekly: WEEKS_PER_YEAR / 2,
  monthly: MONTHS_PER_YEAR,
  quarterly: 4,
  yearly: 1
});

const BANKERS_ROUNDING = Object.freeze({
  mode: "half_to_even",
  decimals: 2
});

function normalizeFrequencyValue(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function resolveYearlyFactor(frequency) {
  const normalized = normalizeFrequencyValue(frequency);
  const yearlyFactor = RECURRING_FREQUENCY_YEARLY_FACTORS[normalized];

  if (typeof yearlyFactor !== "number") {
    return {
      isValid: false,
      normalizedFrequency: normalized || null,
      yearlyFactor: null,
      reason: "invalid_frequency"
    };
  }

  return {
    isValid: true,
    normalizedFrequency: normalized,
    yearlyFactor,
    reason: null
  };
}

function toYearlyBaseline(amount, frequency) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) {
    return {
      isValid: false,
      reason: "invalid_amount",
      normalizedFrequency: null,
      yearlyAmount: null
    };
  }

  const factor = resolveYearlyFactor(frequency);
  if (!factor.isValid) {
    return {
      isValid: false,
      reason: factor.reason,
      normalizedFrequency: factor.normalizedFrequency,
      yearlyAmount: null
    };
  }

  return {
    isValid: true,
    reason: null,
    normalizedFrequency: factor.normalizedFrequency,
    yearlyAmount: numericAmount * factor.yearlyFactor
  };
}

function fromYearlyBaseline(yearlyAmount) {
  return {
    yearly: yearlyAmount,
    monthly: yearlyAmount / MONTHS_PER_YEAR,
    weekly: yearlyAmount / WEEKS_PER_YEAR
  };
}

function normalizeRecurringAmount(amount, frequency) {
  const yearlyBaseline = toYearlyBaseline(amount, frequency);
  if (!yearlyBaseline.isValid) {
    return {
      isValid: false,
      reason: yearlyBaseline.reason,
      normalizedFrequency: yearlyBaseline.normalizedFrequency,
      cadenceTotals: null
    };
  }

  return {
    isValid: true,
    reason: null,
    normalizedFrequency: yearlyBaseline.normalizedFrequency,
    cadenceTotals: fromYearlyBaseline(yearlyBaseline.yearlyAmount)
  };
}

function roundBankers(value, decimals = BANKERS_ROUNDING.decimals) {
  if (!Number.isFinite(value)) {
    return value;
  }

  const scale = 10 ** decimals;
  const scaled = value * scale;
  const floor = Math.floor(scaled);
  const fraction = scaled - floor;
  const distanceToHalf = Math.abs(fraction - 0.5);
  const epsilon = Number.EPSILON * 10;

  if (distanceToHalf <= epsilon) {
    const rounded = floor % 2 === 0 ? floor : floor + 1;
    return rounded / scale;
  }

  return Math.round(scaled) / scale;
}

function areEquivalentWithinTolerance(left, right, tolerance = CADENCE_EQUIVALENCE_TOLERANCE) {
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return false;
  }

  return Math.abs(left - right) <= tolerance;
}

module.exports = {
  BANKERS_ROUNDING,
  CADENCE_EQUIVALENCE_TOLERANCE,
  MONTHS_PER_YEAR,
  RECURRING_FREQUENCY_YEARLY_FACTORS,
  WEEKS_PER_YEAR,
  areEquivalentWithinTolerance,
  fromYearlyBaseline,
  normalizeFrequencyValue,
  normalizeRecurringAmount,
  resolveYearlyFactor,
  roundBankers,
  toYearlyBaseline
};
