const crypto = require("crypto");
const Razorpay = require("razorpay");
const mongoose = require("mongoose");
const { AppError } = require("../utils/AppError");
const payoutRepo = require("../repositories/payout.repository");
const vendorRepo = require("../repositories/vendor.repository");
const orderRepo = require("../repositories/order.repository");
const paymentRepo = require("../repositories/payment.repository");
const auditService = require("./audit.service");
const walletService = require("./wallet.service");
const payoutAccountService = require("./payoutAccount.service");
const ledgerService = require("./ledger.service");
const VendorWallet = require("../models/VendorWallet");
const { PayoutRequest } = require("../models/PayoutRequest");
const {
  applyPayoutPayment,
  applyPayoutRejection,
  applyPayoutRequest,
  assertPayoutRequestAllowed,
  assertPayoutRequestPayable,
  assertVerifiedPayoutAccount,
  buildWalletSnapshot,
  roundMoney,
} = require("./vendorFinance.rules");
const notificationService = require("./notification.service");

const PAYOUT_DELAY_DAYS = Number(process.env.PAYOUT_DELAY_DAYS || 7);
const MIN_PAYOUT_REQUEST_AMOUNT = Number(process.env.MIN_PAYOUT_REQUEST_AMOUNT || 500);

function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new AppError("Razorpay is not configured", 500, "RAZORPAY_NOT_CONFIGURED");
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function attachSession(query, session) {
  if (session) query.session(session);
  return query;
}

async function executeWithOptionalTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (error) {
    const message = String(error?.message || "");
    if (
      message.includes("Transaction numbers are only allowed") ||
      message.includes("replica set") ||
      message.includes("standalone")
    ) {
      return await work(null);
    }
    throw error;
  } finally {
    await session.endSession().catch(() => {});
  }
}

function normalizeRazorpayPayoutError(error, fallbackMessage) {
  if (error instanceof AppError) return error;

  const gatewayMessage =
    error?.error?.description ||
    error?.description ||
    error?.error?.message ||
    error?.message ||
    fallbackMessage;

  const gatewayCode =
    error?.error?.code ||
    error?.statusCode ||
    "RAZORPAY_PAYOUT_REQUEST_FAILED";

  const details = {
    source: "razorpay",
    code: gatewayCode,
  };

  if (error?.error?.reason) details.reason = error.error.reason;
  if (error?.error?.field) details.field = error.error.field;
  if (error?.error?.step) details.step = error.error.step;
  if (error?.error?.metadata) details.metadata = error.error.metadata;

  const statusCode =
    error?.statusCode && Number.isInteger(error.statusCode)
      ? error.statusCode
      : 502;

  return new AppError(gatewayMessage, statusCode, "RAZORPAY_PAYOUT_REQUEST_FAILED", details);
}

async function createLedgerEntryForRequest({
  vendorId,
  amount,
  walletSnapshot,
  source,
  referenceId,
  meta,
  session,
}) {
  return await ledgerService.createEntry({
    vendorId,
    type: source === "PAYOUT_REJECTION" ? "CREDIT" : "DEBIT",
    amount,
    source,
    referenceId,
    walletSnapshot,
    meta,
    session,
  });
}

