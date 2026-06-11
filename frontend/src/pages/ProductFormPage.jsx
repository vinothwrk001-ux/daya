import { useParams } from "react-router-dom";
import { ProductEditor } from "../components/ProductEditor";
import * as productService from "../services/productService";

export function ProductFormPage() {
  const { productId } = useParams();

  return (
    <ProductEditor
      mode="admin"
      productId={productId}
      title={productId ? "Edit Product" : "Create Product"}
      createLabel="Create Product"
      updateLabel="Update Product"
      backTo="/admin/products"
      listPath="/admin/products"
      fetchProduct={productService.getProductById}
      createProduct={productService.createProduct}
      updateProduct={productService.updateProduct}
      uploadImages={productService.uploadProductImages}
    />
  );
}
