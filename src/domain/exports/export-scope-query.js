"use strict";

const { models } = require("../../db");
const { resolveOwnerFilter } = require("../../api/auth/scope-context");

const ITEM_FIELDS = Object.freeze([
  "id",
  "user_id",
  "item_type",
  "title",
  "type",
  "frequency",
  "default_amount",
  "status",
  "linked_asset_item_id",
  "attributes",
  "parent_item_id",
  "created_at",
  "updated_at"
]);

const EVENT_FIELDS = Object.freeze([
  "id",
  "item_id",
  "event_type",
  "due_date",
  "amount",
  "status",
  "is_recurring",
  "is_exception",
  "completed_at",
  "created_at",
  "updated_at"
]);

function toCanonicalItem(instance) {
  const raw = instance.get({ plain: true });
  const normalizedRaw = {
    ...raw,
    created_at: raw.created_at || raw.createdAt,
    updated_at: raw.updated_at || raw.updatedAt
  };

  return ITEM_FIELDS.reduce((output, key) => {
    output[key] = normalizedRaw[key];
    return output;
  }, {});
}

function toCanonicalEvent(instance) {
  const raw = instance.get({ plain: true });
  const normalizedRaw = {
    ...raw,
    due_date: raw.due_date || raw.dueDate,
    completed_at: raw.completed_at || raw.completedAt,
    created_at: raw.created_at || raw.createdAt,
    updated_at: raw.updated_at || raw.updatedAt,
    owner_user_id: raw.item && raw.item.user_id ? raw.item.user_id : null
  };

  const event = EVENT_FIELDS.reduce((output, key) => {
    output[key] = normalizedRaw[key];
    return output;
  }, {});

  event.owner_user_id = normalizedRaw.owner_user_id;
  return event;
}

async function exportScopeQuery(input) {
  const scope = input && typeof input === "object" ? input.scope : null;
  const ownerFilter = resolveOwnerFilter(scope);

  const itemWhere = ownerFilter ? { user_id: ownerFilter } : {};
  const eventItemFilter = ownerFilter ? { where: { user_id: ownerFilter } } : {};

  const [items, events] = await Promise.all([
    models.Item.findAll({
      where: itemWhere,
      order: [["created_at", "ASC"]]
    }),
    models.Event.findAll({
      include: [
        {
          model: models.Item,
          as: "item",
          attributes: ["user_id"],
          required: true,
          ...eventItemFilter
        }
      ],
      order: [["created_at", "ASC"]]
    })
  ]);

  const itemRows = items.map(toCanonicalItem);
  const eventRows = events.map(toCanonicalEvent);

  return {
    export: {
      format: "backup-xlsx",
      generated_at: new Date().toISOString(),
      scope: {
        actor_user_id: scope && scope.actorUserId ? scope.actorUserId : null,
        actor_role: scope && scope.actorRole ? scope.actorRole : "user",
        mode: scope && scope.mode ? scope.mode : "owner",
        lens_user_id: scope && scope.lensUserId ? scope.lensUserId : null,
        owner_filter: ownerFilter
      }
    },
    datasets: {
      items: {
        total_count: itemRows.length,
        rows: itemRows
      },
      events: {
        total_count: eventRows.length,
        rows: eventRows
      }
    }
  };
}

module.exports = {
  exportScopeQuery
};
