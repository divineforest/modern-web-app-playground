# Search Products

## Overview

The search products feature enables customers to quickly find products by entering keywords in a global search bar located in the site header. Search queries match against product names and descriptions using PostgreSQL full-text search with prefix matching (partial word search). Results are displayed on a dedicated search results page with sorting options for relevance, price, and alphabetical order.

This feature improves product discoverability for customers navigating large catalogs, complementing the existing category-based browsing on the products page. Unlike the category filter (which is coarse-grained), search provides fine-grained, keyword-based navigation.

The implementation includes both backend search API and frontend UI components (header search bar and search results page).

## Goals and Non-Goals

### Goals

- Provide a global search bar in the site header accessible from all pages
- Enable customers to search products by keywords in product name and description
- Display search results on a dedicated page with pagination
- Support sorting results by relevance, price, and product name
- Use PostgreSQL full-text search for efficient phrase matching
- Require a minimum query length to prevent performance issues from overly broad searches

### Non-Goals

- Advanced filter combinations (price range, multi-category, in-stock status) — deferred for future enhancement
- Autocomplete or search suggestions as the user types
- Search history or saved searches
- Synonyms, spelling correction, or fuzzy matching
- Faceted search (aggregate counts by category, price buckets)
- Search analytics or trending searches
- Personalized or recommended results based on user behavior
- Searching non-product entities (orders, users, content pages)

## Functional Requirements

### FR-1: Search Query Validation

