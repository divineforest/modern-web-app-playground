# Products

## Overview

Products are the goods available for sale in the Mercado catalog. This feature covers the full product lifecycle — from creation as a draft, through activation for customer visibility, to archival. It includes pricing (with promotional compare-at prices), categorization, physical attributes, and a storefront catalog for browsing. The feature is exposed as an API for use by other microservices and tools.

## Goals and Non-Goals

### Goals

- Manage the product catalog with full create, read, update, and delete capabilities
- Support product lifecycle through statuses (draft, active, archived)
- Support pricing with compare-at price for sales and promotions
- Display all available products on the home page

### Non-Goals

- Inventory management (stock tracking, warehouses, stock movements)
- Product variants (e.g. size, color) — future enhancement
- Full media/image management (galleries, multiple images per product)
- Product bundles or kits
- Product reviews and ratings
- Search with full-text or faceted filtering

## Product Lifecycle

Products move through three statuses:

- **Draft** — the default state for newly created products. Not visible to customers.
- **Active** — visible in the storefront catalog and available for purchase.
- **Archived** — removed from the storefront but retained in the system.

## Product Catalog (Storefront)

The home page displays active products as a paginated catalog:

- Only products with status "active" are shown
- Each product card displays: name, price, image, and short description
- If a product has no image, a generic placeholder is shown from `apps/web/src/assets/no-photo.svg`
- If a product has a compare-at price, it is displayed as a crossed-out original price next to the current price
- Products are displayed in a responsive grid of equal-size cards (equal width and height)
- Product name and short description are truncated with ellipsis if they exceed available space
- While products are loading, a loading indicator is displayed
- If no active products exist, an empty state message is displayed
- Pagination controls are displayed below the product grid when there are multiple pages
- The current page number and total pages are visible to the user

## Product Management

### Creating Products

- Required fields: name, SKU, price, currency
- Status defaults to "draft" if not provided
- A URL-friendly slug is auto-generated from the product name
- SKU and slug must be globally unique
- A unique identifier (UUID) is generated automatically
- Timestamps (createdAt, updatedAt) are set automatically
- The created product is returned including all generated fields

### Editing Products

- Products support partial updates — only provided fields are changed
- Fields not included in the update are preserved
- The updatedAt timestamp is refreshed on each update
- Updated fields are validated before persisting
- The updated product is returned with all current values

### Deleting Products

- Products are permanently removed from the database
- A success response is returned after deletion
- No soft-delete (see Future Enhancements)

### Listing and Filtering

- Products can be filtered by status (exact match) and category (exact match)
- Results are ordered by creation date, newest first
- Results are paginated with a default page size of 20 and a maximum page size of 100
- The response includes the total count of matching products and pagination metadata

### Validation Rules

- Status must be one of: draft, active, archived
- SKU must be globally unique
- Slug must be globally unique
- Name, SKU, price, and currency are required
- Product not found returns an appropriate error
- Duplicate SKU or slug returns a conflict error

## Data Model

### Product Entity

```typescript
{
  id: string;               // UUID, primary key
  createdAt: Date;          // Creation timestamp
  updatedAt: Date;          // Last update timestamp
  status: "draft" | "active" | "archived"; // default "draft"
  name: string;             // Product name (required)
  slug: string;             // URL-friendly identifier, auto-generated from name, globally unique
  sku: string;              // Stock Keeping Unit, globally unique (required)
  description: string | null;       // Full product description
  shortDescription: string | null;  // Brief summary for listings
  category: string | null;          // Product category (free-text)
  tags: string[] | null;            // Tags for organization/filtering
  imageUrl: string | null;          // URL to the product image
  currency: string;         // ISO 4217 currency code (required)
  price: number;            // Selling price (decimal, 2 places, required)
  compareAtPrice: number | null;    // Original/list price for showing discounts (decimal, 2 places)
  costPrice: number | null;         // Cost to acquire/produce (decimal, 2 places), not exposed publicly
  weight: number | null;            // Weight in grams (decimal, 2 places)
  width: number | null;             // Width in cm (decimal, 2 places)
  height: number | null;            // Height in cm (decimal, 2 places)
  length: number | null;            // Length in cm (decimal, 2 places)
}
```

## Technical Requirements

### TR-1: Database Schema

- Products are stored in a `products` table with UUID primary key
- NOT NULL constraint on: name, slug, sku, currency, price
- Default value for status: "draft"
- NUMERIC(15,2) for: price, compareAtPrice, costPrice, weight, width, height, length
- Tags stored as a JSON array
- Status enforced via CHECK constraint
- Unique indexes on: sku, slug
- Indexes on: status, category

### TR-2: Module Organization

- All products code lives in `apps/backend/src/modules/products/`
- Tests are colocated with source files

### TR-3: Web Application

- The product catalog is implemented in `apps/web/`
- The web app fetches products from the backend API

### TR-4: API Endpoints

All endpoints are prefixed with `/api/products`.

#### Create Product

```
POST /api/products
```

**Request Body:**

```json
{
  "name": "Wireless Bluetooth Headphones",
  "sku": "WBH-PRO-100",
  "description": "Premium wireless headphones with active noise cancellation.",
  "shortDescription": "ANC wireless headphones",
  "category": "Electronics",
  "tags": ["audio", "wireless", "headphones"],
  "imageUrl": "https://example.com/images/wbh-pro-100.jpg",
  "currency": "EUR",
  "price": 149.99,
  "compareAtPrice": 199.99,
  "costPrice": 62.50,
  "weight": 320.00,
  "width": 18.50,
  "height": 20.00,
  "length": 8.00
}
```

**Response (201 Created):** Returns the complete Product entity (including generated `id`, `slug`, `createdAt`, `updatedAt`, `status`).

#### Get Product

```
GET /api/products/:id
```

**Response (200 OK):** Returns the complete Product entity.

#### Update Product

```
PATCH /api/products/:id
```

**Request Body:** All fields optional (partial update).

**Response (200 OK):** Returns the updated Product entity.

#### Delete Product

```
DELETE /api/products/:id
```

**Response (200 OK):**

```json
{
  "success": true,
  "id": "product-uuid"
}
```

#### List Products

```
GET /api/products
```

**Query Parameters:**

- `status` (optional): Filter by status
- `category` (optional): Filter by category
- `page` (optional): Page number, starting from 1 (default: 1)
- `limit` (optional): Number of items per page, 1–100 (default: 20)

**Response (200 OK):**

```json
{
  "products": [{ /* Product entity */ }],
  "pagination": {
    "total": 85,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

#### Error Responses

- **400 Bad Request**: Validation failed
- **404 Not Found**: Product not found
- **409 Conflict**: Duplicate SKU or slug
- **500 Internal Server Error**: Unexpected error

## Testing Strategy

- All CRUD operations must be covered
- Error scenarios must be tested
- Database constraints must be validated
- Unique SKU constraint must be tested
- Unique slug constraint must be tested
- Slug auto-generation from name must be tested
- Pagination defaults, boundaries, and metadata must be tested

## Future Enhancements

- 🚧 Product variants (size, color, material)
- 🚧 Multiple images per product (gallery)
- 🚧 Additional filters (price range, tags)
- 🚧 Full-text search
- 🚧 Soft delete for audit compliance
- 🚧 Bulk import/export
- 🚧 Product-to-order line item association
