"use strict";

const {
  ASSETS_COLUMNS,
  FINANCIAL_CONTRACT_COLUMNS
} = require("./workbook-columns");
const {
  EXPLICIT_MARKERS,
  flattenAttributes,
  formatAmount,
  formatDate,
  formatEnumLabel,
  normalizeAttributes,
  resolveReadableReference,
  toExplicitMarker
} = require("./workbook-formatters");

const ASSET_ITEM_TYPES = new Set(["RealEstate", "Vehicle"]);
const FINANCIAL_ITEM_TYPE = "FinancialItem";

const ASSET_ATTRIBUTE_BASELINE = Object.freeze({
  address: ["address"],
  vin: ["vin"],
  make: ["make"],
  model: ["model"],
  year: ["year"],
  estimated_value: ["estimatedValue", "estimated_value"]
});

const FINANCIAL_ATTRIBUTE_BASELINE = Object.freeze({
  financial_subtype: ["financialSubtype", "type"],
  next_due_date: ["dueDate", "due_date", "nextDueDate", "next_due_date"],
  amount: ["amount", "nextPaymentAmount"]
});

function normalizeString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getScopedItems(input) {
  const datasets = input && typeof input === "object" && input.datasets ? input.datasets : input;
  const rows = datasets && datasets.items ? datasets.items.rows : [];
  return Array.isArray(rows) ? rows : [];
}

function firstNonEmptyString(candidates) {
  for (let index = 0; index < candidates.length; index += 1) {
    const value = normalizeString(candidates[index]);
    if (value) {
      return value;
    }
  }

  return null;
}

function resolveParentItemId(item) {
  const attributes = normalizeAttributes(item.attributes);

  return firstNonEmptyString([
    item.parent_item_id,
    item.linked_asset_item_id,
    attributes.parentItemId,
    attributes.linkedAssetItemId
  ]);
}

function resolveLinkedAssetItemId(item) {
  const attributes = normalizeAttributes(item.attributes);

  return firstNonEmptyString([
    item.linked_asset_item_id,
    item.parent_item_id,
    attributes.linkedAssetItemId,
    attributes.parentItemId
  ]);
}

function toComparableDate(value) {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? Number.POSITIVE_INFINITY : date.getTime();
}

function compareStrings(left, right) {
  const leftValue = normalizeString(left) || "";
  const rightValue = normalizeString(right) || "";
  return leftValue.localeCompare(rightValue);
}

function sortAssets(items) {
  return [...items].sort((left, right) => {
    const typeDifference = compareStrings(left.item_type, right.item_type);
    if (typeDifference !== 0) {
      return typeDifference;
    }

    const leftTitle = left.title || normalizeAttributes(left.attributes).name;
    const rightTitle = right.title || normalizeAttributes(right.attributes).name;
    const titleDifference = compareStrings(leftTitle, rightTitle);
    if (titleDifference !== 0) {
      return titleDifference;
    }

    return compareStrings(left.id, right.id);
  });
}

function sortFinancialContracts(items) {
  return [...items].sort((left, right) => {
    const statusDifference = compareStrings(left.status, right.status);
    if (statusDifference !== 0) {
      return statusDifference;
    }

    const leftAttributes = normalizeAttributes(left.attributes);
    const rightAttributes = normalizeAttributes(right.attributes);

    const leftDue = leftAttributes.dueDate || leftAttributes.due_date || leftAttributes.nextDueDate || leftAttributes.next_due_date;
    const rightDue = rightAttributes.dueDate || rightAttributes.due_date || rightAttributes.nextDueDate || rightAttributes.next_due_date;
    const dueDifference = toComparableDate(leftDue) - toComparableDate(rightDue);
    if (dueDifference !== 0) {
      return dueDifference;
    }

    return compareStrings(left.id, right.id);
  });
}

function projectColumns(columns, payload) {
  return columns.reduce((row, column) => {
    const value = Object.prototype.hasOwnProperty.call(payload, column.key)
      ? payload[column.key]
      : EXPLICIT_MARKERS.notAvailable;

    row[column.key] = toExplicitMarker(value);
    return row;
  }, {});
}

