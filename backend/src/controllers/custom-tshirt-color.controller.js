const CustomTShirtColor = require("../models/CustomTShirtColor");

// Public API: Get only active colors, sorted by displayOrder
exports.getPublicCustomTShirtColors = async (req, res) => {
  try {
    const colors = await CustomTShirtColor.find({ isActive: true }).sort({ displayOrder: 1, createdAt: -1 });
    res.status(200).json({ success: true, data: colors });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching custom t-shirt colors" });
  }
};

// Admin API: Get all colors
exports.getAdminCustomTShirtColors = async (req, res) => {
  try {
    const colors = await CustomTShirtColor.find().sort({ displayOrder: 1, createdAt: -1 });
    res.status(200).json({ success: true, data: colors });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching custom t-shirt colors" });
  }
};

// Admin API: Create a new color
exports.createCustomTShirtColor = async (req, res) => {
  try {
    const { name, hex, border, availableInGsm, isActive, displayOrder } = req.body;

    const newColor = new CustomTShirtColor({
      name,
      hex,
      border,
      availableInGsm,
      isActive,
      displayOrder,
    });

    await newColor.save();
    res.status(201).json({ success: true, data: newColor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Error creating custom t-shirt color" });
  }
};

// Admin API: Update a color
exports.updateCustomTShirtColor = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, hex, border, availableInGsm, isActive, displayOrder } = req.body;

    const updatedColor = await CustomTShirtColor.findByIdAndUpdate(
      id,
      { name, hex, border, availableInGsm, isActive, displayOrder },
      { new: true, runValidators: true }
    );

    if (!updatedColor) {
      return res.status(404).json({ success: false, message: "Color not found" });
    }

    res.status(200).json({ success: true, data: updatedColor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Error updating custom t-shirt color" });
  }
};

// Admin API: Delete a color
exports.deleteCustomTShirtColor = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedColor = await CustomTShirtColor.findByIdAndDelete(id);

    if (!deletedColor) {
      return res.status(404).json({ success: false, message: "Color not found" });
    }

    res.status(200).json({ success: true, message: "Color deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error deleting custom t-shirt color" });
  }
};
