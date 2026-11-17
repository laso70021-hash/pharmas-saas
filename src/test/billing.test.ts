import { describe, expect, it } from "vitest";
import { daysLeft, effectiveStatus, resolveBillingChoice, TRIAL_DAYS, yearlyPrice } from "@/lib/billing";

const starter = { slug: "starter", price_tzs_monthly: 15000, price_tzs_annual: 165000 };
const growth = { slug: "growth", price_tzs_monthly: 29000, price_tzs_annual: 290000 };
const now = new Date("2026-11-10T08:00:00Z");

describe("billing rules", () => {
  it("charges the exact yearly price set for the plan", () => {
    expect(yearlyPrice(starter)).toBe(165000);
    expect(yearlyPrice(growth)).toBe(290000);
  });

  it("gives the free trial on every plan", () => {
    expect(resolveBillingChoice("starter", "trial")).toBe("trial");
    expect(resolveBillingChoice("growth", "trial")).toBe("trial");
  });

  it("uses a one-month (30 day) trial", () => {
    expect(TRIAL_DAYS).toBe(30);
  });

  it("expires a trial once its end date passes", () => {
    expect(effectiveStatus({ status: "trial", trial_ends_at: "2026-11-11T00:00:00Z" }, now)).toBe("trial");
    expect(effectiveStatus({ status: "trial", trial_ends_at: "2026-11-09T00:00:00Z" }, now)).toBe("expired");
  });

  it("expires a paid account when the year runs out", () => {
    expect(effectiveStatus({ status: "active", subscription_ends_at: "2026-11-01T00:00:00Z" }, now)).toBe("expired");
    expect(effectiveStatus({ status: "active", subscription_ends_at: "2027-11-01T00:00:00Z" }, now)).toBe("active");
  });

  it("counts remaining days rounded up", () => {
    expect(daysLeft("2026-11-12T07:00:00Z", now)).toBe(2);
  });
});
