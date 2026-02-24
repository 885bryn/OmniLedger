"use strict";

const defaultAttributesByType = Object.freeze({
  RealEstate: Object.freeze({
    address: "unknown",
    estimatedValue: 0
  }),
  Vehicle: Object.freeze({
    vin: "unknown",
    estimatedValue: 0
  }),
  FinancialCommitment: Object.freeze({
    amount: 0,
    dueDate: "1970-01-01"
  }),
  Subscription: Object.freeze({
    amount: 0,
    billingCycle: "monthly"
  })
});

module.exports = {
  defaultAttributesByType
};