class PayoutService {
  async createConnectedAccount(sellerId) {
    const vendor = await vendorRepo.findById(sellerId);
    if (!vendor) throw new AppError("Vendor not found", 404, "NOT_FOUND");

    if (vendor.razorpayFundAccountId) return vendor.razorpayFundAccountId;

    // Get payout account details from VendorPayoutAccount model
    const account = await payoutAccountService.getVendorAccountByVendorId(sellerId);
    const holderName = account?.accountHolderName || vendor.companyName || vendor.shopName;
    const accountNumber = account?.accountNumber;
    const ifsc = account?.ifscCode;
    const contactNumber = vendor.supportPhone || vendor.userId?.phone;
    const email = vendor.supportEmail || vendor.userId?.email;

    if (!accountNumber || !ifsc) {
      throw new AppError("Vendor payout banking details are incomplete. Please set up your payout account first.", 400, "INCOMPLETE_VENDOR_BANKING", {
        missing: {
          accountNumber: !accountNumber,
          ifsc: !ifsc,
          contactNumber: !contactNumber,
          email: !email,
        },
      });
    }

    const razorpay = getRazorpayClient();
    let contact;
    let fundAccount;

    try {
      contact = vendor.razorpayContactId
        ? { id: vendor.razorpayContactId }
        : await razorpay.contacts.create({
            name: holderName,
            email,
            contact: contactNumber,
            type: "vendor",
            reference_id: String(vendor._id),
          });

      fundAccount = await razorpay.fundAccount.create({
        contact_id: contact.id,
        account_type: "bank_account",
        bank_account: {
          name: holderName,
          ifsc,
          account_number: accountNumber,
        },
      });
    } catch (error) {
      throw normalizeRazorpayPayoutError(error, "Failed to create Razorpay payout contact or fund account");
    }

    await vendorRepo.updateById(sellerId, {
      razorpayContactId: contact.id,
      razorpayFundAccountId: fundAccount.id,
    });

    return fundAccount.id;
  }

  async markOrderDelivered(orderId) {
    const order = await orderRepo.findById(orderId);
    if (!order) throw new AppError("Order not found", 404, "NOT_FOUND");

    if (order.paymentMethod === "COD" && order.paymentStatus !== "Paid") {
      await orderRepo.updatePaymentStatus(orderId, "Paid");
      if (order.paymentRecordId) {
        await paymentRepo.updateById(order.paymentRecordId._id || order.paymentRecordId, {
          $set: {
            status: "PAID",
            paidAt: new Date(),
          },
        });
      }
    }

    const scheduledFor = addDays(order.deliveredAt || new Date(), PAYOUT_DELAY_DAYS);
    const payouts = await payoutRepo.findByOrderId(orderId);
    const updated = [];
    for (const payout of payouts) {
      updated.push(
        await payoutRepo.updateById(payout._id, {
          $set: {
            status: "PENDING",
            scheduledFor,
            notes: `Eligible for payout after ${PAYOUT_DELAY_DAYS} day settlement window.`,
          },
        })
      );
    }

    await orderRepo.updateById(orderId, { payoutEligibleAt: scheduledFor });
    return updated;
  }

  async queueEligiblePayouts() {
    const payouts = await payoutRepo.findEligibleForQueue(new Date());
    const queued = [];
    for (const payout of payouts) {
      queued.push(
        await payoutRepo.updateById(payout._id, {
          $set: {
            status: "QUEUED",
            queuedAt: new Date(),
            notes: "Queued for vendor transfer.",
          },
        })
      );
    }

    await walletService.releaseEligibleOrderEarnings({});
    return queued;
  }

  async processPayout(orderId) {
    const payouts = await payoutRepo.findByOrderId(orderId);
    if (!payouts.length) throw new AppError("Payout not found", 404, "NOT_FOUND");

    const payout = payouts[0];
    if (!["PENDING", "QUEUED"].includes(payout.status)) {
      throw new AppError("Payout is not ready to process", 400, "INVALID_OPERATION", {
        currentStatus: payout.status,
        scheduledFor: payout.scheduledFor,
        processedAt: payout.processedAt,
      });
    }

    if (!process.env.RAZORPAY_PAYOUT_SOURCE_ACCOUNT) {
      throw new AppError("Razorpay payout source account is missing", 500, "PAYOUT_SOURCE_ACCOUNT_MISSING");
    }

    const fundAccountId = await this.createConnectedAccount(payout.sellerId._id || payout.sellerId);
    const razorpay = getRazorpayClient();

    try {
      const transfer = await razorpay.payouts.create({
        account_number: process.env.RAZORPAY_PAYOUT_SOURCE_ACCOUNT,
        fund_account_id: fundAccountId,
        amount: Math.round(Number(payout.netAmount || payout.amount || 0) * 100),
        currency: "INR",
        mode: "IMPS",
        purpose: "payout",
        queue_if_low_balance: true,
        reference_id: String(payout.orderId?._id || payout.orderId),
        narration: `Vendor payout for ${payout.orderId?.orderNumber || payout._id}`,
      });

      return await payoutRepo.updateById(payout._id, {
        $set: {
          status: "PAID",
          transferId: transfer.id,
          processedAt: new Date(),
          notes: "Payout transferred successfully.",
        },
      });
    } catch (error) {
      const normalizedError = normalizeRazorpayPayoutError(error, "Failed to process Razorpay payout");
      await payoutRepo.updateById(payout._id, {
        $set: {
          status: "FAILED",
          failureReason: normalizedError.message,
          notes: "Payout processing failed.",
        },
      });
      throw normalizedError;
    }
  }

