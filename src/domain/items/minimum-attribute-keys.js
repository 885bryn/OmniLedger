"use strict";

const minimumAttributeKeys = Object.freeze({
  RealEstate: ["address", "estimatedValue"],
  Vehicle: ["vin", "estimatedValue"],
  FinancialItem: ["dueDate"]
});

module.exports = {
  minimumAttributeKeys
};
