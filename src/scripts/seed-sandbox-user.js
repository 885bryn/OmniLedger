"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { Op } = require("sequelize");
const { sequelize, models } = require("../db");
const { registerUser, RegisterUserError } = require("../domain/auth/register-user");
const { createItem } = require("../domain/items/create-item");
const { updateItem } = require("../domain/items/update-item");
const { softDeleteItem } = require("../domain/items/soft-delete-item");
const { restoreItem } = require("../domain/items/restore-item");
const { listEvents } = require("../domain/events/list-events");
const { completeEvent, undoEventCompletion } = require("../domain/events/complete-event");
const { updateEvent } = require("../domain/events/update-event");

const SEED_TAG = "sandbox-seed-v1";

function loadDotEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function withSeedMeta(attributes) {
  return {
    ...attributes,
    _sandbox_seed: SEED_TAG
  };
}

async function getOrCreateUser(email) {
  const existing = await models.User.findOne({ where: { email_normalized: email } });
  if (existing) {
    return { user: existing, created: false, tempPassword: null };
  }

  const tempPassword = "Sandbox!234";

  try {
    await registerUser({ email, password: tempPassword });
  } catch (error) {
    if (!(error instanceof RegisterUserError)) {
      throw error;
    }

    if (error.code !== "email_in_use") {
      throw error;
    }
  }

  const created = await models.User.findOne({ where: { email_normalized: email } });
  if (!created) {
    throw new Error("Unable to resolve user after create.");
  }

  return { user: created, created: true, tempPassword };
}

async function cleanupPriorSeed(userId) {
  const userItems = await models.Item.findAll({ where: { user_id: userId } });
  const seededItems = userItems.filter((item) => item.attributes && item.attributes._sandbox_seed === SEED_TAG);

  if (seededItems.length === 0) {
    return { removedItems: 0, removedEvents: 0, removedAuditRows: 0 };
  }

  const itemIds = seededItems.map((item) => item.id);
  const seededEvents = await models.Event.findAll({
    where: {
      item_id: {
        [Op.in]: itemIds
      }
    }
  });
  const eventIds = seededEvents.map((event) => event.id);

  const itemEntityKeys = itemIds.map((id) => `item:${id}`);
  const eventEntityKeys = eventIds.map((id) => `event:${id}`);
  const entityKeys = [...itemEntityKeys, ...eventEntityKeys];

  let removedAuditRows = 0;
  if (entityKeys.length > 0) {
    removedAuditRows = await models.AuditLog.destroy({
      where: {
        entity: {
          [Op.in]: entityKeys
        }
      }
    });
  }

  const removedEvents = await models.Event.destroy({
    where: {
      item_id: {
        [Op.in]: itemIds
      }
    }
  });

  await models.Item.update(
    {
      parent_item_id: null
    },
    {
      where: {
        parent_item_id: {
          [Op.in]: itemIds
        }
      }
    }
  );

  await models.Item.update(
    {
      linked_asset_item_id: null
    },
    {
      where: {
        linked_asset_item_id: {
          [Op.in]: itemIds
        }
      }
    }
  );

  const removedItems = await models.Item.destroy({
    where: {
      id: {
        [Op.in]: itemIds
      }
    }
  });

  return { removedItems, removedEvents, removedAuditRows };
}

function flattenEventGroups(eventGroups) {
  const rows = [];
  for (const group of eventGroups || []) {
    for (const event of group.events || []) {
      rows.push(event);
    }
  }
  return rows;
}