  async listVendorPayoutRequests(userId, query = {}) {
    const vendor = await walletService.getVendorContext(userId);
    await walletService.releaseEligibleOrderEarnings({ vendorId: vendor._id });

    const normalizedPage = Math.max(Number(query.page) || 1, 1);
    const normalizedLimit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const skip = (normalizedPage - 1) * normalizedLimit;
    const filter = { vendorId: vendor._id };
    if (query.status) filter.status = query.status;

    const [requests, total] = await Promise.all([
      PayoutRequest.find(filter)
        .populate("payoutAccountId")
        .sort({ requestedAt: -1 })
        .skip(skip)
        .limit(normalizedLimit)
        .lean(),
      PayoutRequest.countDocuments(filter),
    ]);

    return {
      requests,
      pagination: {
        total,
        page: normalizedPage,
        limit: normalizedLimit,
        pages: Math.ceil(total / normalizedLimit),
      },
    };
  }

  async listAdminPayoutRequests(query = {}) {
    await walletService.releaseEligibleOrderEarnings({});

    const normalizedPage = Math.max(Number(query.page) || 1, 1);
    const normalizedLimit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const skip = (normalizedPage - 1) * normalizedLimit;
    const filter = {};
    if (query.status) filter.status = query.status;
    if (query.vendorId) filter.vendorId = query.vendorId;

    const [requests, total] = await Promise.all([
      PayoutRequest.find(filter)
        .populate("vendorId", "companyName shopName supportEmail supportPhone")
        .populate("payoutAccountId")
        .sort({ requestedAt: -1 })
        .skip(skip)
        .limit(normalizedLimit)
        .lean(),
      PayoutRequest.countDocuments(filter),
    ]);

    return {
      requests,
      pagination: {
        total,
        page: normalizedPage,
        limit: normalizedLimit,
        pages: Math.ceil(total / normalizedLimit),
      },
    };
  }

  async getPayoutRequestById(requestId) {
    const request = await PayoutRequest.findById(requestId)
      .populate("vendorId", "companyName shopName supportEmail supportPhone")
      .populate("payoutAccountId");
    if (!request) throw new AppError("Payout request not found", 404, "NOT_FOUND");
    return request;
  }

