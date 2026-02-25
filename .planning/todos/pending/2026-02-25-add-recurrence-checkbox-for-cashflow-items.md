---
created: 2026-02-25T08:52:14.937Z
title: Add recurrence checkbox for cashflow items
area: general
files:
  - frontend/src/pages/items/item-create-wizard-page.tsx:483
  - frontend/src/pages/items/item-create-wizard-page.tsx:544
  - src/domain/items/default-attributes.js:12
  - src/domain/items/minimum-attribute-keys.js:6
---

## Problem

When creating `FinancialCommitment` and `FinancialIncome` items, there is currently no explicit recurrence toggle. The user wants an optional checkbox at creation time so recurring behavior is intentional and visible in the workflow, instead of being implied by type or hidden defaults.

## Solution

Add an optional recurrence checkbox to the item create wizard for both `FinancialCommitment` and `FinancialIncome` sections, include the selected value in the create payload, and persist it as an attribute that downstream event-generation logic can read. Keep default behavior backward-compatible (unchecked/false when omitted), and verify item creation + event listing/completion flows still behave correctly for one-time vs recurring entries.
