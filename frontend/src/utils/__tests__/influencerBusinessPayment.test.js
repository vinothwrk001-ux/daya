import { describe, expect, it } from "vitest";
import {
  calculateCommissionPreview,
  initialInfluencerBusinessForm,
  initialInfluencerPaymentForm,
  validateBusinessInformation,
  validateGst,
  validateIfsc,
  validatePan,
  validatePaymentInformation,
  validateUpi,
} from "../influencerBusinessPayment";

describe("influencer business and payment registration", () => {
  const validBusiness = {
    ...initialInfluencerBusinessForm,
    state: "Tamil Nadu",
    city: "Coimbatore",
    address1: "Layout Road",
    postalCode: "641001",
    panNumber: "ABCDE1234F",
    legalName: "Creator Demo",
    dateOfBirth: "1998-01-01",
    nationality: "Indian",
  };

  const validPayment = {
    ...initialInfluencerPaymentForm,
    accountHolderName: "Creator Demo",
    bankName: "HDFC Bank",
    accountNumber: "1234567890",
    confirmAccountNumber: "1234567890",
    ifscCode: "HDFC0001234",
    agreements: {
      payoutPolicy: true,
      commissionTerms: true,
      taxCompliance: true,
    },
  };

  it("validates India GST, PAN, IFSC, and UPI formats", () => {
    expect(validateGst("29ABCDE1234F1Z5")).toBe(true);
    expect(validatePan("ABCDE1234F")).toBe(true);
    expect(validateIfsc("HDFC0001234")).toBe(true);
    expect(validateUpi("creator@okaxis")).toBe(true);
  });

  it("accepts a complete business information payload", () => {
    expect(validateBusinessInformation(validBusiness)).toEqual({});
  });

  it("requires tax id for non-India creators", () => {
    const errors = validateBusinessInformation({ ...validBusiness, country: "US", taxId: "", panNumber: "" });
    expect(errors.taxId).toBeTruthy();
  });

  it("accepts valid bank transfer payment details", () => {
    expect(validatePaymentInformation(validPayment)).toEqual({});
  });

  it("requires payment agreements and matching account numbers", () => {
    const errors = validatePaymentInformation({ ...validPayment, confirmAccountNumber: "999", agreements: {} });
    expect(errors.confirmAccountNumber).toBeTruthy();
    expect(errors.payoutPolicy).toBeTruthy();
    expect(errors.commissionTerms).toBeTruthy();
    expect(errors.taxCompliance).toBeTruthy();
  });

  it("calculates commission preview", () => {
    expect(calculateCommissionPreview(1000, 10)).toBe(100);
  });
});
