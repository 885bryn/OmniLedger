"use strict";

function isPlainObject(value) {
  return value !== null && typeof value === "object" && Array.isArray(value) === false;
}

function toFiniteNumber(value, fallback) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseAttributes(raw) {
  if (isPlainObject(raw)) {
    return raw;
  }

  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return isPlainObject(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  return {};
}

function normalizeFrequency(value) {
  if (typeof value !== "string") {
    return "monthly";
  }

  const normalized = value.trim().toLowerCase();
  if (["one_time", "weekly", "monthly", "yearly"].includes(normalized)) {
    return normalized;
  }

  if (normalized === "one-time" || normalized === "onetime") {
    return "one_time";
  }

  if (normalized === "annual" || normalized === "annually") {
    return "yearly";
  }

  return "monthly";
}

function normalizeStatus(value) {
  if (typeof value !== "string") {
    return "Active";
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "closed") {
    return "Closed";
  }

  return "Active";
}

module.exports = {
  async up(queryInterface) {
    const [rows] = await queryInterface.sequelize.query(
      `SELECT id, item_type, title, type, frequency, default_amount, status, linked_asset_item_id, parent_item_id, attributes
       FROM "Items"
       WHERE item_type IN ('FinancialCommitment', 'FinancialIncome')`
    );

    for (const row of rows) {
      const attributes = parseAttributes(row.attributes);
      const subtype = row.item_type === "FinancialIncome" ? "Income" : "Commitment";
      const frequency = normalizeFrequency(row.frequency || attributes.billingCycle || "monthly");
      const status = normalizeStatus(row.status || attributes.status || "Active");
      const title = row.title || attributes.name || (subtype === "Income" ? "Income" : "Commitment");
      const dueDate = attributes.dueDate || attributes.due_date || "1970-01-01";
      const defaultAmount = toFiniteNumber(
        row.default_amount,
        toFiniteNumber(attributes.nextPaymentAmount, toFiniteNumber(attributes.amount, 0))
      );
      const linkedAssetItemId = row.linked_asset_item_id || row.parent_item_id || attributes.linkedAssetItemId || attributes.parentItemId || null;

      const nextAttributes = {
        ...attributes,
        dueDate,
        name: attributes.name || title,
        financialSubtype: subtype,
        billingCycle: frequency,
        status
      };

      if (frequency !== "one_time" && nextAttributes.dynamicTrackingEnabled === undefined) {
        nextAttributes.dynamicTrackingEnabled = true;
      }

      if (subtype === "Commitment" && nextAttributes.trackingStartingRemainingBalance === undefined) {
        const startingRemaining = toFiniteNumber(nextAttributes.remainingBalance, toFiniteNumber(nextAttributes.originalPrincipal, null));
        if (startingRemaining !== null) {
          nextAttributes.trackingStartingRemainingBalance = startingRemaining;
        }
      }

      if (subtype === "Income" && nextAttributes.trackingStartingCollectedTotal === undefined) {
        nextAttributes.trackingStartingCollectedTotal = toFiniteNumber(nextAttributes.collectedTotal, 0);
      }

      await queryInterface.sequelize.query(
        `UPDATE "Items"
         SET item_type = 'FinancialItem',
             title = :title,
             type = :subtype,
             frequency = :frequency,
             default_amount = :defaultAmount,
             status = :status,
             linked_asset_item_id = :linkedAssetItemId,
             attributes = :attributes
         WHERE id = :id`,
        {
          replacements: {
            id: row.id,
            title,
            subtype,
            frequency,
            defaultAmount,
            status,
            linkedAssetItemId,
            attributes: JSON.stringify(nextAttributes)
          }
        }
      );
    }
  },

  async down() {
    // No down migration: legacy types intentionally removed.
  }
};