- The system SHALL accept a search query as a text string.
- The system SHALL reject queries shorter than 2 characters with HTTP 400 validation error.
- The system SHALL trim leading and trailing whitespace from the query.
- The system SHALL support Unicode characters in search queries (international product names).
- The system SHALL treat special characters (e.g., @, #, &) as literal text, not operators — PostgreSQL's `to_tsquery` will handle escaping.
- The system SHALL treat the query as a prefix-match search with AND logic: each word (or partial word) in the query must match a word prefix in the searchable fields (e.g., "blue shirt" matches "blue cotton shirt", "shirt" matches "t-shirt", "lapt" matches "laptop").

### FR-2: Search Fields and Matching

- The system SHALL search within product name and description fields only.
- The system SHALL NOT search SKU, category, or tags.
- The system SHALL use PostgreSQL full-text search with prefix matching semantics (using `to_tsquery` with `:*` suffix for each word).
- The system SHALL only return products with `active` status — draft and archived products SHALL be excluded.
- The system SHALL perform case-insensitive matching.
- The system SHALL support English stemming (e.g., "running" matches "run", "runs").
- The system SHALL support partial word matching (e.g., "lapt" matches "laptop", "wirele" matches "wireless").
- The system SHALL use AND logic for multi-word queries: all words must match (in any order), not just phrases.

### FR-3: Search Results Display

- The system SHALL return matching products with the same fields as the product list endpoint: id, name, slug, sku, description, short description, category, tags, image URL, currency, price, and compare at price.
- The system SHALL paginate results (default 20 items per page, max 100).
- The system SHALL return an empty result set (zero products) when no products match the query, not an error.
- The system SHALL include pagination metadata: total count, current page, total pages.

### FR-4: Sorting Options

- The system SHALL support three sorting modes: relevance, price ascending, and price descending.
- The default sort SHALL be relevance (best match first, determined by PostgreSQL text search ranking).
- When sorting by price, the system SHALL use the `price` column directly, with a secondary sort by product name for stable ordering.
- When sorting by price, products with different currencies SHALL NOT be intermixed — results SHALL be grouped by currency (alphabetically ordered, e.g., EUR before USD).
- When the user changes the sort mode, the page number SHALL reset to 1 to avoid showing an empty page due to different result ordering.

### FR-5: Header Search Bar (Web Application)

- The site header SHALL display a search input field on all pages.
- The search bar SHALL have a placeholder: "Search products...".
- The search bar SHALL display a search icon (magnifying glass) inside the input.
- When the user submits the search (Enter key or click search icon), the browser SHALL navigate to `/search?q=<query>&sort=relevance&page=1`.
- The system SHALL NOT perform search API calls while the user is typing (no autocomplete).
- When on the search results page, the search input SHALL display the current search query (read from the `q` URL parameter) so users can see what they searched for and easily modify it.
- When navigating away from the search results page, the search bar SHALL clear to empty.

### FR-6: Search Results Page (Web Application)

- The search results page SHALL be located at `/search`.
- The search results page SHALL read the `q` query parameter from the URL and display results for that query.
- The page SHALL read the optional `sort` query parameter (values: `relevance`, `price_asc`, `price_desc`) and default to `relevance`.
- The page SHALL display the search query prominently at the top (e.g., "Search results for: blue shirt").
- The page SHALL display a count of total results (e.g., "24 results found").
- The page SHALL reuse the product card grid layout from the products page.
- The page SHALL display an empty state with a message when no results are found: "No products match your search. Try different keywords."
- The page SHALL display sorting controls (dropdown or buttons) to switch between relevance, price low-high, and price high-low.
- The page SHALL display validation feedback when the query is too short (below 2 characters).
- The page SHALL include pagination controls when results exceed one page.

### FR-7: Empty Query Handling

- If the user navigates to `/search` with no `q` parameter (or an empty query), the page SHALL display an empty state with instructions: "Enter a search query to find products."
- The API SHALL reject requests with missing or empty queries with HTTP 400 validation error.

## Technical Requirements

### TR-1: Database Full-Text Search Index

- The products table SHALL add a generated `search_vector` column of type `tsvector` for full-text search.
- The `search_vector` column SHALL be computed from a concatenation of the product name (weight A, highest relevance) and description (weight B, medium relevance).
- The system SHALL create a GIN index on `search_vector` to enable fast text search queries.
- The `search_vector` column SHALL update automatically on product insertion or update via a database trigger or application-level logic.
- The system SHALL use PostgreSQL `to_tsquery` with prefix matching (`:*` suffix appended to each word) for partial word matching.
- The system SHALL use English text search configuration (`'english'`) for stemming and stop word handling.
- The query transformation SHALL split the user's input into words, escape special characters, append `:*` to each word for prefix matching, and join with `&` (AND operator) to require all words to match.

### TR-2: Search API Design

- The search endpoint SHALL be `GET /api/products/search`.
- The endpoint SHALL accept query parameters: `q` (query string, required, min 2 chars), `sort` (enum: `relevance`, `price_asc`, `price_desc`, default `relevance`), `page` (int, default 1), `limit` (int, default 20, max 100).
- The endpoint SHALL be public (no authentication required).
- The endpoint SHALL return the same product response schema as the list endpoint for consistency.
- The API contract SHALL be defined via ts-rest and added to the products contract.

### TR-3: Search Service Implementation

- The products service SHALL implement a `search` method that accepts query, sort, page, and limit parameters.
- When sorting by relevance, the system SHALL use PostgreSQL `ts_rank` to order results by match quality (descending).
- When sorting by price, the system SHALL order by `currency ASC, price ASC/DESC, name ASC` to group currencies alphabetically and provide stable ordering within each currency group.
- The search query SHALL filter by `status = 'active'` to exclude draft and archived products.
- The system SHALL return paginated results with metadata (total count, current page, total pages).
- The system SHALL use parameterized queries to prevent SQL injection, passing the user query through `phraseto_tsquery` safely.

### TR-4: Search Results Page Routing

- The web application router SHALL add a new route: `/search` mapped to the Search Results page component.
- The Search Results page SHALL parse query parameters from the URL (`q`, `sort`, `page`).
- The Search Results page SHALL validate the query client-side (minimum 2 characters) before making an API call.
- The Search Results page SHALL construct the API request: `GET /api/products/search?q=<query>&sort=<sort>&page=<page>&limit=20`.
- When the user changes the sort mode, the page SHALL update the URL to `/search?q=<query>&sort=<newSort>&page=1` (reset to page 1) to prevent displaying an empty page due to reordering.

### TR-5: Header Search Bar Component

- The site header component SHALL add a search form with a text input and submit button.
- On submit, the form SHALL navigate to `/search?q=<query>&sort=relevance` using React Router navigation.
- The search input SHALL be accessible (proper labels, keyboard navigation).
- The search bar SHALL remain visible on all pages, including the search results page itself.

## Data Flow

### User Searches for a Product

1. **Customer** enters a search query (e.g., "blue shirt") in the header search bar and presses Enter.
2. **Search bar component** validates the query length (minimum 2 characters). If invalid, it displays inline validation feedback and does not navigate.
3. **Browser** navigates to `/search?q=blue%20shirt&sort=relevance`.
4. **Search results page** renders, extracts the `q` parameter from the URL, and initiates an API request: `GET /api/products/search?q=blue shirt&sort=relevance&page=1&limit=20`.
5. **Search API handler** validates the query via the ts-rest contract (minimum 2 characters).
6. **Products service** converts the query to a PostgreSQL prefix search query by splitting "blue shirt" into words, appending `:*` to each, and joining with `&`: `to_tsquery('english', 'blue:* & shirt:*')`.
7. **Products service** queries the database: `SELECT * FROM products WHERE status = 'active' AND search_vector @@ to_tsquery('english', 'blue:* & shirt:*') ORDER BY ts_rank(search_vector, query) DESC LIMIT 20 OFFSET 0`.
8. **Database** returns matching rows using the GIN index on `search_vector`.
9. **Products service** returns paginated results with total count.
10. **Search API handler** responds with HTTP 200 and the product list.
11. **Search results page** renders the product grid with the matching products.

### User Changes Sort Order

1. **Customer** clicks the "Price: Low to High" sorting option on the search results page.
2. **Search results page** updates the URL to `/search?q=blue%20shirt&sort=price_asc&page=1`.
3. **Search results page** re-fetches results from the API with the new sort parameter.
4. **Products service** queries the database with `ORDER BY price ASC, name ASC` instead of relevance ranking.
5. **Search results page** re-renders with the newly sorted results.

### User Searches from Search Results Page

1. **Customer** is on the search results page viewing results for "blue shirt".
2. **Customer** enters a new query "red jacket" in the still-visible header search bar and submits.
3. **Browser** navigates to `/search?q=red%20jacket&sort=relevance`, replacing the previous search.
4. Steps 4–11 from "User Searches for a Product" execute for the new query.

## Error Scenarios

| Scenario | Response |
|----------|----------|
| Query shorter than 2 characters | HTTP 400 — "Search query must be at least 2 characters" |
| Query parameter missing or empty | HTTP 400 — validation error |
| Invalid sort parameter | HTTP 400 — validation error |
| No products match query | HTTP 200 with empty results array and total count 0 |
| Database full-text search fails | HTTP 500 — "Internal server error" (log full error) |
| Invalid pagination parameters (page < 1, limit > 100) | HTTP 400 — validation error |

## Security Considerations

- Search queries SHALL be treated as untrusted input and validated at the API contract level via Zod schemas.
- The system SHALL sanitize query input to prevent SQL injection, though using parameterized queries with `phraseto_tsquery` inherently prevents this.
- Rate limiting MAY be applied to search endpoints to prevent abuse or scraping (not required for initial implementation).
- Search SHALL NOT expose draft or archived products to unauthorized users.

## Monitoring and Observability

- 🚧 Track search query volume, average search latency, and zero-result rate (queries with no matches).
- Log slow search queries (> 500ms) with the query text and result count for performance analysis.
- 🚧 Alert on search endpoint error rate exceeding 2 percent over 10 minutes.
- 🚧 Monitor GIN index size and query plan performance to detect when re-indexing is needed.

## Testing and Validation

### Unit Tests

- Search service: prefix matching with AND logic ("blue shirt" finds products with both "blue" and "shirt" in any order)
- Search service: partial word matching ("lapt" finds "laptop", "wirele" finds "wireless")
- Search service: stemming support ("running shoes" matches products with "run" or "runner")
- Search service: case-insensitive matching ("Blue" matches "blue")
- Search service: active products only (draft and archived excluded)
- Search service: sorting by relevance, price ascending, price descending
- Search service: pagination (offset, limit)
- Search service: minimum query length enforcement
- Search service: single word partial match ("shirt" finds "t-shirt", "polo shirt", "blue shirt")

### Integration Tests

- Full API flow: `GET /api/products/search?q=test&sort=relevance` returns paginated results
- Edge cases: query too short (HTTP 400), no results (HTTP 200 with empty array), invalid sort (HTTP 400)
- Unicode query support: search with non-ASCII characters (e.g., "café")

### End-to-End Tests (Web Application)

- Header search bar is visible on all pages
- Entering a query and submitting navigates to `/search?q=<query>&sort=relevance`
- Search results page displays matching products in a grid
- Search results page displays "No products match your search" when no results
- Search results page displays validation error when query is too short
- Sorting controls update the URL and re-fetch results
- Pagination controls navigate between result pages
- Empty query on `/search` shows empty state with instructions

### Manual QA Checklist

- Search for a known product name → verify it appears in results
- Search for a partial word (e.g., "lapt" for "laptop") → verify prefix matching works
- Search for multiple keywords (e.g., "blue shirt") → verify AND logic (both words required)
- Search with query length 1 character → verify validation error
- Sort by price → verify ascending and descending order
- Navigate through multiple pages of results → verify pagination consistency
- Search from products page → verify header search works
- Search from search results page → verify new search replaces old results

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Search performance degrades with large catalogs | Slow response times, poor UX | GIN index on `search_vector`; monitor query latency; consider caching popular queries |
| English stemming doesn't match product language | Poor search quality for non-English products | Use English configuration initially; 🚧 support multi-language search configs in the future |
| Prefix matching with short queries returns too many results | Overwhelming result sets, poor UX | Enforce minimum query length (2 characters); sort by relevance to surface best matches first |
| Search vector not updated after product edit | Stale search results | Ensure `search_vector` is regenerated on product update via trigger or application logic |
| High search volume impacts database | Database CPU/memory pressure | Monitor query load; consider read replica for search queries if needed |

## Security Considerations

- Search queries SHALL be validated at the API contract level (Zod schema) to enforce minimum length and type constraints.
- The system SHALL use parameterized queries and PostgreSQL's built-in `to_tsquery` to prevent SQL injection.
- Search SHALL NOT return draft or archived products, preventing information leakage.
- Rate limiting MAY be added to the search endpoint to prevent scraping or abuse (not required for initial implementation, but consider if abuse is observed).

## Database Schema Changes

### TR-6: Full-Text Search Column

- The products table SHALL add a `search_vector` column of type `tsvector`.
- The system SHALL create a GIN index named `idx_products_search_vector` on the `search_vector` column.
- The `search_vector` column SHALL be computed as:
  ```sql
  setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ```
  where weight A (name) has higher relevance than weight B (description) in ranking.
- The system SHALL use a PostgreSQL trigger (`BEFORE INSERT OR UPDATE`) to automatically regenerate `search_vector` whenever a product's name or description changes. This ensures consistency without relying on application-level logic.
- The migration SHALL backfill `search_vector` for all existing products using an `UPDATE` statement.

## API Contract

### Search Endpoint

**Endpoint:** `GET /api/products/search`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| q | string | Yes | Search query (minimum 2 characters) |
| sort | enum | No | Sort mode: `relevance` (default), `price_asc`, `price_desc` |
| page | integer | No | Page number (default 1, minimum 1) |
| limit | integer | No | Results per page (default 20, min 1, max 100) |

**Response (HTTP 200):**

```json
{
  "products": [
    {
      "id": "uuid",
      "name": "Blue Cotton Shirt",
      "slug": "blue-cotton-shirt",
      "sku": "SKU-12345",
      "description": "A comfortable blue shirt made from 100% cotton",
      "shortDescription": "Comfortable cotton shirt",
      "category": "Clothing",
      "tags": ["men", "casual"],
      "imageUrl": "https://...",
      "currency": "USD",
      "price": "29.99",
      "compareAtPrice": "39.99",
      "status": "active",
      "createdAt": "2026-03-01T12:00:00Z",
      "updatedAt": "2026-03-05T14:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalCount": 42,
    "totalPages": 3
  }
}
```

**Error Responses:**

- HTTP 400: Query too short, invalid sort parameter, invalid pagination
- HTTP 500: Internal server error

## Frontend UI Components

### Header Search Bar

- Location: Site header (RootLayout component), visible on all pages
- Layout: Horizontal form with text input and search icon button
- Behavior: On submit, navigate to `/search?q=<query>&sort=relevance`
- Validation: Client-side minimum 2-character check before submit (display inline error if too short)
- Styling: Integrate with existing header design (MUI components)
- Accessibility: Proper labels, keyboard navigation support

### Search Results Page

- Route: `/search`
- Layout: Search query display → result count → sorting controls → product grid → pagination
- Query display: "Search results for: <query>" (heading)
- Result count: "<totalCount> results found" (subheading)
- Sorting controls: Dropdown or button group with options: "Relevance", "Price: Low to High", "Price: High to Low"
- Product grid: Reuse the same responsive grid layout from products page
- Pagination: MUI Pagination component at the bottom (same as products page)
- Empty state: When no results, display message + suggestion to try different keywords
- Loading state: CircularProgress spinner while API request is in flight
- Error state: Alert component for API errors
- Validation state: Alert component when query is too short

## Monitoring and Observability

- 🚧 Track search query rate, average query latency, and p95/p99 latency.
- Log search queries with zero results to identify gaps in the product catalog or search quality issues.
- Log slow search queries (> 500ms response time) for performance investigation.
- 🚧 Create a dashboard showing: query volume over time, zero-result rate, most searched terms, and search latency distribution.
- 🚧 Alert when search endpoint error rate exceeds 2 percent over a 10-minute window.
- 🚧 Alert when search latency p95 exceeds 1 second.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Search performance degrades as catalog grows | Slow queries, poor UX | GIN index on `search_vector`; monitor latency; 🚧 consider caching frequent queries |
| Prefix matching with short queries returns too many results | Poor user experience, overwhelming results | Enforce minimum query length (2 characters); sort by relevance to surface best matches first; 🚧 consider minimum 3 characters if needed |
| `search_vector` becomes stale after product edits | Customers see outdated results | Ensure regeneration via trigger or ORM hook; validate in tests |
| English stemming doesn't work for non-English products | Search quality issues in international catalogs | Use English config initially; 🚧 add multi-language support if product catalog expands internationally |
| High search volume causes database load | DB CPU exhaustion, slow response for all queries | Monitor query load; 🚧 consider offloading search to read replica |
| Customers expect autocomplete/suggestions | Reduced engagement compared to competitors | Ship basic search first; 🚧 gather usage data and add autocomplete in future iteration |

