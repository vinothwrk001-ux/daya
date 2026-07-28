const ServiceRequest = require("../models/ServiceRequest");
const { logger } = require("../utils/logger");

/**
 * @desc    Create a new service request
 * @route   POST /api/service-requests
 * @access  Public
 */
const createServiceRequest = async (req, res, next) => {
  try {
    const { name, email, phone, projectDetails } = req.body;

    if (!name || !email || !phone || !projectDetails) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    if (name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Name must be at least 2 characters long",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    const phoneRegex = /^\d{10}$/;
    const digitsOnly = phone.trim().replace(/\D/g, "");
    if (!phoneRegex.test(digitsOnly)) {
      return res.status(400).json({
        success: false,
        message: "Please provide exactly a 10 digit phone number",
      });
    }

    if (projectDetails.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: "Project details must be at least 10 characters long",
      });
    }

    const serviceRequest = await ServiceRequest.create({
      name,
      email,
      phone,
      projectDetails,
    });

    res.status(201).json({
      success: true,
      message: "Service request submitted successfully",
      data: serviceRequest,
    });
  } catch (error) {
    logger.error("Error creating service request", { error: error.message, stack: error.stack });
    next(error);
  }
};

/**
 * @desc    Get all service requests with pagination
 * @route   GET /api/service-requests
 * @access  Admin/Staff
 */
const getServiceRequests = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const startIndex = (page - 1) * limit;

    // Filters
    const query = {};
    if (req.query.status) {
      query.status = req.query.status;
    }
    if (req.query.search) {
      query.$or = [
        { name: { $regex: req.query.search, $options: "i" } },
        { email: { $regex: req.query.search, $options: "i" } },
      ];
    }

    const total = await ServiceRequest.countDocuments(query);
    const requests = await ServiceRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit);

    console.log("FETCHED SERVICE REQUESTS:", { query, total, count: requests.length, requests });

    res.status(200).json({
      success: true,
      data: requests,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error("Error fetching service requests", { error: error.message });
    next(error);
  }
};

/**
 * @desc    Update service request status
 * @route   PATCH /api/service-requests/:id/status
 * @access  Admin/Staff
 */
const updateServiceRequestStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["pending", "reviewed", "completed"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
    }

    const request = await ServiceRequest.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    );

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Service request not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Status updated successfully",
      data: request,
    });
  } catch (error) {
    logger.error("Error updating service request status", { error: error.message });
    next(error);
  }
};

/**
 * @desc    Delete a service request
 * @route   DELETE /api/service-requests/:id
 * @access  Admin
 */
const deleteServiceRequest = async (req, res, next) => {
  try {
    const { id } = req.params;

    const request = await ServiceRequest.findByIdAndDelete(id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Service request not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Service request deleted successfully",
      data: {},
    });
  } catch (error) {
    logger.error("Error deleting service request", { error: error.message });
    next(error);
  }
};

module.exports = {
  createServiceRequest,
  getServiceRequests,
  updateServiceRequestStatus,
  deleteServiceRequest,
};