  async requestVendorPayout(userId, payload = {}, actor, meta) {
    const vendor = await walletService.getVendorContext(userId);

    // ✅ SECURITY: Verify payout account exists and is verified
    const account = await payoutAccountService.getVendorAccountByVendorId(vendor._id, true);
    if (!account) {
      throw new AppError(
        "Payout account not found. Please set up your payout account first.",
        400,
        "PAYOUT_ACCOUNT_REQUIRED"
      );
    }
    if (!account.isVerified) {
      throw new AppError(
        "Payout account is not verified yet. Please wait for admin approval.",
        400,
        "ACCOUNT_NOT_VERIFIED"
      );
    }

    await walletService.releaseEligibleOrderEarnings({ vendorId: vendor._id });

    return await executeWithOptionalTransaction(async (session) => {
      const wallet = await walletService.getOrCreateWallet(vendor._id, { session });
      const pendingRequest = await attachSession(
        PayoutRequest.findOne({ vendorId: vendor._id, status: "PENDING" }),
        session
      ).exec();

      const amount = assertPayoutRequestAllowed({
        wallet,
        amount: payload.amount,
        minimumAmount: MIN_PAYOUT_REQUEST_AMOUNT,
        hasPendingRequest: Boolean(pendingRequest),
      });

      const nextWalletSnapshot = applyPayoutRequest(wallet, amount);
      const updatedWallet = await VendorWallet.findOneAndUpdate(
        { _id: wallet._id },
        { $set: nextWalletSnapshot },
        { returnDocument: "after", session: session || undefined, runValidators: true }
      );

      const [request] = await PayoutRequest.create(
        [
          {
            vendorId: vendor._id,
            amount,
            status: "PENDING",
            requestedAt: new Date(),
          },
        ],
        { session: session || undefined }
      );

      const ledgerEntry = await createLedgerEntryForRequest({
        vendorId: vendor._id,
        amount,
        walletSnapshot: nextWalletSnapshot,
        source: "PAYOUT_REQUEST",
        referenceId: request._id,
        meta: {
          requestedBy: actor?.sub || actor?._id,
        },
        session,
      });

      await auditService.log({
        actor,
        action: "vendor.payout.requested",
        entityType: "PayoutRequest",
        entityId: request._id,
        metadata: {
          vendorId: String(vendor._id),
          amount,
          ledgerEntryId: String(ledgerEntry._id),
          walletSnapshot: buildWalletSnapshot(updatedWallet),
        },
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });

      await notificationService.notifyOperations(
        {
          module: "FINANCE",
          subModule: "PAYOUTS",
          type: "PAYOUT_REQUEST",
          title: "New payout request",
          message: `A vendor requested a payout of INR ${amount}.`,
          referenceId: request._id,
          meta: {
            vendorId: vendor._id,
            amount,
          },
        },
        "payouts.read"
      );

      return { request, wallet: updatedWallet, ledgerEntry };
    });
  }

