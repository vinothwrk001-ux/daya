# Production-Grade Variant Inventory Management System

## Overview

This system provides comprehensive inventory tracking at the variant level, with support for reserved stock, transaction logging, and real-time alerts for low stock conditions.

## Key Features

### 1. **Variant-Level Stock Tracking**
- Track stock for each product variant independently
- Support for multiple attributes (size, color, storage, etc.)
- Real-time available stock calculation

### 2. **Reserved Stock Management**
- Automatically reserve stock when orders are placed
- Unreserve stock on order cancellation (before shipment)
- Deduct stock when shipments are confirmed
- Restore stock on returns

### 3. **Inventory Ledger**
- Transaction history for every inventory change
- Track transaction type: RESTOCK, SALE, RETURN, MANUAL_ADJUSTMENT, CANCELLATION, RESERVED, UNRESERVED
- Complete audit trail with timestamps and user tracking

### 4. **Low Stock Alerts**
- Per-variant threshold configuration
- Alert status displayed on inventory list
- Seller dashboard highlights low-stock variants

### 5. **CSV Export**
- Export product inventory in CSV format
- Includes all variant details and current stock levels

## Data Model

### Variant Schema (Product Model)

Each variant in `Product.variants` now includes:

```javascript
{
  variantId: String,           // Unique variant identifier
  title: String,               // e.g., "Blue - Size M"
  sku: String,                 // Stock Keeping Unit
  price: Number,               // Selling price
  discountPrice: Number,       // Optional discount
  stock: Number,               // Physical stock
  reservedStock: Number,       // Stock reserved for orders (NEW)
  threshold: Number,           // Low stock threshold (NEW)
  attributes: Map,             // Size, color, etc.
  weight: Object,              // Weight in kg
  images: Array,               // Variant images
  isActive: Boolean,           // Active status
}
```

### InventoryLedger Schema (New)

```javascript
{
  productId: ObjectId,         // Reference to Product
  variantId: String,           // Variant ID
  variantSku: String,          // For quick lookup
  sellerId: ObjectId,          // Reference to Seller
  
  transactionType: String,     // RESTOCK, SALE, RETURN, MANUAL_ADJUSTMENT, etc.
  status: String,              // COMPLETED, PENDING, FAILED
  
  quantityChange: Number,      // +10 or -5
  stockBefore: Number,         // Stock before transaction
  stockAfter: Number,          // Stock after transaction
  reservedBefore: Number,      // Reserved before
  reservedAfter: Number,       // Reserved after
  
  orderId: ObjectId,           // Related order
  shipmentId: ObjectId,        // Related shipment
  returnId: ObjectId,          // Related return
  
  reason: String,              // Transaction reason
  notes: String,               // Additional details
  performedBy: ObjectId,       // User who performed action
  
  createdAt: Date,             // Timestamp
  updatedAt: Date,
}
```

## API Endpoints

### Public (Read-Only)

#### Get Product Inventory Overview
```
GET /api/inventory/product/:productId
Response: {
  productId, productName, totalStock, variantCount,
  lowStockVariants, alertStatus, variants: [...]
}
```

#### Get Variant Details
```
GET /api/inventory/product/:productId/variant/:variantId
Response: { variantId, sku, price, stock, reserved, available, threshold, status }
```

#### Get Available Stock
```
GET /api/inventory/product/:productId/variant/:variantId/available
Response: { stock, reserved, available, threshold, sku }
```

#### Get Variant Ledger
```
GET /api/inventory/product/:productId/variant/:variantId/ledger?limit=100&offset=0
Response: { variantId, sku, ledger: [], pagination }
```

### Seller-Only (Protected)

#### Get Seller's Inventory Summary
```
GET /api/inventory/seller/summary
Response: { sellerId, totalProducts, totalStock, lowStockVariants, products: [] }
```

#### Get Low Stock Variants
```
GET /api/inventory/seller/low-stock?limit=50&offset=0
Response: { sellerId, total, items: [] }
```

#### Adjust Stock (Manual)
```
POST /api/inventory/product/:productId/variant/:variantId/adjust
Body: {
  quantityChange: 10,      // Positive or negative
  reason: "Damage",        // Required
  notes: "Optional details"
}
Response: { variantId, sku, adjustmentQuantity, newStock }
```

#### Update Threshold
```
PATCH /api/inventory/product/:productId/variant/:variantId/threshold
Body: { threshold: 20 }
Response: { variantId, oldThreshold, newThreshold }
```

#### Export CSV
```
GET /api/inventory/product/:productId/export/csv
Response: CSV file download
```

## Stock Calculation Formula

```javascript
availableStock = stock - reservedStock

isLowStock = availableStock <= threshold

status = isLowStock ? "LOW_STOCK" : "IN_STOCK"
```

## Order Lifecycle & Inventory Changes

### 1. Order Placed
- **Action**: Call `inventoryService.reserveStock()`
- **Changes**: `reservedStock += quantity`
- **Transaction**: RESERVED
- **Impact**: Reduces available stock, but physical stock unchanged

