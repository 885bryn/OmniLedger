"use strict";

const {
  sanitizeWorkbookTextCell,
  resolveExportDatePolicy,
  toExportDateCell
} = require("../../../src/domain/exports/workbook-safety");

describe("workbook safety utilities", () => {
  describe("sanitizeWorkbookTextCell", () => {
    it("apostrophe-prefixes formula-triggering strings", () => {
      expect(sanitizeWorkbookTextCell("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
      expect(sanitizeWorkbookTextCell("+123")).toBe("'+123");
      expect(sanitizeWorkbookTextCell("-99")).toBe("'-99");
      expect(sanitizeWorkbookTextCell("@HYPERLINK('x')")).toBe("'@HYPERLINK('x')");
    });

    it("keeps safe strings and non-strings unchanged", () => {
      const originalDate = new Date("2026-05-01T00:00:00.000Z");
      expect(sanitizeWorkbookTextCell("Normal text")).toBe("Normal text");
      expect(sanitizeWorkbookTextCell(123)).toBe(123);
      expect(sanitizeWorkbookTextCell(originalDate)).toBe(originalDate);
      expect(sanitizeWorkbookTextCell(null)).toBeNull();
    });
  });

  describe("resolveExportDatePolicy", () => {
    it("uses provided locale/timezone when valid", () => {
      const policy = resolveExportDatePolicy({ locale: "fr-FR", timeZone: "Europe/Paris" });
      expect(policy).toMatchObject({
        locale: "fr-FR",
        timeZone: "Europe/Paris",
        invalidDateMarker: "INVALID_DATE",
        emptyDateMarker: "N/A"
      });
    });

    it("falls back deterministically when preferences are missing or invalid", () => {
      expect(resolveExportDatePolicy()).toMatchObject({ locale: "en-US", timeZone: "UTC" });
      expect(resolveExportDatePolicy({ timeZone: "Not/AZone" })).toMatchObject({ timeZone: "UTC" });
    });
  });

  describe("toExportDateCell", () => {
    it("returns explicit markers for missing and invalid values", () => {
      expect(toExportDateCell(null)).toBe("N/A");
      expect(toExportDateCell("bad-date")).toBe("INVALID_DATE");
    });

    it("normalizes valid dates using resolved timezone policy", () => {
      const utcDate = toExportDateCell("2026-06-01T01:00:00.000Z", { timeZone: "UTC" });
      const losAngelesDate = toExportDateCell("2026-06-01T01:00:00.000Z", { timeZone: "America/Los_Angeles" });

      expect(utcDate).toBeInstanceOf(Date);
      expect(losAngelesDate).toBeInstanceOf(Date);
      expect(utcDate.toISOString().slice(0, 10)).toBe("2026-06-01");
      expect(losAngelesDate.toISOString().slice(0, 10)).toBe("2026-05-31");
    });
  });
});