  async approvePayoutRequest(requestId, payload = {}, actor, meta) {
    const request = await PayoutRequest.findById(requestId);
    if (!request) throw new AppError("Payout request not found", 404, "NOT_FOUND");
    if (request.status !== "PENDING") {
      throw new AppError("Only pending payout requests can be approved", 400, "INVALID_PAYOUT_STATUS");
    }

    const account = await payoutAccountService.getVendorAccountByVendorId(request.vendorId);
    assertVerifiedPayoutAccount(account);

    request.status = "APPROVED";
    request.approvedAt = new Date();
    request.adminNote = payload.adminNote || request.adminNote || "";
    request.approvalActorId = actor?.sub || actor?._id;
    request.payoutAccountId = account._id;
    await request.save();

    await auditService.log({
      actor,
      action: "admin.payout.approved",
      entityType: "PayoutRequest",
      entityId: request._id,
      metadata: {
        vendorId: String(request.vendorId),
        payoutAccountId: String(account._id),
        amount: request.amount,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    await notificationService.notifyVendorUser(request.vendorId, {
      module: "FINANCE",
      subModule: "PAYOUTS",
      type: "PAYOUT_APPROVED",
      title: "Payout approved",
      message: `Your payout request for INR ${request.amount} was approved.`,
      referenceId: request._id,
    });

    return request;
  }

  async rejectPayoutRequest(requestId, payload = {}, actor, meta) {
    return await executeWithOptionalTransaction(async (session) => {
      const request = await attachSession(PayoutRequest.findById(requestId), session);
      if (!request) throw new AppError("Payout request not found", 404, "NOT_FOUND");
      if (!["PENDING", "APPROVED"].includes(request.status)) {
        throw new AppError("Only pending or approved payout requests can be rejected", 400, "INVALID_PAYOUT_STATUS");
      }

      const wallet = await walletService.getOrCreateWallet(request.vendorId, { session });
      const nextWalletSnapshot = applyPayoutRejection(wallet, request.amount);

      const updatedWallet = await VendorWallet.findOneAndUpdate(
        { _id: wallet._id },
        { $set: nextWalletSnapshot },
        { returnDocument: "after", session: session || undefined, runValidators: true }
      );

      request.status = "REJECTED";
      request.rejectedAt = new Date();
      request.adminNote = payload.adminNote;
      request.rejectionActorId = actor?.sub || actor?._id;
      await request.save({ session: session || undefined });

      const ledgerEntry = await createLedgerEntryForRequest({
        vendorId: request.vendorId,
        amount: request.amount,
        walletSnapshot: nextWalletSnapshot,
        source: "PAYOUT_REJECTION",
        referenceId: request._id,
        meta: {
          rejectedBy: actor?.sub || actor?._id,
          reason: payload.adminNote,
        },
        session,
      });

      await auditService.log({
        actor,
        action: "admin.payout.rejected",
        entityType: "PayoutRequest",
        entityId: request._id,
        metadata: {
          vendorId: String(request.vendorId),
          amount: request.amount,
          reason: payload.adminNote,
          ledgerEntryId: String(ledgerEntry._id),
          walletSnapshot: buildWalletSnapshot(updatedWallet),
        },
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });

      await notificationService.notifyVendorUser(request.vendorId, {
        module: "FINANCE",
        subModule: "PAYOUTS",
        type: "PAYOUT_REJECTED",
        title: "Payout rejected",
        message: `Your payout request for INR ${request.amount} was rejected.`,
        referenceId: request._id,
        meta: {
          reason: payload.adminNote || "",
        },
      });

      return { request, wallet: updatedWallet, ledgerEntry };
    });
  }

  async executeVendorPayout({ request, account, mode = "MANUAL", transactionId }) {
    if (mode === "MANUAL") {
      if (!transactionId) {
        throw new AppError("transactionId is required for manual payout marking", 400, "TRANSACTION_ID_REQUIRED");
      }
      return {
        transactionId,
        gatewayResponse: {
          mode: "MANUAL",
          transactionId,
        },
      };
    }

    if (mode !== "RAZORPAY") {
      throw new AppError("Unsupported payout mode", 400, "INVALID_PAYOUT_MODE");
    }

    if (!process.env.RAZORPAY_PAYOUT_SOURCE_ACCOUNT) {
      throw new AppError("Razorpay payout source account is missing", 500, "PAYOUT_SOURCE_ACCOUNT_MISSING");
    }

    let fundAccountId;
    if (account.accountNumber && account.ifscCode) {
      // VendorPayoutAccount already has all the details, just create the Razorpay fund account
      fundAccountId = await this.createConnectedAccount(request.vendorId);
    } else {
      throw new AppError("Razorpay payout currently requires verified bank account details", 400, "BANK_ACCOUNT_REQUIRED");
    }

    const razorpay = getRazorpayClient();
    try {
      const transfer = await razorpay.payouts.create({
        account_number: process.env.RAZORPAY_PAYOUT_SOURCE_ACCOUNT,
        fund_account_id: fundAccountId,
        amount: Math.round(roundMoney(request.amount) * 100),
        currency: "INR",
        mode: "IMPS",
        purpose: "payout",
        queue_if_low_balance: true,
        reference_id: String(request._id),
        narration: `Vendor withdrawal ${request._id}`,
      });

      return {
        transactionId: transfer.id,
        gatewayResponse: transfer,
      };
    } catch (error) {
      throw normalizeRazorpayPayoutError(error, "Failed to process Razorpay vendor payout");
    }
  }

  async payPayoutRequest(requestId, payload = {}, actor, meta) {
    const mode = String(payload.mode || "MANUAL").toUpperCase();
    const lockId = crypto.randomUUID();

    const request = await PayoutRequest.findOneAndUpdate(
      { _id: requestId, status: "APPROVED" },
      {
        $set: {
          status: "PROCESSING",
          processingLockId: lockId,
          processingStartedAt: new Date(),
          paymentMode: mode,
          adminNote: payload.adminNote || undefined,
        },
      },
      { returnDocument: "after" }
    );

    if (!request) {
      const existing = await PayoutRequest.findById(requestId);
      if (!existing) {
        throw new AppError("Payout request not found", 404, "NOT_FOUND");
      }
      if (existing.status === "APPROVED") {
        throw new AppError("Payout request is being locked by another process", 409, "PAYOUT_LOCK_CONFLICT");
      }
      assertPayoutRequestPayable(existing);
    }

    const account = await payoutAccountService.getVendorAccountByVendorId(request.vendorId);
    assertVerifiedPayoutAccount(account);

    let executionResult;
    try {
      executionResult = await this.executeVendorPayout({
        request,
        account,
        mode,
        transactionId: payload.transactionId,
      });
    } catch (error) {
      await PayoutRequest.updateOne(
        { _id: request._id, processingLockId: lockId },
        {
          $set: {
            adminNote: `${payload.adminNote ? `${payload.adminNote} | ` : ""}Payment execution failed: ${error.message}`,
          },
        }
      );
      throw error;
    }

    return await executeWithOptionalTransaction(async (session) => {
      const lockedRequest = await attachSession(
        PayoutRequest.findOne({ _id: request._id, processingLockId: lockId, status: "PROCESSING" }),
        session
      );
      if (!lockedRequest) {
        throw new AppError("Payout request lock expired or request already finalized", 409, "PAYOUT_LOCK_CONFLICT");
      }

      const wallet = await walletService.getOrCreateWallet(lockedRequest.vendorId, { session });
      const nextWalletSnapshot = applyPayoutPayment(wallet, lockedRequest.amount);
      const updatedWallet = await VendorWallet.findOneAndUpdate(
        { _id: wallet._id },
        { $set: nextWalletSnapshot },
        { returnDocument: "after", session: session || undefined, runValidators: true }
      );

      lockedRequest.status = "PAID";
      lockedRequest.paidAt = new Date();
      lockedRequest.processingCompletedAt = new Date();
      lockedRequest.transactionId = executionResult.transactionId;
      lockedRequest.paymentActorId = actor?.sub || actor?._id;
      lockedRequest.processingLockId = undefined;
      lockedRequest.payoutAccountId = account._id;
      lockedRequest.gatewayResponse = executionResult.gatewayResponse;
      if (payload.adminNote) {
        lockedRequest.adminNote = payload.adminNote;
      }
      await lockedRequest.save({ session: session || undefined });

      const ledgerEntry = await createLedgerEntryForRequest({
        vendorId: lockedRequest.vendorId,
        amount: lockedRequest.amount,
        walletSnapshot: nextWalletSnapshot,
        source: "PAYOUT",
        referenceId: lockedRequest._id,
        meta: {
          transactionId: executionResult.transactionId,
          mode,
        },
        session,
      });

      await auditService.log({
        actor,
        action: "admin.payout.paid",
        entityType: "PayoutRequest",
        entityId: lockedRequest._id,
        metadata: {
          vendorId: String(lockedRequest.vendorId),
          amount: lockedRequest.amount,
          mode,
          transactionId: executionResult.transactionId,
          ledgerEntryId: String(ledgerEntry._id),
          walletSnapshot: buildWalletSnapshot(updatedWallet),
        },
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });

      await notificationService.notifyVendorUser(lockedRequest.vendorId, {
        module: "FINANCE",
        subModule: "PAYOUTS",
        type: "PAYOUT_PAID",
        title: "Payout completed",
        message: `Your payout request for INR ${lockedRequest.amount} has been paid.`,
        referenceId: lockedRequest._id,
        meta: {
          transactionId: executionResult.transactionId,
          mode,
        },
      });

      return { request: lockedRequest, wallet: updatedWallet, ledgerEntry };
    });
  }
}

module.exports = new PayoutService();
