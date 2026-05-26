const mongoose = require("mongoose");
const { generateSlug } = require("../utils/slug");

const PAGE_CONTEXTS = ["GLOBAL_HOME", "VENDOR_STORE", "INFLUENCER_STORE", "BRAND_STORE", "CUSTOM_PAGE"];
const VENDOR_LAYOUT_TYPES = ["SHARED_ALL_VENDORS"];

const seoSchema = new mongoose.Schema(
  {
    metaTitle: { type: String, trim: true, default: "" },
    metaDescription: { type: String, trim: true, default: "" },
    canonicalUrl: { type: String, trim: true, default: "" },
    openGraphTitle: { type: String, trim: true, default: "" },
    openGraphDescription: { type: String, trim: true, default: "" },
    openGraphImage: { type: String, trim: true, default: "" },
    twitterTitle: { type: String, trim: true, default: "" },
    twitterDescription: { type: String, trim: true, default: "" },
    twitterImage: { type: String, trim: true, default: "" },
    twitterCard: { type: String, trim: true, default: "summary_large_image" },
    schemaMarkup: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const deviceConfigSchema = new mongoose.Schema(
  {
    colSpan: { type: Number, default: 12 },
    rowSpan: { type: Number, default: 1 },
    height: { type: Number, default: 320 },
    visible: { type: Boolean, default: true },
  },
  { _id: false }
);

const instanceSettingsSchema = new mongoose.Schema(
  {
    minHeight: { type: Number, default: 0 },
    padding: { type: Number, default: 0 },
    marginTop: { type: Number, default: 0 },
    marginRight: { type: Number, default: 0 },
    marginBottom: { type: Number, default: 0 },
    marginLeft: { type: Number, default: 0 },
    backgroundColor: { type: String, trim: true, default: "" },
    customCssClasses: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const layoutContainerSchema = new mongoose.Schema(
  {
    instanceId: { type: String, required: true, trim: true },
    containerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HomepageContainer",
      required: true,
      index: true,
    },
    order: { type: Number, default: 0 },
    visible: { type: Boolean, default: true },
    settings: { type: instanceSettingsSchema, default: () => ({}) },
    desktopConfig: { type: deviceConfigSchema, default: () => ({ visible: true }) },
    tabletConfig: { type: deviceConfigSchema, default: () => ({ visible: true }) },
    mobileConfig: { type: deviceConfigSchema, default: () => ({ visible: true }) },
  },
  { _id: false }
);

const layoutColumnSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
    width: { type: Number, default: 100 },
    span: { type: Number, default: 12 },
    desktopWidth: { type: Number, default: 100 },
    tabletWidth: { type: Number, default: 100 },
    mobileWidth: { type: Number, default: 100 },
    minWidth: { type: Number, default: 12 },
    containers: { type: [layoutContainerSchema], default: [] },
  },
  { _id: false }
);

const layoutRowSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
    type: {
      type: String,
      enum: ["1-col", "2-col", "3-col", "4-col", "custom"],
      default: "1-col",
    },
    collapsed: { type: Boolean, default: false },
    columns: { type: [layoutColumnSchema], default: [] },
  },
  { _id: false }
);

const layoutSnapshotSchema = new mongoose.Schema(
  {
    version: { type: Number, default: 0 },
    name: { type: String, trim: true, default: "" },
    slug: { type: String, trim: true, default: "" },
    pageContext: {
      type: String,
      enum: PAGE_CONTEXTS,
      default: "GLOBAL_HOME",
    },
    vendorLayoutType: {
      type: String,
      enum: VENDOR_LAYOUT_TYPES,
      default: "SHARED_ALL_VENDORS",
    },
    seo: { type: seoSchema, default: () => ({}) },
    builder: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    layouts: { type: [mongoose.Schema.Types.Mixed], default: [] },
    assignments: { type: [mongoose.Schema.Types.Mixed], default: [] },
    rows: { type: [layoutRowSchema], default: [] },
    visibility: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    scheduling: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    typography: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    auditLog: { type: [mongoose.Schema.Types.Mixed], default: [] },
    notes: { type: String, trim: true, default: "" },
    savedAt: { type: Date, default: null },
    savedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    publishedAt: { type: Date, default: null },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { _id: false }
);

const homepageLayoutSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
      index: true,
    },
    isDefault: { type: Boolean, default: false, index: true },
    versionCounter: { type: Number, default: 0 },
    pageContext: {
      type: String,
      enum: PAGE_CONTEXTS,
      default: "GLOBAL_HOME",
      index: true,
    },
    vendorLayoutType: {
      type: String,
      enum: VENDOR_LAYOUT_TYPES,
      default: "SHARED_ALL_VENDORS",
    },
    draft: { type: layoutSnapshotSchema, default: () => ({}) },
    publishedSnapshot: { type: layoutSnapshotSchema, default: null },
    activeVersionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HomepageLayoutVersion",
      default: null,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "homepageLayouts",
  }
);

homepageLayoutSchema.pre("validate", function normalizeLayout() {
  this.slug = generateSlug(this.slug || this.name || "homepage-layout");
  this.pageContext = PAGE_CONTEXTS.includes(String(this.pageContext || "").toUpperCase())
    ? String(this.pageContext).toUpperCase()
    : "GLOBAL_HOME";
  this.vendorLayoutType = VENDOR_LAYOUT_TYPES.includes(String(this.vendorLayoutType || "").toUpperCase())
    ? String(this.vendorLayoutType).toUpperCase()
    : "SHARED_ALL_VENDORS";
  if (!this.draft) {
    this.draft = {};
  }
  this.draft.name = this.draft.name || this.name;
  this.draft.slug = generateSlug(this.draft.slug || this.slug);
  this.draft.pageContext = PAGE_CONTEXTS.includes(String(this.draft.pageContext || this.pageContext || "").toUpperCase())
    ? String(this.draft.pageContext || this.pageContext).toUpperCase()
    : "GLOBAL_HOME";
  this.draft.vendorLayoutType = VENDOR_LAYOUT_TYPES.includes(String(this.draft.vendorLayoutType || this.vendorLayoutType || "").toUpperCase())
    ? String(this.draft.vendorLayoutType || this.vendorLayoutType).toUpperCase()
    : "SHARED_ALL_VENDORS";
  this.draft.builder = this.draft.builder && typeof this.draft.builder === "object" ? this.draft.builder : {};
  this.draft.layouts = Array.isArray(this.draft.layouts) ? this.draft.layouts : [];
  this.draft.rows = Array.isArray(this.draft.rows) ? this.draft.rows : [];
});

homepageLayoutSchema.index({ pageContext: 1, status: 1, isDefault: 1, updatedAt: -1 });

module.exports = {
  HomepageLayout:
    mongoose.models.HomepageLayout ||
    mongoose.model("HomepageLayout", homepageLayoutSchema),
  PAGE_CONTEXTS,
  VENDOR_LAYOUT_TYPES,
};