### 2. Order Cancelled (Before Shipment)
- **Action**: Call `inventoryService.unreserveStock()`
- **Changes**: `reservedStock -= quantity`
- **Transaction**: UNRESERVED
- **Impact**: Cancels reservation, makes stock available again

### 3. Order Shipped (Shipment Confirmed)
- **Action**: Call `inventoryService.deductStock()`
- **Changes**: `stock -= quantity` AND `reservedStock -= quantity`
- **Transaction**: SALE
- **Impact**: Actual physical stock is removed

### 4. Order Returned
- **Action**: Call `inventoryService.restoreStock()`
- **Changes**: `stock += quantity` AND optionally `reservedStock -= quantity`
- **Transaction**: RETURN
- **Impact**: Stock is added back to inventory

## Manual Adjustment Workflow

Supported Reasons:
- Damage
- Theft/Loss
- Recount/Correction
- Sample/Demo
- Return Processing
- Other (custom)

## Frontend Pages

### 1. Inventory List Page (`/vendor/inventory`)
- Summary cards: Total products, total stock, low-stock count, alert status
- Searchable product table
- Filter by status (All, Low Stock, In Stock)
- Click "View Details" to see variant details

### 2. Inventory Details Page (`/vendor/inventory/:productId`)
- Product overview with summary stats
- Variant table with expandable rows
- Actions: Adjust Stock, Update Threshold, View Ledger, Export CSV
- Modal forms for adjustments and threshold updates
- Real-time updates after changes

## Security & Validations

### Prevent Negative Stock
```javascript
if (newStock < 0) {
  throw new AppError("Cannot reduce stock below 0", 400, "NEGATIVE_STOCK");
}
```

### Prevent Overselling
```javascript
const available = stock - reservedStock;
if (available < quantity) {
  throw new AppError("Insufficient stock", 400, "INSUFFICIENT_STOCK");
}
```

### Validate Variant Ownership
- Only seller can adjust their own products' inventory
- Admin can adjust any product's inventory
- All modifications are logged with user ID

### Reserved Stock Validation
```javascript
if (reservedStock < quantity) {
  throw new AppError("Reserved quantity mismatch", 400, "RESERVED_MISMATCH");
}
```

## Backward Compatibility

The system maintains backward compatibility with existing product inventory:

1. **Product-level stock still works**: `Product.stock` is maintained
2. **Existing orders unaffected**: Legacy orders continue processing
3. **Migration path**: Variants default to `reservedStock: 0` and `threshold: 10`
4. **Optional adoption**: Sellers can adopt variant tracking gradually

## Testing Checklist

- ✅ Reserve stock when order is placed
- ✅ Unreserve stock when order is cancelled
- ✅ Deduct stock when shipment is confirmed
- ✅ Restore stock when return is processed
- ✅ Manual stock adjustments work correctly
- ✅ Threshold updates persist
- ✅ Negative stock prevention works
- ✅ Overselling prevention works
- ✅ Low-stock alerts display correctly
- ✅ CSV export includes all data
- ✅ Ledger records all transactions
- ✅ Seller permissions enforced
- ✅ Stock calculations accurate

## Integration Points

### With Order Management
- When order is placed: Reserve stock
- When order is cancelled: Unreserve stock
- When shipment is confirmed: Deduct stock

### With Return Management
- When return is processed: Restore stock
- Automatically update reserved stock

### With Analytics
- Track low-stock items for demand forecasting
- Monitor transaction history for trends
- Identify slow-moving variants

## Performance Optimization

1. **Indexed Fields**:
   - `InventoryLedger`: `productId + variantId + createdAt`
   - `InventoryLedger`: `sellerId + createdAt`
   - `InventoryLedger`: `transactionType + createdAt`

2. **Pagination**: Ledger queries use limit/offset
3. **Selective Updates**: Only update changed fields
4. **Batch Operations**: Support bulk adjustments in future

## Future Enhancements

1. **Restock Automation**: Auto-create purchase orders when stock falls below threshold
2. **Demand Forecasting**: Predict future inventory needs
3. **Multi-warehouse**: Support multiple warehouse locations
4. **Cycle Counting**: Built-in physical count verification
5. **Bulk Adjustments**: Upload CSV for mass updates
6. **Notifications**: Real-time low-stock notifications
7. **Analytics Dashboard**: Advanced inventory analytics
8. **Historical Trending**: Track stock trends over time

## Troubleshooting

### Reserved stock not updating
- Check that `inventoryService.reserveStock()` is called when order is placed
- Verify the order status transition triggers reservation

### CSV export not working
- Check server logs for errors
- Verify `responseType: 'blob'` is set in frontend service

### Low stock not alerting
- Verify threshold is set correctly for variant
- Check that available stock (stock - reserved) is below threshold

### Ledger not recording transactions
- Check `InventoryLedger` collection exists
- Verify `_recordTransaction()` is not failing silently
- Check user permissions for performing adjustments
