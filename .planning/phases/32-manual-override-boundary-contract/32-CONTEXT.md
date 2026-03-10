# Phase 32: Manual Override Boundary Contract - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the event boundary contract so system-generated events never leak before the effective origin boundary or into absurd historical ranges, while explicit manual overrides remain allowed before origin. This phase includes the bad historical projection bug affecting Events page load (for example year `1068` through `1192`), the blocking/filtering rules for normal system-generated events, and the manual-override exception contract. It does not include the user-facing item-detail manual-entry UI, which belongs to the next phase.

</domain>

<decisions>
## Implementation Decisions

### Bad Date Guardrails
- System-generated events with absurd historical dates like `1068` should be dropped completely, not clamped or rendered.
- Historical-date sanity for system-generated events should rely on the item's effective origin boundary rather than a hardcoded absolute year floor.
- Invalid system-generated dates should be visible to admins through an inline privileged notice, while normal users should simply see a fast clean ledger.
- Once junk projected dates are blocked, the user experience should prioritize normal page speed and sane ledger output rather than surfacing cleanup messaging to everyone.

### Origin Boundary Rules
- System-generated events must never exist before the latest safe origin boundary.
- When origin inputs disagree, use the strictest/latest safe boundary to avoid early junk leakage.
- If date metadata is too weak to project safely, do not project system-generated events at all.
- Existing bogus projected rows should be filtered out immediately in the response path as part of this fix, not left for later cleanup.

### Manual Override Exceptions
- Pre-origin historical events may be created only through explicit override paths, and both users and admins may use that override capability.
- Manual overrides should visibly differ from normal history with a strong warning label.
- Manual overrides bypass the origin boundary only; they do not bypass broader sanity checks by default.
- Extremely old manual dates may still be allowed, but they should trigger a warning rather than being silently accepted.

### User-Facing Failure Handling
- Normal users should not see noisy warnings when bogus system-generated events are suppressed; the ledger should simply stay clean.
- Admins should receive an inline notice when invalid system-generated events were suppressed.
- If a manual override date looks extreme or suspicious, warn but allow rather than hard-blocking it.
- Boundary and override warnings should use plain corrective language rather than alarmist or compliance-heavy copy.

### Claude's Discretion
- Exact thresholding logic for what counts as an "extreme" manual date warning, as long as it remains distinct from the origin-boundary rule and does not silently permit malformed data.
- Exact placement and styling of the privileged admin inline notice, as long as it is visible to admins and hidden from normal users.
- Exact internal logging/diagnostic mechanism for dropped system-generated junk dates.

</decisions>

<specifics>
## Specific Ideas

- The `1068`-to-`1192` system-generated event range is a first-class bug for this phase because it is hurting `/events` load time and trust.
- This phase should fix the bad projection bug before adding the next manual-entry UI so the ledger is sane again.
- Manual override history should look intentionally exceptional, not silently identical to ordinary system history.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 32-manual-override-boundary-contract*
*Context gathered: 2026-03-10*
