"use strict";

const minimumAttributeKeys = Object.freeze({
  RealEstate: ["address", "estimatedValue"],
  Vehicle: ["vin", "estimatedValue"],
  FinancialCommitment: ["amount", "dueDate"],
  Subscription: ["amount", "billingCycle"]
});

module.exports = {
  minimumAttributeKeys
};
