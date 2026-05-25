import { describe, expect, it } from "vitest";
import {
  calculateCreatorScore,
  canContinueSocialVerification,
  createSocialAccount,
  generateOwnershipCode,
  validateSocialVerification,
} from "../influencerSocialVerification";

describe("influencer social verification", () => {
  it("validates duplicate profile urls and invalid urls", () => {
    const first = { ...createSocialAccount("instagram"), profileUrl: "not-a-url", verificationCode: "INFLUENCER-GRM-1111" };
    const second = { ...createSocialAccount("youtube"), profileUrl: "not-a-url", verificationCode: "INFLUENCER-GRM-2222" };
    const errors = validateSocialVerification({ accounts: [first, second] });
    expect(errors[first.clientId].profileUrl).toBeTruthy();
    expect(errors[second.clientId].profileUrl).toBeTruthy();
  });

  it("requires ownership verification for continue validation", () => {
    const account = { ...createSocialAccount("instagram"), profileUrl: "https://instagram.com/grm" };
    const errors = validateSocialVerification({ accounts: [account] });
    expect(errors[account.clientId].verification).toBeTruthy();
  });

  it("allows draft validation without ownership verification", () => {
    const account = { ...createSocialAccount("instagram"), profileUrl: "https://instagram.com/grm" };
    expect(validateSocialVerification({ accounts: [account] }, { requireVerification: false })).toEqual({});
  });

  it("generates ownership codes in the required format", () => {
    expect(generateOwnershipCode()).toMatch(/^INFLUENCER-GRM-\d{4}$/);
  });

  it("calculates creator score and continue eligibility", () => {
    const accounts = [
      { ...createSocialAccount("instagram"), profileUrl: "https://instagram.com/grm", followersCount: 12000, engagementRate: 4, contentCount: 80, verificationStatus: "under_review" },
    ];
    expect(calculateCreatorScore(accounts).score).toBeGreaterThan(0);
    expect(canContinueSocialVerification(accounts)).toBe(true);
  });
});
