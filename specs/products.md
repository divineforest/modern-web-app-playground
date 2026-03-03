# Products

## Overview

This feature provides CRUD operations for managing the product catalog. Products represent the goods available for sale and include pricing, inventory, categorization, and physical attributes. The feature is exposed as an API for use by other microservices and tools.

## Goals and Non-Goals

### Goals

- Provide CRUD operations for product management
- Support product lifecycle through statuses (draft, active, archived)
- Support pricing with compare-at price for sales/promotions
- Display all available products on the home page

### Non-Goals

- Inventory management (stock tracking, warehouses, stock movements)
- Product variants (e.g. size, color) — future enhancement
- Full media/image management (galleries, multiple images per product)
- Product bundles or kits
- Product reviews and ratings
- Search with full-text or faceted filtering

## Functional Requirements

### FR-1: Create Product

- The system SHALL accept product creation requests via API
- The system SHALL validate required fields (name, sku, price, currency)
- The system SHALL validate status field against allowed values (draft, active, archived)
- The system SHALL set default status to "draft" if not provided
- The system SHALL validate that SKU is globally unique
- The system SHALL generate a unique identifier for each product
- The system SHALL store products with timestamps (createdAt, updatedAt)
- The system SHALL return the created product including generated fields

### FR-2: Read Product

- The system SHALL retrieve a single product by its unique identifier
- The system SHALL return complete product data including all fields
- The system SHALL return appropriate error when product is not found

### FR-3: Update Product

- The system SHALL accept partial updates to existing products
- The system SHALL validate updated fields before persisting changes
- The system SHALL update the updatedAt timestamp on successful update
- The system SHALL preserve fields not included in the update request
- The system SHALL return the updated product with all current values
- The system SHALL return appropriate error when product is not found

### FR-4: Delete Product

- The system SHALL delete products permanently from the database
- The system SHALL return success response after successful deletion
- The system SHALL return appropriate error when product is not found

### FR-5: List Products

- The system SHALL retrieve multiple products
- The system SHALL support filtering by:
  - status (exact match)
  - category (exact match)
- The system SHALL return products ordered by creation date (newest first)

### FR-6: Product Catalog (Home Page)

- The home page SHALL fetch and display all products with status "active"
- Each product card SHALL display: name, price, image, and short description
- If a product has no imageUrl, the card SHALL display a generic placeholder image from `apps/web/src/assets/no-photo.svg`
- If a product has a compareAtPrice, the card SHALL display it as a crossed-out original price next to the current price
- Products SHALL be displayed in a responsive grid of equal-size cards (equal width and height)
- Product name and short description SHALL be truncated with ellipsis if they exceed available space
- While products are loading, the page SHALL display a loading indicator
- If no active products exist, the page SHALL display an empty state message

## Data Model

### Product Entity

```typescript
{
  id: string; // UUID, primary key
  createdAt: Date; // Creation timestamp
  updatedAt: Date; // Last update timestamp
  status: "draft" | "active" | "archived"; // default "draft"
  name: string; // Product name (required)
  slug: string; // URL-friendly identifier, auto-generated from name, globally unique
  sku: string; // Stock Keeping Unit, globally unique (required)
  description: string | null; // Full product description
  shortDescription: string | null; // Brief summary for listings
  category: string | null; // Product category (free-text)
  tags: string[] | null; // Tags for organization/filtering
  imageUrl: string | null; // URL to the product image
  currency: string; // ISO 4217 currency code (required)
  price: number; // Selling price (decimal, 2 places, required)
  compareAtPrice: number | null; // Original/list price for showing discounts (decimal, 2 places)
  costPrice: number | null; // Cost to acquire/produce (decimal, 2 places), not exposed publicly
  weight: number | null; // Weight in grams (decimal, 2 places)
  width: number | null; // Width in cm (decimal, 2 places)
  height: number | null; // Height in cm (decimal, 2 places)
  length: number | null; // Length in cm (decimal, 2 places)
}
```

## Technical Requirements

### TR-1: Database Schema

- The system SHALL store products in a `products` table
- The system SHALL use UUID for primary key
- The system SHALL enforce NOT NULL constraint on name, slug, sku, currency, price
- The system SHALL set default value for status to "draft"
- The system SHALL use NUMERIC(15,2) for price, compareAtPrice, costPrice, weight, width, height, length
- The system SHALL store tags as a JSON array
- The system SHALL enforce status values using CHECK constraint
- The system SHALL create unique index on sku
- The system SHALL create unique index on slug
- The system SHALL create indexes on: status, category

### TR-2: Module Organization

- The system SHALL place all products code in `apps/backend/src/modules/products/`
- The system SHALL colocate tests with source files

### TR-3: Web Application

- The product catalog SHALL be implemented in `apps/web/`
- The web app SHALL fetch products from the backend API

### TR-4: API Endpoints

- All endpoints SHALL be prefixed with `/api/products`
- The system SHALL implement five operations: Create (POST), Read (GET), Update (PATCH), Delete (DELETE), List (GET)
- The system SHALL support filtering on list endpoint by: status, category
- The system SHALL order list results by creation date (newest first)

## Database Schema

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  sku TEXT NOT NULL,
  description TEXT,
  short_description TEXT,
  category TEXT,
  tags JSONB,
  image_url TEXT,
  currency VARCHAR(3) NOT NULL,
  price NUMERIC(15,2) NOT NULL,
  compare_at_price NUMERIC(15,2),
  cost_price NUMERIC(15,2),
  weight NUMERIC(15,2),
  width NUMERIC(15,2),
  height NUMERIC(15,2),
  length NUMERIC(15,2),
  CONSTRAINT products_status_check CHECK (status IN ('draft', 'active', 'archived'))
);

CREATE UNIQUE INDEX idx_products_sku ON products(sku);
CREATE UNIQUE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_category ON products(category);
```

## API Specification

### API Endpoints

All endpoints are prefixed with `/api/products`

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

**Response (200 OK):**

```json
{
  "products": [{ /* Product entity */ }]
}
```

## Error Responses

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

## Future Enhancements

- 🚧 Product variants (size, color, material)
- 🚧 Multiple images per product (gallery)
- 🚧 Pagination for list endpoint
- 🚧 Additional filters (price range, tags)
- 🚧 Full-text search
- 🚧 Soft delete for audit compliance
- 🚧 Bulk import/export
- 🚧 Product-to-order line item association
