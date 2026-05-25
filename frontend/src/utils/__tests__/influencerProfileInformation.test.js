import { describe, expect, it } from "vitest";
import {
  initialInfluencerProfileForm,
  slugifyInfluencer,
  validateInfluencerProfile,
} from "../influencerProfileInformation";

describe("influencer profile information", () => {
  const valid = {
    ...initialInfluencerProfileForm,
    profilePicture: "/uploads/profile.png",
    coverBanner: "/uploads/banner.png",
    displayName: "Tech Guru Reviews",
    shortBio: "Helping shoppers discover the best technology products.",
    primaryCategory: "electronics",
    storeName: "Tech Guru Reviews",
    storeSlug: "tech-guru-reviews",
  };

  it("generates clean influencer slugs", () => {
    expect(slugifyInfluencer("Tech Guru Reviews!!")).toBe("tech-guru-reviews");
  });

  it("accepts a valid profile information payload", () => {
    expect(validateInfluencerProfile(valid)).toEqual({});
  });

  it("requires profile media, display name, short bio, category, and slug", () => {
    const errors = validateInfluencerProfile(initialInfluencerProfileForm);
    expect(errors.profilePicture).toBeTruthy();
    expect(errors.coverBanner).toBeTruthy();
    expect(errors.displayName).toBeTruthy();
    expect(errors.shortBio).toBeTruthy();
    expect(errors.primaryCategory).toBeTruthy();
    expect(errors.storeSlug).toBeTruthy();
  });

  it("requires custom category when primary category is other", () => {
    const errors = validateInfluencerProfile({ ...valid, primaryCategory: "other", customCategory: "" });
    expect(errors.customCategory).toBeTruthy();
  });
});
