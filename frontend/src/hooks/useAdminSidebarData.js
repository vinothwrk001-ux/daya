import { useEffect, useMemo, useState } from "react";
import { ADMIN_PRIMARY_ITEM, ADMIN_SECTION_ITEMS } from "../config/sidebarModules";
import { useAdminSession } from "./useAdminSession";
import vendorModuleService from "../services/vendorModule.service";

export function useAdminSidebarData(summary = { modules: {}, subModules: {} }) {
  const { isLegacyAdmin, canAccess } = useAdminSession();
  const [enabledModules, setEnabledModules] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadModuleFlags() {
      if (!isLegacyAdmin) {
        setEnabledModules({});
        return;
      }

      try {
        setLoading(true);
        const modules = await vendorModuleService.getAllModules();
        if (!active) return;
        setEnabledModules(
          Object.fromEntries(modules.map((module) => [module.key, module.enabled === true]))
        );
      } catch {
        if (!active) return;
        setEnabledModules({});
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadModuleFlags();
    return () => {
      active = false;
    };
  }, [isLegacyAdmin]);

  const sections = useMemo(() => {
    function canShowItem(item) {
      if (item.legacyOnly && !isLegacyAdmin) {
        return false;
      }

      if (item.permission && !canAccess(item.permission)) {
        return false;
      }

      if (item.moduleKey && enabledModules[item.moduleKey] === false) {
        return false;
      }

      return true;
    }

    function normalizeItem(item) {
      if (item.children?.length) {
        const children = item.children
          .map(normalizeItem)
          .filter(Boolean);
        if (!children.length) return null;
        return {
          ...item,
          children,
          badgeCount: children.reduce((sum, child) => sum + Number(child.badgeCount || 0), 0),
        };
      }

      if (!canShowItem(item)) return null;
      return {
        ...item,
        badgeCount: Number(summary.subModules?.[item.notificationSubModule] || 0),
      };
    }

    return ADMIN_SECTION_ITEMS.map((section) => ({
      ...section,
      badgeCount: Number(summary.modules?.[section.notificationModule] || 0),
      items: section.items.map(normalizeItem).filter(Boolean),
    })).filter((section) => section.items.length > 0);
  }, [canAccess, enabledModules, isLegacyAdmin, summary.modules, summary.subModules]);

  return {
    title: "Admin Hub",
    subtitle: "Accordion navigation",
    primaryItem: ADMIN_PRIMARY_ITEM,
    sections,
    loading,
    error: "",
  };
}
