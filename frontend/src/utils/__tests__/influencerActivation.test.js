import { describe, expect, it } from "vitest";

function activationCompletion(checklist = {}) {
  const checks = [
    checklist.bannerUploaded,
    checklist.profilePhotoUploaded,
    checklist.bioCompleted,
    checklist.firstCollectionCreated,
    checklist.firstAffiliateLinkGenerated,
    checklist.storefrontShared,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

describe("influencer activation experience", () => {
  it("calculates first time setup completion", () => {
    expect(activationCompletion({
      bannerUploaded: true,
      profilePhotoUploaded: true,
      bioCompleted: true,
      firstCollectionCreated: true,
      firstAffiliateLinkGenerated: false,
      storefrontShared: false,
    })).toBe(67);
  });
});
