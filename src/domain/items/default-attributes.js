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
  FinancialIncome: Object.freeze({
    name: "Income",
    amount: 0,
    dueDate: "1970-01-01",
    collectedTotal: 0
  }),
  FinancialItem: Object.freeze({
    dueDate: "1970-01-01"
  })
});

module.exports = {
  defaultAttributesByType
};
