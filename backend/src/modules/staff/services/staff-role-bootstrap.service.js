const { Role } = require("../models/Role");
const {
  STAFF_PERMISSION_CATALOG,
  normalizePermissions,
} = require("../permissions");

const PREDEFINED_ROLES = [
  {
    name: "Admin",
    description: "Full staff access across supported modules.",
    permissions: Object.fromEntries(
      Object.entries(STAFF_PERMISSION_CATALOG).map(([moduleName, actions]) => [
        moduleName,
        Object.fromEntries(actions.map((action) => [action, true])),
      ])
    ),
  },
  {
    name: "Support",
    description: "Customer support focused permissions.",
    permissions: normalizePermissions({
      users: { read: true },
      orders: { read: true, update: true },
      products: { read: true },
      reviews: { read: true, delete: true },
      analytics: { read: true },
      branding: { view: true },
    }),
  },
  {
    name: "Finance",
    description: "Payments and analytics access.",
    permissions: normalizePermissions({
      orders: { read: true },
      payments: { read: true, refund: true },
      analytics: { read: true },
      branding: { view: true },
    }),
  },
  {
    name: "Operations",
    description: "Product and order operational workflows.",
    permissions: normalizePermissions({
      orders: { read: true, update: true, cancel: true },
      products: { read: true, create: true, update: true, delete: true },
      analytics: { read: true },
      settings: { update: true },
      branding: { view: true, update: true },
    }),
  },
];

async function ensurePredefinedStaffRoles() {
  await Role.bulkWrite(
    PREDEFINED_ROLES.map((role) => ({
      updateOne: {
        filter: { name: role.name },
        update: {
          $setOnInsert: {
            ...role,
            isSystem: true,
          },
        },
        upsert: true,
      },
    }))
  );
}

module.exports = {
  PREDEFINED_ROLES,
  ensurePredefinedStaffRoles,
};
