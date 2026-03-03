"use strict";

function createFrozenColumns(columns) {
  const defs = columns.map((column, index) => Object.freeze({
    key: column.key,
    label: column.label,
    order: index + 1
  }));

  return Object.freeze(defs);
}

const ASSETS_COLUMNS = createFrozenColumns([
  { key: "asset_id", label: "Asset ID" },
  { key: "asset_type", label: "Asset Type" },
  { key: "asset_title", label: "Asset Title" },
  { key: "owner_user_id", label: "Owner User ID" },
  { key: "parent_item_id", label: "Parent Item ID" },
  { key: "parent_item_title", label: "Parent Item Title" },
  { key: "linked_contract_ids", label: "Linked Contract IDs" },
  { key: "linked_contract_titles", label: "Linked Contract Titles" },
  { key: "status", label: "Status" },
  { key: "created_at", label: "Created At" },
  { key: "updated_at", label: "Updated At" },
  { key: "address", label: "Address" },
  { key: "vin", label: "VIN" },
  { key: "make", label: "Make" },
  { key: "model", label: "Model" },
  { key: "year", label: "Year" },
  { key: "estimated_value", label: "Estimated Value" },
  { key: "attributes_overflow", label: "Attributes Overflow" }
]);

const FINANCIAL_CONTRACT_COLUMNS = createFrozenColumns([
  { key: "contract_id", label: "Contract ID" },
  { key: "contract_subtype", label: "Contract Subtype" },
  { key: "contract_title", label: "Contract Title" },
  { key: "owner_user_id", label: "Owner User ID" },
  { key: "linked_asset_item_id", label: "Linked Asset Item ID" },
  { key: "linked_asset_title", label: "Linked Asset Title" },
  { key: "parent_item_id", label: "Parent Item ID" },
  { key: "parent_item_title", label: "Parent Item Title" },
  { key: "status", label: "Status" },
  { key: "frequency", label: "Frequency" },
  { key: "default_amount", label: "Default Amount" },
  { key: "next_due_date", label: "Next Due Date" },
  { key: "created_at", label: "Created At" },
  { key: "updated_at", label: "Updated At" },
  { key: "attributes_overflow", label: "Attributes Overflow" }
]);

const EVENT_HISTORY_COLUMNS = createFrozenColumns([
  { key: "status", label: "Status" },
  { key: "event_type", label: "Event Type" },
  { key: "due_date", label: "Due Date" },
  { key: "completed_at", label: "Completed At" },
  { key: "amount", label: "Amount" },
  { key: "is_recurring", label: "Is Recurring" },
  { key: "is_exception", label: "Is Exception" },
  { key: "event_id", label: "Event ID" },
  { key: "item_id", label: "Item ID" },
  { key: "contract_id", label: "Contract ID" },
  { key: "contract_title", label: "Contract Title" },
  { key: "asset_id", label: "Asset ID" },
  { key: "asset_title", label: "Asset Title" },
  { key: "owner_user_id", label: "Owner User ID" },
  { key: "created_at", label: "Created At" },
  { key: "updated_at", label: "Updated At" }
]);

module.exports = {
  ASSETS_COLUMNS,
  FINANCIAL_CONTRACT_COLUMNS,
  EVENT_HISTORY_COLUMNS
};