async function seedForUser(user) {
  const scope = { actorUserId: user.id, mode: "owner" };
  const now = new Date();

  const homeDue = toIsoDate(addDays(now, 5));
  const rentalDue = toIsoDate(addDays(now, 9));
  const carDue = toIsoDate(addDays(now, 3));
  const truckDue = toIsoDate(addDays(now, 14));

  const primaryHome = await createItem({
    scope,
    item_type: "RealEstate",
    attributes: withSeedMeta({
      name: "Primary Home",
      address: "123 Evergreen Terrace",
      estimatedValue: 640000,
      dueDate: homeDue
    })
  });

  const rentalCondo = await createItem({
    scope,
    item_type: "RealEstate",
    attributes: withSeedMeta({
      name: "Downtown Rental Condo",
      address: "88 Market Street Unit 1406",
      estimatedValue: 415000,
      dueDate: rentalDue
    })
  });

  const familySUV = await createItem({
    scope,
    item_type: "Vehicle",
    attributes: withSeedMeta({
      name: "Family SUV",
      vin: "1HGBH41JXMN109186",
      year: 2021,
      make: "Toyota",
      model: "Highlander",
      estimatedValue: 34500,
      dueDate: carDue
    })
  });

  const pickupTruck = await createItem({
    scope,
    item_type: "Vehicle",
    attributes: withSeedMeta({
      name: "Work Pickup",
      vin: "1FTFW1E8XMKE47219",
      year: 2019,
      make: "Ford",
      model: "F-150",
      estimatedValue: 27600,
      dueDate: truckDue
    })
  });

  const legacyLoan = await createItem({
    scope,
    item_type: "FinancialItem",
    title: "Legacy Auto Loan",
    type: "Commitment",
    frequency: "monthly",
    status: "Active",
    default_amount: 525.4,
    linked_asset_item_id: familySUV.id,
    attributes: withSeedMeta({
      dueDate: toIsoDate(addDays(now, 8)),
      name: "Legacy Auto Loan",
      amount: 525.4,
      nextPaymentAmount: 525.4,
      remainingBalance: 11800,
      originalPrincipal: 24000,
      parentItemId: familySUV.id,
      linkedAssetItemId: familySUV.id,
      financialSubtype: "Commitment"
    })
  });

  const legacyIncome = await createItem({
    scope,
    item_type: "FinancialItem",
    title: "Legacy Consulting Income",
    type: "Income",
    frequency: "monthly",
    status: "Active",
    default_amount: 1850,
    confirm_unlinked_asset: true,
    attributes: withSeedMeta({
      dueDate: toIsoDate(addDays(now, 11)),
      name: "Legacy Consulting Income",
      amount: 1850,
      collectedTotal: 12750,
      financialSubtype: "Income"
    })
  });

  const mortgage = await createItem({
    scope,
    item_type: "FinancialItem",
    title: "Primary Mortgage",
    type: "Commitment",
    frequency: "monthly",
    status: "Active",
    default_amount: 2485,
    linked_asset_item_id: primaryHome.id,
    attributes: withSeedMeta({
      dueDate: toIsoDate(addDays(now, -18)),
      amount: 2485,
      nextPaymentAmount: 2485,
      remainingBalance: 423800,
      originalPrincipal: 510000,
      financialSubtype: "Commitment"
    })
  });

  const hoa = await createItem({
    scope,
    item_type: "FinancialItem",
    title: "HOA Dues",
    type: "Commitment",
    frequency: "monthly",
    status: "Active",
    default_amount: 315,
    linked_asset_item_id: primaryHome.id,
    attributes: withSeedMeta({
      dueDate: toIsoDate(addDays(now, -4)),
      amount: 315,
      nextPaymentAmount: 315,
      financialSubtype: "Commitment"
    })
  });

  const propertyTax = await createItem({
    scope,
    item_type: "FinancialItem",
    title: "Property Tax",
    type: "Commitment",
    frequency: "yearly",
    status: "Active",
    default_amount: 4200,
    linked_asset_item_id: primaryHome.id,
    attributes: withSeedMeta({
      dueDate: toIsoDate(addDays(now, -120)),
      amount: 4200,
      nextPaymentAmount: 4200,
      financialSubtype: "Commitment"
    })
  });

  const insurance = await createItem({
    scope,
    item_type: "FinancialItem",
    title: "Auto Insurance",
    type: "Commitment",
    frequency: "monthly",
    status: "Active",
    default_amount: 182,
    linked_asset_item_id: familySUV.id,
    attributes: withSeedMeta({
      dueDate: toIsoDate(addDays(now, -7)),
      amount: 182,
      nextPaymentAmount: 182,
      financialSubtype: "Commitment"
    })
  });

  const salary = await createItem({
    scope,
    item_type: "FinancialItem",
    title: "Monthly Salary",
    type: "Income",
    frequency: "monthly",
    status: "Active",
    default_amount: 9200,
    confirm_unlinked_asset: true,
    attributes: withSeedMeta({
      dueDate: toIsoDate(addDays(now, -2)),
      amount: 9200,
      financialSubtype: "Income"
    })
  });

  const rentalIncome = await createItem({
    scope,
    item_type: "FinancialItem",
    title: "Rental Income",
    type: "Income",
    frequency: "monthly",
    status: "Active",
    default_amount: 2650,
    linked_asset_item_id: rentalCondo.id,
    attributes: withSeedMeta({
      dueDate: toIsoDate(addDays(now, -10)),
      amount: 2650,
      financialSubtype: "Income"
    })
  });

  const applianceRepair = await createItem({
    scope,
    item_type: "FinancialItem",
    title: "Appliance Repair",
    type: "Commitment",
    frequency: "one_time",
    status: "Active",
    default_amount: 640,
    linked_asset_item_id: primaryHome.id,
    attributes: withSeedMeta({
      dueDate: toIsoDate(addDays(now, 6)),
      amount: 640,
      financialSubtype: "Commitment"
    })
  });

  await createItem({
    scope,
    item_type: "FinancialItem",
    title: "Archived Streaming Bundle",
    type: "Commitment",
    frequency: "monthly",
    status: "Closed",
    default_amount: 59,
    confirm_unlinked_asset: true,
    attributes: withSeedMeta({
      dueDate: toIsoDate(addDays(now, -95)),
      amount: 59,
      financialSubtype: "Commitment"
    })
  });

  const archivedTruckFee = await createItem({
    scope,
    item_type: "FinancialItem",
    title: "Truck Storage Fee",
    type: "Commitment",
    frequency: "monthly",
    status: "Active",
    default_amount: 110,
    linked_asset_item_id: pickupTruck.id,
    attributes: withSeedMeta({
      dueDate: toIsoDate(addDays(now, -21)),
      amount: 110,
      financialSubtype: "Commitment"
    })
  });

  await updateItem({
    itemId: familySUV.id,
    scope,
    attributes: {
      mileage: 48221,
      maintenanceStatus: "Scheduled service in 2 weeks",
      _sandbox_seed: SEED_TAG
    }
  });

  await updateItem({
    itemId: legacyLoan.id,
    scope,
    attributes: {
      nextPaymentAmount: 536.75,
      note: "Includes annual fee adjustment",
      _sandbox_seed: SEED_TAG
    }
  });

  const initialEvents = await listEvents({ scope, status: "all", now });
  const eventRows = flattenEventGroups(initialEvents.groups);

  const repairEvent = eventRows.find((event) => event.item_id === applianceRepair.id && event.source_state === "persisted");
  if (repairEvent) {
    await completeEvent({ eventId: repairEvent.id, scope, now: addDays(now, -1) });
  }

  const insuranceEvent = eventRows.find((event) => event.item_id === insurance.id && event.source_state === "persisted");
  if (insuranceEvent) {
    await completeEvent({ eventId: insuranceEvent.id, scope, now: addDays(now, -2) });
    await undoEventCompletion({ eventId: insuranceEvent.id, scope, now: addDays(now, -1) });
  }

  const projectedMortgage = eventRows.find((event) => event.item_id === mortgage.id && event.source_state === "projected");
  if (projectedMortgage) {
    await updateEvent({
      eventId: projectedMortgage.id,
      scope,
      payload: {
        due_date: toIsoDate(addDays(new Date(projectedMortgage.due_date), 2)),
        amount: Number(projectedMortgage.amount) + 45
      }
    });
  }

  const projectedSalary = eventRows.find((event) => event.item_id === salary.id && event.source_state === "projected");
  if (projectedSalary) {
    await updateEvent({
      eventId: projectedSalary.id,
      scope,
      payload: {
        amount: Number(projectedSalary.amount) + 120
      }
    });
  }

  await softDeleteItem({
    itemId: rentalCondo.id,
    cascadeDeleteIds: [rentalIncome.id],
    scope,
    now: addDays(now, -1)
  });

  await restoreItem({
    itemId: rentalCondo.id,
    scope,
    now
  });

  await softDeleteItem({
    itemId: pickupTruck.id,
    cascadeDeleteIds: [archivedTruckFee.id],
    scope,
    now
  });

  const finalItems = await models.Item.findAll({ where: { user_id: user.id } });
  const seededItems = finalItems.filter((item) => item.attributes && item.attributes._sandbox_seed === SEED_TAG);
  const finalEvents = await listEvents({ scope, status: "all", now: new Date() });
  const finalEventRows = flattenEventGroups(finalEvents.groups);

  const persistedCount = finalEventRows.filter((event) => event.source_state === "persisted").length;
  const projectedCount = finalEventRows.filter((event) => event.source_state === "projected").length;
  const exceptionCount = finalEventRows.filter((event) => event.is_exception === true).length;
  const deletedCount = seededItems.filter((item) => item.attributes && item.attributes._deleted_at).length;

  return {
    userId: user.id,
    seededItemCount: seededItems.length,
    visibleEventCount: finalEventRows.length,
    persistedCount,
    projectedCount,
    exceptionCount,
    deletedCount,
    anchors: {
      primaryHomeId: primaryHome.id,
      mortgageId: mortgage.id,
      applianceRepairId: applianceRepair.id,
      legacyIncomeId: legacyIncome.id
    }
  };
}

