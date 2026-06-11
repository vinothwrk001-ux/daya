import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BackButton } from "./BackButton";
import { DynamicAttributeField } from "./DynamicAttributeField";
import { ProductImageUploader } from "./product-images/ProductImageUploader";
import { VariantImageUploader } from "./product-images/VariantImageUploader";
import { useCategories } from "../hooks/useCategories";
import { getSubcategoriesByCategory } from "../services/subcategoryService";
import { getAttributes } from "../services/attributeService";
import { getProductModules } from "../services/productModuleService";
import * as productService from "../services/productService";
import {
  buildVariantCombinations,
  mergeVariantRows,
  normalizeVariantPayloadRows,
  parseCommaSeparatedValues,
} from "../utils/productVariants";
import { buildImagePayload, hydrateManagedImages } from "../utils/productImages";

function normalizeError(err) {
  return err?.response?.data?.message || err?.message || "Request failed";
}

function getInitialForm() {
  return {
    name: "",
    description: "",
    shortDescription: "",
    category: "",
    categoryId: "",
    subCategory: "",
    subCategoryId: "",
    price: "",
    discountPrice: "",
    stock: "",
    SKU: "",
    productNumber: "",
    lowStockThreshold: 10,
    images: [],
    tags: "",
    weight: "",
    returnPolicy: "",
    metaDescription: "",
    metaKeywords: "",
    modulesData: {},
    attributes: {},
  };
}

function buildInitialVariantSelections(variantDefs, existingVariants = []) {
  const selections = {};
  for (const def of variantDefs) {
    const values = Array.from(
      new Set(
        (existingVariants || [])
          .map((variant) => variant?.attributes?.[def.key])
          .filter(Boolean)
      )
    );
    selections[def.key] = values;
  }
  return selections;
}

