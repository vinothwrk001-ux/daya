import { describe, expect, it } from "vitest";
import {
  getScoreLevel,
  initialInfluencerContentReviewForm,
  validateContentReview,
} from "../influencerContentReview";

describe("influencer content review", () => {
  it("requires at least 3 samples and one identity document", () => {
    const errors = validateContentReview(initialInfluencerContentReviewForm, {
      sampleContentFiles: [{ name: "one.png" }],
      identityDocumentFiles: [],
    });
    expect(errors.sampleContent).toBeTruthy();
    expect(errors.identityDocuments).toBeTruthy();
  });

  it("accepts complete content review uploads", () => {
    const errors = validateContentReview(initialInfluencerContentReviewForm, {
      sampleContentFiles: [{ name: "one.png" }, { name: "two.mp4" }, { name: "three.pdf" }],
      identityDocumentFiles: [{ name: "id.pdf" }],
    });
    expect(errors).toEqual({});
  });

  it("validates portfolio URLs", () => {
    const errors = validateContentReview({ ...initialInfluencerContentReviewForm, portfolioUrl: "bad-url" }, {
      sampleContentFiles: [{}, {}, {}],
      identityDocumentFiles: [{}],
    });
    expect(errors.portfolioUrl).toBeTruthy();
  });

  it("maps creator score levels", () => {
    expect(getScoreLevel(84)).toBe("Gold Creator");
    expect(getScoreLevel(45)).toBe("Rising Creator");
  });
});
