# Orders

## Overview

Orders represent customer purchases and track their progression from creation through fulfillment. This feature covers the full order lifecycle with pricing breakdowns (subtotal, tax, discounts, shipping) and address/payment metadata. The feature is exposed as an API for use by other microservices and tools.

## Goals and Non-Goals

### Goals

- Manage orders with full create, read, update, and delete capabilities
- Track order status through lifecycle

### Non-Goals

- Line items management (future enhancement)
- Order fulfillment / shipping workflows
- Inventory management
- Approval workflows

## Order Lifecycle

Orders move through six statuses:

- **Draft** — the default state for newly created orders.
- **Confirmed** — the order has been accepted and is awaiting processing.
- **Processing** — the order is being prepared or assembled.
- **Shipped** — the order has been dispatched to the customer.
- **Fulfilled** — the order has been delivered and completed.
- **Cancelled** — the order has been cancelled.

## Order Management

### Creating Orders

- Required fields: orderNumber, orderDate, currency, subtotal, totalAmount
- Status defaults to "draft" if not provided
- taxAmount, discountAmount, and shippingAmount default to 0
- orderNumber must be globally unique
- A unique identifier (UUID) is generated automatically
- Timestamps (createdAt, updatedAt) are set automatically
- The created order is returned including all generated fields

### Editing Orders

- Orders support partial updates — only provided fields are changed
- Fields not included in the update are preserved
- The updatedAt timestamp is refreshed on each update
- Updated fields are validated before persisting
- The updated order is returned with all current values

### Deleting Orders

- Orders are permanently removed from the database
- A success response is returned after deletion
- No soft-delete (see Future Enhancements)

### Listing and Filtering

- Orders can be filtered by status (exact match)
- Results are ordered by order date, newest first

### Validation Rules

- Status must be one of: draft, confirmed, processing, shipped, fulfilled, cancelled
- orderNumber must be globally unique
- orderNumber, orderDate, currency, subtotal, and totalAmount are required
- Order not found returns an appropriate error
- Duplicate order number returns a conflict error

## Data Model

### Order Entity

```typescript
{
  id: string;                          // UUID, primary key
  createdAt: Date;                     // Creation timestamp
  updatedAt: Date;                     // Last update timestamp
  status: "draft" | "confirmed" | "processing" | "shipped" | "fulfilled" | "cancelled"; // default "draft"
  orderNumber: string;                 // Globally unique (required)
  referenceNumber: string | null;      // External reference (e.g. customer PO number)
  orderDate: Date;                     // Date order was placed (required)
  expectedDeliveryDate: Date | null;   // Expected delivery/completion date
  currency: string;                    // ISO 4217 currency code (required)
  subtotal: number;                    // Sum before tax/discount (decimal, 2 places)
  taxAmount: number;                   // Tax amount (decimal, 2 places), default 0
  discountAmount: number;              // Discount amount (decimal, 2 places), default 0
  shippingAmount: number;              // Shipping/freight cost (decimal, 2 places), default 0
  totalAmount: number;                 // Final total (decimal, 2 places)
  shippingAddress: string | null;      // Delivery address (free-text)
  billingAddress: string | null;       // Billing address (free-text)
  paymentTerms: string | null;         // e.g. "Net 30", "Due on receipt"
  notes: string | null;                // Private notes (not visible to customer)
  customerNotes: string | null;        // Notes visible to the customer
}
```

## Technical Requirements

### TR-1: Database Schema

- Orders are stored in an `orders` table with UUID primary key
- NOT NULL constraint on: orderNumber, orderDate, currency, subtotal, taxAmount, discountAmount, shippingAmount, totalAmount
- Default value for status: "draft"
- Default value for taxAmount, discountAmount, shippingAmount: 0
- NUMERIC(15,2) for: subtotal, taxAmount, discountAmount, shippingAmount, totalAmount
- Status enforced via CHECK constraint
- Unique index on: orderNumber
- Indexes on: status, orderDate

### TR-2: Module Organization

- All orders code lives in `apps/backend/src/modules/orders/`
- Tests are colocated with source files

### TR-3: API Endpoints

All endpoints are prefixed with `/api/orders`.

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

#### Error Responses

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
