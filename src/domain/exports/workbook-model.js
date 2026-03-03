"use strict";

const {
  ASSETS_COLUMNS,
  FINANCIAL_CONTRACT_COLUMNS,
  EVENT_HISTORY_COLUMNS
} = require("./workbook-columns");
const {
  EXPLICIT_MARKERS,
  flattenAttributes,
  formatAmount,
  formatEnumLabel,
  normalizeAttributes,
  resolveReadableReference,
  toExplicitMarker
} = require("./workbook-formatters");
const {
  sanitizeWorkbookTextCell,
  resolveExportDatePolicy,
  toExportDateCell
} = require("./workbook-safety");

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

function getScopedEvents(input) {
  const datasets = input && typeof input === "object" && input.datasets ? input.datasets : input;
  const rows = datasets && datasets.events ? datasets.events.rows : [];
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

function toComparableTimestamp(value) {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? Number.NEGATIVE_INFINITY : date.getTime();
}

function formatBooleanIndicator(value) {
  if (value === true) {
    return "Yes";
  }

  if (value === false) {
    return "No";
  }

  return EXPLICIT_MARKERS.notAvailable;
}

function resolveEventReferences(event, itemById) {
  const eventItem = event && event.item_id ? itemById.get(event.item_id) : null;

  if (!eventItem) {
    return {
      contractReference: { id: EXPLICIT_MARKERS.notAvailable, label: EXPLICIT_MARKERS.notAvailable },
      assetReference: { id: EXPLICIT_MARKERS.notAvailable, label: EXPLICIT_MARKERS.notAvailable }
    };
  }

  if (eventItem.item_type === FINANCIAL_ITEM_TYPE) {
    const contractReference = resolveReadableReference(eventItem.id, eventItem);
    const linkedAssetId = resolveLinkedAssetItemId(eventItem);
    const linkedAssetRow = linkedAssetId ? itemById.get(linkedAssetId) : null;
    const assetReference = resolveReadableReference(linkedAssetId, linkedAssetRow);

    return { contractReference, assetReference };
  }

  if (ASSET_ITEM_TYPES.has(eventItem.item_type)) {
    const assetReference = resolveReadableReference(eventItem.id, eventItem);

    const parentId = resolveParentItemId(eventItem);
    const parentRow = parentId ? itemById.get(parentId) : null;
    const contractReference = parentRow && parentRow.item_type === FINANCIAL_ITEM_TYPE
      ? resolveReadableReference(parentId, parentRow)
      : { id: EXPLICIT_MARKERS.notAvailable, label: EXPLICIT_MARKERS.notAvailable };

    return { contractReference, assetReference };
  }

  return {
    contractReference: { id: EXPLICIT_MARKERS.notAvailable, label: EXPLICIT_MARKERS.notAvailable },
    assetReference: { id: EXPLICIT_MARKERS.notAvailable, label: EXPLICIT_MARKERS.notAvailable }
  };
}

function compareEventsByNewestFirst(left, right) {
  const leftLifecycleTimestamp = Math.max(
    toComparableTimestamp(left.completed_at),
    toComparableTimestamp(left.due_date),
    toComparableTimestamp(left.updated_at),
    toComparableTimestamp(left.created_at)
  );
  const rightLifecycleTimestamp = Math.max(
    toComparableTimestamp(right.completed_at),
    toComparableTimestamp(right.due_date),
    toComparableTimestamp(right.updated_at),
    toComparableTimestamp(right.created_at)
  );

  const lifecycleDifference = rightLifecycleTimestamp - leftLifecycleTimestamp;
  if (lifecycleDifference !== 0) {
    return lifecycleDifference;
  }

  return compareStrings(left.id, right.id);
}

function buildEventRows({ events, itemById, datePolicy }) {
  return [...events]
    .sort(compareEventsByNewestFirst)
    .map((event) => {
      const references = resolveEventReferences(event, itemById);

      return projectColumns(EVENT_HISTORY_COLUMNS, {
        status: formatEnumLabel(event.status),
        event_type: formatEnumLabel(event.event_type),
        due_date: toExportDateCell(event.due_date, datePolicy),
        completed_at: toExportDateCell(event.completed_at, datePolicy),
        amount: formatAmount(event.amount),
        is_recurring: formatBooleanIndicator(event.is_recurring),
        is_exception: formatBooleanIndicator(event.is_exception),
        event_id: event.id,
        item_id: event.item_id,
        contract_id: references.contractReference.id,
        contract_title: references.contractReference.label,
        asset_id: references.assetReference.id,
        asset_title: references.assetReference.label,
        owner_user_id: event.owner_user_id,
        created_at: toExportDateCell(event.created_at, datePolicy),
        updated_at: toExportDateCell(event.updated_at, datePolicy)
      });
    });
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

    const withMarker = toExplicitMarker(value);
    row[column.key] = sanitizeWorkbookTextCell(withMarker);
    return row;
  }, {});
}

function buildAssetsRows({ assets, itemById, financialContracts, datePolicy }) {
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
      created_at: toExportDateCell(asset.created_at, datePolicy),
      updated_at: toExportDateCell(asset.updated_at, datePolicy),
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

function buildFinancialRows({ financialContracts, itemById, datePolicy }) {
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
      next_due_date: toExportDateCell(flattened.flattened.next_due_date, datePolicy),
      created_at: toExportDateCell(contract.created_at, datePolicy),
      updated_at: toExportDateCell(contract.updated_at, datePolicy),
      attributes_overflow: flattened.overflowText
    });
  });
}

function resolveInputDatePreferences(input) {
  if (!input || typeof input !== "object") {
    return {};
  }

  const asObject = input;
  if (asObject.export_preferences && typeof asObject.export_preferences === "object") {
    return asObject.export_preferences;
  }

  if (asObject.exportPreferences && typeof asObject.exportPreferences === "object") {
    return asObject.exportPreferences;
  }

  if (asObject.preferences && typeof asObject.preferences === "object") {
    return asObject.preferences;
  }

  return {};
}

function buildWorkbookModel(input) {
  const items = getScopedItems(input);
  const events = getScopedEvents(input);
  const itemById = new Map(items.map((item) => [item.id, item]));
  const datePolicy = resolveExportDatePolicy(resolveInputDatePreferences(input));

  const assets = items.filter((item) => ASSET_ITEM_TYPES.has(item.item_type));
  const financialContracts = items.filter((item) => item.item_type === FINANCIAL_ITEM_TYPE);

  const assetRows = buildAssetsRows({ assets, itemById, financialContracts, datePolicy });
  const financialRows = buildFinancialRows({ financialContracts, itemById, datePolicy });
  const eventRows = buildEventRows({ events, itemById, datePolicy });

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
      },
      "Event History": {
        columns: EVENT_HISTORY_COLUMNS,
        total_count: eventRows.length,
        rows: eventRows
      }
    }
  };
}

module.exports = {
  buildWorkbookModel
};
