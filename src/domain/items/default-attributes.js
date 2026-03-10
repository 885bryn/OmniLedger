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
  FinancialItem: Object.freeze({
    dueDate: "1970-01-01"
  })
});

module.exports = {
  defaultAttributesByType
};