async function run() {
  loadDotEnvFile();

  const emailArg = process.argv[2] || "bryanli2015@gmail.com";
  const email = normalizeEmail(emailArg);
  if (!email) {
    throw new Error("Provide a valid email argument.");
  }

  try {
    await sequelize.authenticate();

    const { user, created, tempPassword } = await getOrCreateUser(email);
    const cleanup = await cleanupPriorSeed(user.id);
    const seeded = await seedForUser(user);

    console.log("Sandbox data seed complete.");
    console.log(`User: ${email} (${seeded.userId})`);
    console.log(`User created: ${created ? "yes" : "no"}`);
    if (created && tempPassword) {
      console.log(`Temporary password: ${tempPassword}`);
    }
    console.log(`Cleanup removed: ${cleanup.removedItems} items, ${cleanup.removedEvents} events, ${cleanup.removedAuditRows} audit rows`);
    console.log(`Seeded items: ${seeded.seededItemCount}`);
    console.log(`Visible events: ${seeded.visibleEventCount} (${seeded.persistedCount} persisted, ${seeded.projectedCount} projected, ${seeded.exceptionCount} exceptions)`);
    console.log(`Seed-tag deleted items: ${seeded.deletedCount}`);
    console.log(`Anchors: home=${seeded.anchors.primaryHomeId}, mortgage=${seeded.anchors.mortgageId}, one-time=${seeded.anchors.applianceRepairId}`);
  } finally {
    await sequelize.close();
  }
}

run().catch((error) => {
  console.error("Sandbox seed failed:", error.message);
  process.exitCode = 1;
});