function buildAssetsRows({ assets, itemById, financialContracts }) {
  return sortAssets(assets).map((asset) => {
    const attributes = normalizeAttributes(asset.attributes);
    const flattened = flattenAttributes(attributes, ASSET_ATTRIBUTE_BASELINE);
    const parentId = resolveParentItemId(asset);
    const parentRow = parentId ? itemById.get(parentId) : null;
    const parentReference = resolveReadableReference(parentId, parentRow);

    const linkedContracts = sortFinancialContracts(
      financialContracts.filter((contract) => resolveLinkedAssetItemId(contract) === asset.id)
    );

    const linkedContractIds = linkedContracts.length > 0
      ? linkedContracts.map((contract) => contract.id).join(", ")
      : EXPLICIT_MARKERS.notAvailable;
    const linkedContractTitles = linkedContracts.length > 0
      ? linkedContracts
        .map((contract) => toExplicitMarker(contract.title || normalizeAttributes(contract.attributes).name))
        .join(" | ")
      : EXPLICIT_MARKERS.notAvailable;

    return projectColumns(ASSETS_COLUMNS, {
      asset_id: asset.id,
      asset_type: formatEnumLabel(asset.item_type),
      asset_title: toExplicitMarker(asset.title || attributes.name),
      owner_user_id: asset.user_id,
      parent_item_id: parentReference.id,
      parent_item_title: parentReference.label,
      linked_contract_ids: linkedContractIds,
      linked_contract_titles: linkedContractTitles,
      status: formatEnumLabel(asset.status),
      created_at: formatDate(asset.created_at),
      updated_at: formatDate(asset.updated_at),
      address: toExplicitMarker(flattened.flattened.address),
      vin: toExplicitMarker(flattened.flattened.vin),
      make: toExplicitMarker(flattened.flattened.make),
      model: toExplicitMarker(flattened.flattened.model),
      year: toExplicitMarker(flattened.flattened.year),
      estimated_value: formatAmount(flattened.flattened.estimated_value),
      attributes_overflow: flattened.overflowText
    });
  });
}

function buildFinancialRows({ financialContracts, itemById }) {
  return sortFinancialContracts(financialContracts).map((contract) => {
    const attributes = normalizeAttributes(contract.attributes);
    const flattened = flattenAttributes(attributes, FINANCIAL_ATTRIBUTE_BASELINE);

    const linkedAssetId = resolveLinkedAssetItemId(contract);
    const linkedAssetReference = resolveReadableReference(linkedAssetId, linkedAssetId ? itemById.get(linkedAssetId) : null);

    const parentId = resolveParentItemId(contract);
    const parentReference = resolveReadableReference(parentId, parentId ? itemById.get(parentId) : null);

    return projectColumns(FINANCIAL_CONTRACT_COLUMNS, {
      contract_id: contract.id,
      contract_subtype: formatEnumLabel(contract.type || flattened.flattened.financial_subtype),
      contract_title: toExplicitMarker(contract.title || attributes.name),
      owner_user_id: contract.user_id,
      linked_asset_item_id: linkedAssetReference.id,
      linked_asset_title: linkedAssetReference.label,
      parent_item_id: parentReference.id,
      parent_item_title: parentReference.label,
      status: formatEnumLabel(contract.status),
      frequency: formatEnumLabel(contract.frequency),
      default_amount: formatAmount(contract.default_amount ?? flattened.flattened.amount),
      next_due_date: formatDate(flattened.flattened.next_due_date),
      created_at: formatDate(contract.created_at),
      updated_at: formatDate(contract.updated_at),
      attributes_overflow: flattened.overflowText
    });
  });
}

function buildWorkbookModel(input) {
  const items = getScopedItems(input);
  const itemById = new Map(items.map((item) => [item.id, item]));

  const assets = items.filter((item) => ASSET_ITEM_TYPES.has(item.item_type));
  const financialContracts = items.filter((item) => item.item_type === FINANCIAL_ITEM_TYPE);

  const assetRows = buildAssetsRows({ assets, itemById, financialContracts });
  const financialRows = buildFinancialRows({ financialContracts, itemById });

  return {
    sheets: {
      Assets: {
        columns: ASSETS_COLUMNS,
        total_count: assetRows.length,
        rows: assetRows
      },
      "Financial Contracts": {
        columns: FINANCIAL_CONTRACT_COLUMNS,
        total_count: financialRows.length,
        rows: financialRows
      }
    }
  };
}

module.exports = {
  buildWorkbookModel
};
