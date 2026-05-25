import { describe, expect, it } from "vitest";
import {
  getPasswordStrength,
  initialInfluencerStepOneForm,
  sanitizeInfluencerStepOneDraft,
  validateInfluencerStepOne,
} from "../influencerRegistrationStep1";

describe("influencer registration step 1 validation", () => {
  const validForm = {
    ...initialInfluencerStepOneForm,
    firstName: "Asha",
    lastName: "Creator",
    email: "asha@example.com",
    mobile: "+91 9876543210",
    username: "asha_creator",
    password: "Creator@2026",
    confirmPassword: "Creator@2026",
    termsAccepted: true,
    privacyAccepted: true,
  };

  it("accepts a valid step one payload", () => {
    expect(validateInfluencerStepOne(validForm, { email: true, username: true })).toEqual({});
  });

  it("validates email, username, password, and password match", () => {
    const errors = validateInfluencerStepOne(
      {
        ...validForm,
        email: "bad-email",
        username: "bad username",
        password: "weak",
        confirmPassword: "different",
      },
      {}
    );

    expect(errors.email).toBeTruthy();
    expect(errors.username).toBeTruthy();
    expect(errors.password).toBeTruthy();
    expect(errors.confirmPassword).toBeTruthy();
  });

  it("marks strong passwords as excellent", () => {
    expect(getPasswordStrength("Creator@2026").label).toBe("Excellent");
  });

  it("does not persist passwords in local drafts", () => {
    const draft = sanitizeInfluencerStepOneDraft(validForm);
    expect(draft.password).toBe("");
    expect(draft.confirmPassword).toBe("");
  });
});