function sortDefinitions(defs = []) {
  return [...defs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
}

function flattenAttributeGroups(groups = {}) {
  return Object.values(groups).flatMap((fields) => (Array.isArray(fields) ? fields : []));
}

function buildModuleSections(groups = {}, modules = []) {
  const moduleByKey = new Map((modules || []).map((moduleDef) => [moduleDef.key, moduleDef]));
  return Object.entries(groups)
    .map(([moduleKey, fields]) => ({
      key: moduleKey,
      name: moduleByKey.get(moduleKey)?.name || fields?.[0]?.group || moduleKey,
      order: moduleByKey.get(moduleKey)?.order ?? 999,
      fields: sortDefinitions(fields || []),
    }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
}

function mergeLegacyModulesData(moduleSections = [], currentModulesData = {}, legacyAttributes = {}) {
  const nextModulesData = { ...(currentModulesData || {}) };

  for (const section of moduleSections) {
    for (const field of section.fields.filter((item) => !item.isVariant)) {
      const existingValue = nextModulesData?.[section.key]?.[field.key];
      const fallbackValue = legacyAttributes?.[field.key];
      if (existingValue !== undefined || fallbackValue === undefined) continue;
      nextModulesData[section.key] = {
        ...(nextModulesData[section.key] || {}),
        [field.key]: fallbackValue,
      };
    }
  }

  return nextModulesData;
}

function normalizeEditorImages(images = [], fallbackAlt = "", prefix = "image") {
  return hydrateManagedImages(images, {
    fallbackAlt,
    idPrefix: prefix,
  });
}

export function ProductEditor({
  mode = "admin",
  productId = "",
  title,
  createLabel,
  updateLabel,
  backTo,
  listPath,
  fetchProduct,
  generateProductNumber = productService.generateProductNumber,
  createProduct,
  updateProduct,
  uploadImages = productService.uploadProductImages,
}) {
  const navigate = useNavigate();
  const isEditing = Boolean(productId);
  const isAdmin = mode === "admin";
  const { categories, loading: categoriesLoading } = useCategories({ includeInactive: isAdmin });

  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState(getInitialForm);
  const [subcategories, setSubcategories] = useState([]);
  const [subcategoriesLoading, setSubcategoriesLoading] = useState(false);
  const [attributeGroups, setAttributeGroups] = useState({});
  const [filterDefinitions, setFilterDefinitions] = useState([]);
  const [productModules, setProductModules] = useState([]);
  const [variantRows, setVariantRows] = useState([]);
  const [variantSelections, setVariantSelections] = useState({});
  const [loadedVariantSnapshot, setLoadedVariantSnapshot] = useState([]);

  const moduleSections = useMemo(
    () => buildModuleSections(attributeGroups, productModules),
    [attributeGroups, productModules]
  );
  const sortedAttributeDefs = useMemo(() => sortDefinitions(flattenAttributeGroups(attributeGroups)), [attributeGroups]);
  const variantDefs = useMemo(
    () => sortedAttributeDefs.filter((item) => item.isVariant),
    [sortedAttributeDefs]
  );
  const productFilterDefs = useMemo(
    () => sortDefinitions((filterDefinitions || []).filter((item) => !item.isVariant)),
    [filterDefinitions]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadModules() {
      try {
        const response = await getProductModules();
        if (!cancelled) {
          setProductModules(Array.isArray(response?.data) ? response.data : []);
        }
      } catch {
        if (!cancelled) setProductModules([]);
      }
    }

    loadModules();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isEditing) return;

    let cancelled = false;
    (async () => {
      try {
        const response = await fetchProduct(productId);
        const product = response?.data;
        if (!product || cancelled) return;

        setFormData({
          name: product.name || "",
          description: product.description || "",
          shortDescription: product.shortDescription || "",
          category: product.category || "",
          categoryId: product.categoryId?._id || product.categoryId || "",
          subCategory: product.subCategory || "",
          subCategoryId: product.subCategoryId?._id || product.subCategoryId || "",
          price: product.price?.toString() || "",
          discountPrice: product.discountPrice?.toString() || "",
          stock: product.stock?.toString() || "",
          SKU: product.productNumber || product.SKU || "",
          productNumber: product.productNumber || product.SKU || "",
          lowStockThreshold: product.lowStockThreshold || 10,
          images: normalizeEditorImages(product.images || [], product.name || "Product image", "product-image"),
          tags: product.tags?.join(", ") || "",
          weight:
            product.weight && typeof product.weight === "object"
              ? product.weight.value?.toString?.() || ""
              : product.weight?.toString() || "",
          returnPolicy: product.returnPolicy || "",
          metaDescription: product.metaDescription || "",
          metaKeywords: product.metaKeywords?.join(", ") || "",
          modulesData: product.modulesData || product.extraDetails || {},
          attributes: product.attributes || {},
        });

        setVariantRows(
          (product.variants || []).map((variant) => ({
            ...variant,
            price: variant.price?.toString?.() ?? variant.price ?? "",
            discountPrice: variant.discountPrice?.toString?.() ?? "",
            stock: variant.stock?.toString?.() ?? variant.stock ?? 0,
            weight:
              variant.weight?.value?.toString?.() ??
              (product.weight && typeof product.weight === "object"
                ? product.weight.value?.toString?.() || ""
                : product.weight?.toString?.() || ""),
            images: normalizeEditorImages(
              variant.images || [],
              variant.title ? `${product.name} ${variant.title}` : product.name || "Variant image",
              `variant-${variant.variantId}`
            ),
          }))
        );
        setLoadedVariantSnapshot(product.variants || []);
      } catch (err) {
        if (!cancelled) setError(normalizeError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchProduct, isEditing, productId]);

  useEffect(() => {
    let cancelled = false;
    async function loadSubcategories() {
      if (!formData.categoryId) {
        setSubcategories([]);
        return;
      }
      setSubcategoriesLoading(true);
      try {
        const res = await getSubcategoriesByCategory(formData.categoryId);
        if (!cancelled) setSubcategories(Array.isArray(res?.data) ? res.data : []);
      } catch {
        if (!cancelled) setSubcategories([]);
      } finally {
        if (!cancelled) setSubcategoriesLoading(false);
      }
    }
    loadSubcategories();
    return () => {
      cancelled = true;
    };
  }, [formData.categoryId]);

  useEffect(() => {
    let cancelled = false;
    async function loadAttributes() {
      if (!formData.categoryId || !formData.subCategoryId) {
        setAttributeGroups({});
        return;
      }

      try {
        const res = await getAttributes({
          categoryId: formData.categoryId,
          subCategoryId: formData.subCategoryId,
        });
        const groupedDefs = res?.data && typeof res.data === "object" ? res.data : {};
        const defs = sortDefinitions(flattenAttributeGroups(groupedDefs));
        if (cancelled) return;
        setAttributeGroups(groupedDefs);
        setFormData((prev) => {
          const nextModulesData = mergeLegacyModulesData(
            buildModuleSections(groupedDefs, productModules),
            prev.modulesData || {},
            prev.attributes || {}
          );
          for (const section of buildModuleSections(groupedDefs, productModules)) {
            for (const def of section.fields.filter((item) => !item.isVariant)) {
              if (nextModulesData?.[section.key]?.[def.key] === undefined) {
                nextModulesData[section.key] = {
                  ...(nextModulesData[section.key] || {}),
                  [def.key]: def.type === "multi-select" ? [] : "",
                };
              }
            }
          }
          return { ...prev, modulesData: nextModulesData };
        });

        setVariantSelections((prev) => {
          const seeded = Object.keys(prev || {}).length
            ? prev
            : buildInitialVariantSelections(defs.filter((item) => item.isVariant), loadedVariantSnapshot);
          const next = {};
          for (const def of defs.filter((item) => item.isVariant)) {
            next[def.key] = Array.isArray(seeded?.[def.key]) ? seeded[def.key] : [];
          }
          return next;
        });
      } catch {
        if (!cancelled) {
          setAttributeGroups({});
        }
      }
    }
    loadAttributes();
    return () => {
      cancelled = true;
    };
  }, [formData.categoryId, formData.subCategoryId, loadedVariantSnapshot, productModules]);

  useEffect(() => {
    const defs = sortedAttributeDefs.filter((item) => item.useInFilters);
    setFilterDefinitions(defs);
    setFormData((prev) => {
      const nextAttributes = { ...(prev.attributes || {}) };
      for (const def of defs) {
        if (nextAttributes[def.key] !== undefined) continue;
        nextAttributes[def.key] = def.type === "multi-select" ? [] : "";
      }
      return { ...prev, attributes: nextAttributes };
    });
  }, [sortedAttributeDefs]);

  useEffect(() => {
    let cancelled = false;
    async function loadProductNumber() {
      if (isEditing || !formData.categoryId || !formData.subCategoryId) return;
      try {
        const res = await generateProductNumber({
          categoryId: formData.categoryId,
          subCategoryId: formData.subCategoryId,
        });
        const nextNumber = res?.data?.productNumber || "";
        if (!cancelled) {
          setFormData((prev) => ({
            ...prev,
            SKU: nextNumber,
            productNumber: nextNumber,
          }));
        }
      } catch {
        if (!cancelled) {
          setFormData((prev) => ({ ...prev, SKU: "", productNumber: "" }));
        }
      }
    }
    loadProductNumber();
    return () => {
      cancelled = true;
    };
  }, [formData.categoryId, formData.subCategoryId, generateProductNumber, isEditing]);

  useEffect(() => {
    if (!variantDefs.length) return;
    const combinations = buildVariantCombinations(variantDefs, variantSelections);
    setVariantRows((prev) =>
      mergeVariantRows({
        combinations,
        existingVariants: prev,
        basePrice: formData.price,
        baseDiscountPrice: formData.discountPrice,
        baseStock: formData.stock,
        baseWeight: formData.weight,
        productNumber: formData.productNumber,
      })
    );
  }, [variantDefs, variantSelections, formData.price, formData.discountPrice, formData.stock, formData.weight, formData.productNumber]);

  function handleChange(event) {
    const { name, value } = event.target;
    if (name === "categoryId") {
      const selectedCategory = categories.find((category) => category._id === value);
      setFormData((prev) => ({
        ...prev,
        categoryId: value,
        category: selectedCategory?.name || "",
        subCategoryId: "",
        subCategory: "",
        productNumber: "",
        SKU: "",
        modulesData: {},
        attributes: {},
      }));
      setVariantSelections({});
      setVariantRows([]);
      setLoadedVariantSnapshot([]);
      return;
    }

    if (name === "subCategoryId") {
      const selectedSubcategory = subcategories.find((item) => item._id === value);
      setFormData((prev) => ({
        ...prev,
        subCategoryId: value,
        subCategory: selectedSubcategory?.name || "",
        modulesData: {},
        attributes: {},
      }));
      setVariantSelections({});
      setVariantRows([]);
      setLoadedVariantSnapshot([]);
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function handleImagesChange(newImages) {
    setFormData((prev) => ({
      ...prev,
      images: normalizeEditorImages(newImages, prev.name || "Product image", "product-image"),
    }));
  }

  function handleVariantSelectionChange(def, rawValue) {
    if (def.type === "multi-select" || def.options?.length) {
      setVariantSelections((prev) => ({
        ...prev,
        [def.key]: Array.isArray(rawValue) ? rawValue : [],
      }));
      return;
    }

    setVariantSelections((prev) => ({
      ...prev,
      [def.key]: parseCommaSeparatedValues(rawValue),
    }));
  }

  function handleVariantCheckboxToggle(def, optionValue, checked) {
    setVariantSelections((prev) => {
      const currentValues = Array.isArray(prev?.[def.key]) ? prev[def.key] : [];
      const nextValues = checked
        ? Array.from(new Set([...currentValues, optionValue]))
        : currentValues.filter((value) => value !== optionValue);

      return {
        ...prev,
        [def.key]: nextValues,
      };
    });
  }

  function updateVariantRow(variantId, patch) {
    setVariantRows((prev) =>
      prev.map((row) => (row.variantId === variantId ? { ...row, ...patch } : row))
    );
  }

  function handleVariantImagesChange(variant, images) {
    updateVariantRow(variant.variantId, {
      images: normalizeEditorImages(
        images,
        variant.title ? `${formData.name} ${variant.title}` : formData.name || "Variant image",
        `variant-${variant.variantId}`
      ),
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!formData.name.trim()) return setError("Product name is required");
    if (!formData.description.trim()) return setError("Product description is required");
    if (!formData.categoryId) return setError("Category is required");
    if (!formData.subCategoryId) return setError("Subcategory is required");
    if (formData.images.length === 0) return setError("At least one product image is required");
    if (formData.images.some((image) => image?.status === "uploading")) return setError("Wait for product image uploads to finish");
    if (!formData.productNumber.trim()) return setError("Product number is required");
    if (!formData.weight || Number(formData.weight) <= 0) return setError("Product weight is required");

    for (const section of moduleSections) {
      for (const field of section.fields.filter((item) => !item.isVariant)) {
        const value = formData.modulesData?.[section.key]?.[field.key];
        const isEmpty =
          value === undefined ||
          value === null ||
          value === "" ||
          (Array.isArray(value) && value.length === 0);
        if (field.required && isEmpty) return setError(`${section.name}: ${field.name} is required`);
      }
    }

    const normalizedVariantRows = variantDefs.length
      ? normalizeVariantPayloadRows(variantRows, formData.name)
      : [];

    if (variantDefs.length && normalizedVariantRows.length === 0) {
      return setError("Select values for each variant type to generate product variants");
    }

    for (const variant of normalizedVariantRows) {
      if ((variantRows.find((row) => row.variantId === variant.variantId)?.images || []).some((image) => image?.status === "uploading")) {
        return setError(`Wait for ${variant.title || "variant"} image uploads to finish`);
      }
      if (!variant.sku) return setError("Each variant requires a SKU");
      if (!Number.isFinite(variant.price) || variant.price < 0) return setError("Each variant requires a valid price");
      if (
        variant.discountPrice !== undefined &&
        (!Number.isFinite(variant.discountPrice) || variant.discountPrice < 0)
      ) {
        return setError("Each variant requires a valid discount price");
      }
      if (!Number.isFinite(variant.stock) || variant.stock < 0) return setError("Each variant requires a valid stock quantity");
      if (!Number.isFinite(Number(variant.weight?.value || 0)) || Number(variant.weight?.value || 0) <= 0) {
        return setError("Each variant requires a valid weight in kg");
      }
    }

    setSubmitting(true);

    try {
      const processedImages = buildImagePayload(formData.images, formData.name || "Product image");

      const payload = {
        name: formData.name,
        description: formData.description,
        shortDescription: formData.shortDescription,
        category: formData.category,
        categoryId: formData.categoryId,
        subCategory: formData.subCategory,
        subCategoryId: formData.subCategoryId,
        price: Number(formData.price || 0),
        ...(formData.discountPrice !== "" ? { discountPrice: Number(formData.discountPrice || 0) } : {}),
        stock: Number(formData.stock || 0),
        SKU: formData.productNumber.toUpperCase(),
        productNumber: formData.productNumber.toUpperCase(),
        modulesData: formData.modulesData || {},
        attributes: Object.fromEntries(
          Object.entries(formData.attributes || {}).filter(([, value]) =>
            !(
              value === undefined ||
              value === null ||
              value === "" ||
              (Array.isArray(value) && value.length === 0)
            )
          )
        ),
        variants: normalizedVariantRows,
        lowStockThreshold: Number(formData.lowStockThreshold || 10),
        images: processedImages,
        tags: formData.tags
          .split(",")
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean),
        weight: {
          value: Number(formData.weight),
          unit: "kg",
        },
        returnPolicy: formData.returnPolicy,
        metaDescription: formData.metaDescription,
        metaKeywords: formData.metaKeywords
          .split(",")
          .map((key) => key.trim())
          .filter(Boolean),
      };

      if (isEditing) {
        await updateProduct(productId, payload);
      } else {
        await createProduct(payload);
      }

      navigate(listPath);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">Loading product...</div>;
  }

  return (
    <div className="grid gap-4 sm:gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{title}</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Dynamic attributes, category-based variants, and admin-controlled product modules all stay in one workflow.
          </p>
        </div>
        <BackButton fallbackTo={backTo} />
      </div>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div> : null}

      <form onSubmit={handleSubmit} className="grid gap-4 sm:gap-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Basic information</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Product name *</label>
              <input name="name" value={formData.name} onChange={handleChange} className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Description *</label>
              <textarea name="description" value={formData.description} onChange={handleChange} rows={5} className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Short description</label>
              <input name="shortDescription" value={formData.shortDescription} onChange={handleChange} className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Classification</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Category *</label>
              <select name="categoryId" value={formData.categoryId} onChange={handleChange} disabled={categoriesLoading} className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white">
                <option value="">{categoriesLoading ? "Loading..." : "Select category"}</option>
                {categories.map((category) => (
                  <option key={category._id} value={category._id}>{category.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Subcategory *</label>
              <select name="subCategoryId" value={formData.subCategoryId} onChange={handleChange} disabled={!formData.categoryId || subcategoriesLoading} className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white">
                <option value="">{!formData.categoryId ? "Select category first" : subcategoriesLoading ? "Loading..." : "Select subcategory"}</option>
                {subcategories.map((subcategory) => (
                  <option key={subcategory._id} value={subcategory._id}>{subcategory.name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Tags</label>
              <input name="tags" value={formData.tags} onChange={handleChange} className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white" placeholder="wireless, flagship, premium" />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Pricing seed and inventory baseline</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            These values seed new variants. Once variants are generated, live selling price and stock come from the variant rows.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Base price *</label>
              <input type="number" name="price" value={formData.price} onChange={handleChange} min="0" step="0.01" className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Base discount price</label>
              <input type="number" name="discountPrice" value={formData.discountPrice} onChange={handleChange} min="0" step="0.01" className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Base stock *</label>
              <input type="number" name="stock" value={formData.stock} onChange={handleChange} min="0" className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Product number *</label>
              <input type="text" name="productNumber" value={formData.productNumber} disabled className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm uppercase dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Generic product gallery</h2>
          <div className="mt-4">
            <ProductImageUploader
              images={formData.images}
              onChange={handleImagesChange}
              uploadImages={uploadImages}
              productName={formData.name}
              maxImages={10}
              title="Drag & drop generic product images"
              description="These images act as the fallback gallery for every variant and appear after variant-specific media."
            />
          </div>
        </section>

        {moduleSections.length ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Module-driven fields</h2>
            <div className="mt-4 grid gap-5">
              {moduleSections.map((section) => {
                const moduleFields = section.fields.filter((item) => !item.isVariant);
                if (!moduleFields.length) return null;

                return (
                  <div key={section.key} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="text-base font-semibold text-slate-950 dark:text-white">{section.name}</div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      {moduleFields.map((attribute) => (
                        <div key={attribute._id || `${section.key}-${attribute.key}`}>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            {attribute.name}
                            {attribute.required ? " *" : ""}
                          </label>
                          <DynamicAttributeField
                            attribute={attribute}
                            value={formData.modulesData?.[section.key]?.[attribute.key]}
                            onChange={(key, value) =>
                              setFormData((prev) => ({
                                ...prev,
                                modulesData: {
                                  ...(prev.modulesData || {}),
                                  [section.key]: {
                                    ...(prev.modulesData?.[section.key] || {}),
                                    [key]: value,
                                  },
                                },
                              }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {productFilterDefs.length ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Filter-ready attributes</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              These fields feed the storefront filter sidebar for this category and subcategory.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {productFilterDefs.map((filterDef) => (
                <div key={filterDef._id || filterDef.key}>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    {filterDef.name}
                  </label>
                  <DynamicAttributeField
                    attribute={filterDef}
                    value={formData.attributes?.[filterDef.key]}
                    onChange={(key, value) =>
                      setFormData((prev) => ({
                        ...prev,
                        attributes: {
                          ...(prev.attributes || {}),
                          [key]: filterDef.type === "range" && value !== "" ? Number(value) : value,
                        },
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {variantDefs.length ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Dynamic variants</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Variant types come from admin-managed attributes marked for variants. Select values and the system generates the sellable SKU matrix.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {variantDefs.map((def) => (
                <div key={def.key}>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{def.name}</label>
                  {def.options?.length ? (
                    <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                      <div className="flex flex-wrap gap-2">
                        {def.options.map((option) => {
                          const checked = (variantSelections?.[def.key] || []).includes(option);
                          return (
                            <label
                              key={option}
                              className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                                checked
                                  ? "border-slate-950 bg-slate-950 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950"
                                  : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-current accent-[color:var(--commerce-accent)]"
                                checked={checked}
                                onChange={(event) => handleVariantCheckboxToggle(def, option, event.target.checked)}
                              />
                              <span>{option}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={(variantSelections?.[def.key] || []).join(", ")}
                      onChange={(event) => handleVariantSelectionChange(def, event.target.value)}
                      placeholder={`Enter ${def.name} values separated by commas`}
                      className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-4">
              {variantRows.length ? (
                variantRows.map((variant) => (
                  <article key={variant.variantId} className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/50">
                    <div className="grid gap-5 xl:grid-cols-[minmax(240px,1fr)_minmax(380px,1.5fr)]">
                      <div className="space-y-4">
                        <div>
                          <div className="font-semibold text-slate-950 dark:text-white">{variant.title}</div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {variant.options?.map((item) => `${item.name}: ${item.value}`).join(" | ")}
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Price</label>
                            <input type="number" min="0" step="0.01" value={variant.price} onChange={(event) => updateVariantRow(variant.variantId, { price: event.target.value })} className="mt-1 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Discount Price</label>
                            <input type="number" min="0" step="0.01" value={variant.discountPrice ?? ""} onChange={(event) => updateVariantRow(variant.variantId, { discountPrice: event.target.value })} className="mt-1 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Stock</label>
                            <input type="number" min="0" value={variant.stock} onChange={(event) => updateVariantRow(variant.variantId, { stock: event.target.value })} className="mt-1 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Weight (kg)</label>
                            <input type="number" min="0.01" step="0.01" value={variant.weight || ""} onChange={(event) => updateVariantRow(variant.variantId, { weight: event.target.value })} className="mt-1 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">SKU</label>
                            <input type="text" value={variant.sku} onChange={(event) => updateVariantRow(variant.variantId, { sku: event.target.value.toUpperCase() })} className="mt-1 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm uppercase dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                          </div>
                        </div>
                      </div>

                      <VariantImageUploader
                        images={variant.images || []}
                        onChange={(images) => handleVariantImagesChange(variant, images)}
                        uploadImages={uploadImages}
                        productName={formData.name}
                        title={`${variant.title} images`}
                        description="Upload the gallery that should appear when shoppers select this variant."
                      />
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Select variant values above to generate combinations automatically.
                </div>
              )}
            </div>
          </section>
        ) : null}

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Additional details</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Weight (kg) *</label>
              <input type="number" name="weight" value={formData.weight} onChange={handleChange} min="0.1" step="0.01" className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Low stock threshold</label>
              <input type="number" name="lowStockThreshold" value={formData.lowStockThreshold} onChange={handleChange} min="0" className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Return policy</label>
              <textarea name="returnPolicy" value={formData.returnPolicy} onChange={handleChange} rows={3} className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Meta description</label>
              <input name="metaDescription" value={formData.metaDescription} onChange={handleChange} maxLength={160} className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Meta keywords</label>
              <input name="metaKeywords" value={formData.metaKeywords} onChange={handleChange} className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="submit" disabled={submitting} className="rounded-2xl bg-[color:var(--commerce-accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
            {submitting ? "Saving..." : isEditing ? updateLabel : createLabel}
          </button>
          <button type="button" onClick={() => navigate(listPath)} className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
