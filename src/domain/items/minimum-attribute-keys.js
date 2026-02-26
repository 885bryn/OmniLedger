"use strict";

const minimumAttributeKeys = Object.freeze({
  RealEstate: ["address", "estimatedValue"],
  Vehicle: ["vin", "estimatedValue"],
  FinancialCommitment: ["amount", "dueDate"],
  FinancialIncome: ["name", "amount", "dueDate"],
  FinancialItem: ["dueDate"]
});

module.exports = {
  minimumAttributeKeys
};
