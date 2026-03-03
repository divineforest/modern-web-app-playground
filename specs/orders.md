# Orders

## Overview

This feature provides basic CRUD operations for managing orders. The feature is exposed as an API for use by other microservices and tools.

## Goals and Non-Goals

### Goals

- Provide CRUD operations for order management
- Track order status through lifecycle

### Non-Goals

- Line items management (future enhancement)
- Order fulfillment / shipping workflows
- Inventory management
- Approval workflows

## Functional Requirements

### FR-1: Create Order

- The system SHALL accept order creation requests via API
- The system SHALL validate required fields (orderNumber, orderDate, currency, subtotal, totalAmount)
- The system SHALL validate status field against allowed values (draft, confirmed, processing, shipped, fulfilled, cancelled)
- The system SHALL set default status to "draft" if not provided
- The system SHALL validate that orderNumber is globally unique
- The system SHALL generate a unique identifier for each order
- The system SHALL store orders with timestamps (createdAt, updatedAt)
- The system SHALL return the created order including generated fields

### FR-2: Read Order

- The system SHALL retrieve a single order by its unique identifier
- The system SHALL return complete order data including all fields
- The system SHALL return appropriate error when order is not found

### FR-3: Update Order

- The system SHALL accept partial updates to existing orders
- The system SHALL validate updated fields before persisting changes
- The system SHALL update the updatedAt timestamp on successful update
- The system SHALL preserve fields not included in the update request
- The system SHALL return the updated order with all current values
- The system SHALL return appropriate error when order is not found

### FR-4: Delete Order

- The system SHALL delete orders permanently from the database
- The system SHALL return success response after successful deletion
- The system SHALL return appropriate error when order is not found

### FR-5: List Orders

- The system SHALL retrieve multiple orders
- The system SHALL support filtering by:
  - status (exact match)
- The system SHALL return orders ordered by order date (newest first)

## Data Model

### Order Entity

```typescript
{
  id: string; // UUID, primary key
  createdAt: Date; // Creation timestamp
  updatedAt: Date; // Last update timestamp
  status: "draft" | "confirmed" | "processing" | "shipped" | "fulfilled" | "cancelled"; // default "draft"
  orderNumber: string; // Globally unique (required)
  referenceNumber: string | null; // External reference (e.g. customer PO number)
  orderDate: Date; // Date order was placed (required)
  expectedDeliveryDate: Date | null; // Expected delivery/completion date
  currency: string; // ISO 4217 currency code (required)
  subtotal: number; // Sum before tax/discount (decimal, 2 places)
  taxAmount: number; // Tax amount (decimal, 2 places), default 0
  discountAmount: number; // Discount amount (decimal, 2 places), default 0
  shippingAmount: number; // Shipping/freight cost (decimal, 2 places), default 0
  totalAmount: number; // Final total (decimal, 2 places)
  shippingAddress: string | null; // Delivery address (free-text)
  billingAddress: string | null; // Billing address (free-text)
  paymentTerms: string | null; // e.g. "Net 30", "Due on receipt"
  notes: string | null; // Private notes (not visible to customer)
  customerNotes: string | null; // Notes visible to the customer
}
```

## Technical Requirements

### TR-1: Database Schema

- The system SHALL store orders in an `orders` table
- The system SHALL use UUID for primary key
- The system SHALL enforce NOT NULL constraint on orderNumber, orderDate, currency, subtotal, taxAmount, discountAmount, shippingAmount, totalAmount
- The system SHALL set default value for status to "draft"
- The system SHALL set default value for taxAmount, discountAmount, shippingAmount to 0
- The system SHALL use NUMERIC(15,2) for subtotal, taxAmount, discountAmount, shippingAmount, totalAmount
- The system SHALL enforce status values using CHECK constraint
- The system SHALL create unique index on order_number
- The system SHALL create indexes on: status, order_date

### TR-2: Module Organization

- The system SHALL place all orders code in `apps/backend/src/modules/orders/`
- The system SHALL colocate tests with source files

### TR-3: API Endpoints

- All endpoints SHALL be prefixed with `/api/orders`
- The system SHALL implement five operations: Create (POST), Read (GET), Update (PATCH), Delete (DELETE), List (GET)
- The system SHALL support filtering on list endpoint by: status
- The system SHALL order list results by order date (newest first)

## Database Schema

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  order_number TEXT NOT NULL,
  reference_number TEXT,
  order_date DATE NOT NULL,
  expected_delivery_date DATE,
  currency VARCHAR(3) NOT NULL,
  subtotal NUMERIC(15,2) NOT NULL,
  tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  shipping_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(15,2) NOT NULL,
  shipping_address TEXT,
  billing_address TEXT,
  payment_terms VARCHAR(64),
  notes TEXT,
  customer_notes TEXT,
  CONSTRAINT orders_status_check CHECK (status IN ('draft', 'confirmed', 'processing', 'shipped', 'fulfilled', 'cancelled'))
);

CREATE UNIQUE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_order_date ON orders(order_date);
```

## API Specification

### API Endpoints

All endpoints are prefixed with `/api/orders`

#### Create Order

```
POST /api/orders
```

**Request Body:**

```json
{
  "orderNumber": "ORD-2024-001",
  "referenceNumber": "PO-12345",
  "orderDate": "2024-01-15",
  "expectedDeliveryDate": "2024-02-01",
  "currency": "EUR",
  "subtotal": 1400.00,
  "taxAmount": 266.00,
  "discountAmount": 50.00,
  "shippingAmount": 25.00,
  "totalAmount": 1641.00,
  "shippingAddress": "123 Main St, Berlin, Germany",
  "billingAddress": "456 Business Ave, Berlin, Germany",
  "paymentTerms": "Net 30",
  "notes": "Prioritize this order",
  "customerNotes": "Please deliver to loading dock B"
}
```

**Response (201 Created):** Returns the complete Order entity.

#### Get Order

```
GET /api/orders/:id
```

**Response (200 OK):** Returns the complete Order entity.

#### Update Order

```
PATCH /api/orders/:id
```

**Request Body:** All fields optional (partial update).

**Response (200 OK):** Returns the updated Order entity.

#### Delete Order

```
DELETE /api/orders/:id
```

**Response (200 OK):**

```json
{
  "success": true,
  "id": "order-uuid"
}
```

#### List Orders

```
GET /api/orders
```

**Query Parameters:**

- `status` (optional): Filter by status

**Response (200 OK):**

```json
{
  "orders": [{ /* Order entity */ }]
}
```

## Error Responses

- **400 Bad Request**: Validation failed
- **404 Not Found**: Order not found
- **409 Conflict**: Duplicate order number
- **500 Internal Server Error**: Unexpected error

## Testing Strategy

- All CRUD operations must be covered
- Error scenarios must be tested
- Database constraints must be validated
- Unique order number constraint must be tested

## Future Enhancements

- 🚧 Line items support
- 🚧 Pagination for list endpoint
- 🚧 Additional filters (date ranges, amounts)
- 🚧 Soft delete for audit compliance
- 🚧 Order-to-invoice conversion
