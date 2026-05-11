const mongoose = require("mongoose");
const { Ledger } = require("../models/Ledger");
const { buildWalletSnapshot, roundMoney } = require("./vendorFinance.rules");

class LedgerService {
  async createEntry({
    vendorId,
    type,
    amount,
    source,
    referenceId,
    walletSnapshot,
    meta = {},
    codFee = 0,
    gatewayFee = 0,
    refundRef = "",
    settlementRef = "",
    session = null,
  }) {
    const payload = {
      vendorId,
      type,
      amount: roundMoney(amount),
      source,
      referenceId,
      balanceAfter: roundMoney(walletSnapshot.availableBalance),
      walletSnapshot: buildWalletSnapshot(walletSnapshot),
      meta,
      codFee: roundMoney(codFee),
      gatewayFee: roundMoney(gatewayFee),
      refundRef: String(refundRef || ""),
      settlementRef: String(settlementRef || ""),
    };

    const [entry] = await Ledger.create([payload], { session: session || undefined });
    return entry;
  }

  async listForVendor(vendorId, { page = 1, limit = 20, source, type, startDate, endDate } = {}) {
    const query = { vendorId };
    if (source) query.source = source;
    if (type) query.type = type;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        const parsedStartDate = new Date(startDate);
        if (!Number.isNaN(parsedStartDate.getTime())) {
          query.createdAt.$gte = parsedStartDate;
        }
      }
      if (endDate) {
        const parsedEndDate = new Date(endDate);
        if (!Number.isNaN(parsedEndDate.getTime())) {
          parsedEndDate.setHours(23, 59, 59, 999);
          query.createdAt.$lte = parsedEndDate;
        }
      }
      if (!Object.keys(query.createdAt).length) {
        delete query.createdAt;
      }
    }

    const normalizedPage = Math.max(Number(page) || 1, 1);
    const normalizedLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const skip = (normalizedPage - 1) * normalizedLimit;

    const [entries, total] = await Promise.all([
      Ledger.find(query).sort({ createdAt: -1 }).skip(skip).limit(normalizedLimit).lean(),
      Ledger.countDocuments(query),
    ]);

    return {
      entries,
      pagination: {
        total,
        page: normalizedPage,
        limit: normalizedLimit,
        pages: Math.ceil(total / normalizedLimit),
      },
    };
  }

  async listForVendorAdmin(vendorId, query = {}) {
    return await this.listForVendor(vendorId, query);
  }

  async findById(id) {
    if (!mongoose.isValidObjectId(id)) return null;
    return await Ledger.findById(id).lean();
  }
}

module.exports = new LedgerService();
