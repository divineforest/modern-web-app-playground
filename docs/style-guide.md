# Visual Redesign — Warm Premium Theme

## Overview

This spec describes a full visual redesign of the Mercado web app. The goal is to transform the current generic blue MUI interface into a warm, sophisticated, premium-feeling e-commerce storefront. The aesthetic target is "Apple Store meets Stripe" — generous whitespace, warm undertones, refined typography, and purposeful micro-interactions.

This is a **visual-only** redesign. No functional behavior, routing, data fetching, or component structure changes. All `data-testid` attributes are preserved.

## Goals and Non-Goals

### Goals

- Replace the cold corporate blue palette with a warm indigo/violet primary and stone-based neutrals
- Add signature visual touches: gradient text logo, gradient accent bars, refined shadow system
- Polish every page: products, product detail, cart, checkout, auth, orders, order confirmation
- Improve micro-interactions: smoother transitions, refined hover states, purchase zone emphasis
- Upgrade global CSS: custom scrollbar, font smoothing, warm selection colors

### Non-Goals

- Adding new pages, components, or routes
- Changing business logic, data fetching, or form validation
- Adding external animation libraries
- Dark mode (future consideration)
- Changing the font family (Inter stays)

## Design Direction

**Mood**: Clean, warm, sophisticated. Not cold corporate. Not playful/casual.

**References**: Apple Store product pages (whitespace, typography hierarchy), Stripe Dashboard (refined components, subtle depth), Linear (smooth transitions, purposeful color).

---

## Color Palette

### Primary — Deep Indigo
| Token | Hex | Usage |
|-------|-----|-------|
| `primary.main` | `#4F46E5` | Buttons, links, active states, logo gradient start |
| `primary.light` | `#818CF8` | Hover tints, secondary accents |
| `primary.dark` | `#3730A3` | Active/pressed states, text on light primary bg |

### Secondary — Warm Rose
| Token | Hex | Usage |
|-------|-----|-------|
| `secondary.main` | `#E11D48` | Cart badge, sale indicators, urgency accents |
| `secondary.light` | `#FB7185` | Hover states |
| `secondary.dark` | `#BE123C` | Active states |

### Backgrounds
| Token | Hex | Note |
|-------|-----|------|
| `background.default` | `#FAFAF9` | Stone 50 — warm off-white (not blue-tinted) |
| `background.paper` | `#FFFFFF` | Cards, papers, modals |

### Text
| Token | Hex | Note |
|-------|-----|------|
| `text.primary` | `#1C1917` | Stone 900 — warm near-black |
| `text.secondary` | `#78716C` | Stone 500 — warm gray |

### Semantic
| Token | Hex |
|-------|-----|
| `error.main` | `#DC2626` |
| `warning.main` | `#D97706` |
| `info.main` | `#0284C7` |
| `success.main` | `#059669` |

### Divider
`#E7E5E4` (Stone 300 — warm, subtle)

### Surface Colors (used in `sx` props)
| Color | Hex | Usage |
|-------|-----|-------|
| Image placeholder | `#F5F5F4` | Stone 100 — product image backgrounds |
| Input background | `#FAFAF9` | Stone 50 |
| Input hover bg | `#F5F5F4` | Stone 100 |
| Indigo tint | `#EEF2FF` | Indigo 50 — chip bg, hover tints, icon button hover |
| Caption | `#A8A29E` | Stone 400 |
| Border subtle | `#D6D3D1` | Stone 300 — outlined button borders, input borders |

---

## Typography

Inter font stays. Refinements for premium feel:

| Variant | Size | Weight | Letter Spacing | Notes |
|---------|------|--------|----------------|-------|
| h1 | 2.75rem | 700 | -0.035em | Reduced from 800; slightly larger |
| h2 | 2.125rem | 700 | -0.025em | |
| h3 | 1.75rem | 600 | -0.02em | Reduced weight for elegance |
| h4 | 1.5rem | 600 | -0.015em | |
| h5 | 1.25rem | 600 | -0.01em | |
| h6 | 1.0625rem | 600 | -0.005em | Slightly smaller; used heavily in cards |
| body1 | 0.9375rem | 400 | 0.01em | Added positive spacing for readability |
| body2 | 0.875rem | 400 | 0.01em | |
| subtitle2 | 0.75rem | 600 | 0.06em | Uppercase label style for section headers |
| button | — | 600 | 0.02em | |
| caption | — | — | 0.02em | Color: `#A8A29E` |

---

## Signature Design Details

### 1. Gradient Text for Brand
The "Mercado" logo and "Order Confirmed!" heading use CSS gradient text:
```css
background: linear-gradient(135deg, #4F46E5, #7C3AED);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
```

### 2. Warm Shadow System
All shadows use warm `rgba(28, 25, 23, ...)` instead of cold `rgba(0, 0, 0, ...)`. Button hover shadows use brand-tinted `rgba(79, 70, 229, 0.35)`.

### 3. Gradient Accent Bars
Key surfaces (cart summary, checkout order summary, order confirmation) get a 3px gradient top border:
```css
borderTop: '3px solid',
borderImage: 'linear-gradient(135deg, #4F46E5, #7C3AED) 1'
```

### 4. Smooth Cubic-Bezier Transitions
All transitions use `cubic-bezier(0.4, 0, 0.2, 1)` instead of basic `ease`. Cards: 0.25s, buttons: 0.2s.

### 5. Purchase Zone
On product detail, the quantity selector + add-to-cart button are visually grouped in a warm background zone (`#F5F5F4`) with the CTA button using gradient background: `linear-gradient(135deg, #4F46E5, #4338CA)`.

---

## Component Override Changes (theme.ts)

### MuiButton
- Padding: `10px 22px` (from `8px 20px`)
- Contained shadow: brand-tinted `rgba(79, 70, 229, 0.15)`
- Contained hover shadow: `rgba(79, 70, 229, 0.35)`, `translateY(-1px)`
- Outlined: `borderWidth: 1.5`, border color `#D6D3D1`
- Large: `14px 32px`, borderRadius 12
- All transitions: `cubic-bezier(0.4, 0, 0.2, 1)` at 0.2s

### MuiCard
- Hover: `translateY(-2px)` (from -4px, more subtle)
- Shadows: warm-toned `rgba(28, 25, 23, ...)`
- Border: `1px solid #E7E5E4`

### MuiPaper
- `elevation1`: adds `border: 1px solid #E7E5E4`
- Shadows: warm-toned

### MuiTextField
- Background: `#FAFAF9`, hover: `#F5F5F4`
- Focused border: `#4F46E5`
- Border color: `#D6D3D1`

### MuiChip
- Filled color variants with tinted backgrounds (indigo 50, emerald 50, amber 50, etc.)

### MuiAccordion (new)
- Rounded 16px, no default divider (`&:before: display: none`)
- Border: `1px solid #E7E5E4`
- Expanded: enhanced shadow, left accent bar

### MuiBadge
- Badge background: `linear-gradient(135deg, #E11D48, #BE123C)` (rose gradient)

### MuiAlert
- Added `border: 1px solid` with tinted border colors per severity

### MuiCheckbox (new)
- Unchecked: `#A8A29E`, checked: `#4F46E5`

### MuiLink (new)
- Color: `#4F46E5`, underline: `rgba(79, 70, 229, 0.3)`

---

## Page-Specific Changes

### Header (root-layout.tsx)
- Glass effect: `rgba(250, 250, 249, 0.85)`, blur `20px` (from 12px)
- Height: 72px (from 64px)
- Logo: gradient text (`#4F46E5` → `#7C3AED`)
- User pill: `bgcolor: #F5F5F4`, `borderColor: #E7E5E4`
- Border: softer `rgba(231, 229, 228, 0.6)`

### Products Page
- Cards: `height: 'auto'`, `minHeight: 340` (from fixed 360)
- Image placeholder: `#F5F5F4`
- Price: currency symbol and fraction in `text.secondary` color

### Product Detail Page
- Image: `borderRadius: 3` (24px), border `1px solid #E7E5E4`
- Purchase zone: warm bg `#F5F5F4`, `p: 3`, `borderRadius: 3`
- CTA button: gradient `linear-gradient(135deg, #4F46E5, #4338CA)`

### Cart Page
- Item cards: disable hover transform (non-clickable)
- Summary panel: gradient accent bar at top
- Checkout CTA: gradient background
- Empty state: circular icon background in `#EEF2FF`

### Checkout Page
- Shipping Paper: `borderTop: 3px solid #4F46E5`
- Billing Paper: `borderTop: 3px solid #818CF8`
- Order summary: gradient accent bar, gradient Place Order button

### Login / Register Pages
- Wrapper: `background: radial-gradient(ellipse at top, #EEF2FF 0%, #FAFAF9 70%)`
- Paper: `p: 5`, elevated shadow
- Headings: "Welcome back" / "Create your account"

### Order Confirmation
- Check icon: 80px in a 96px circular bg `linear-gradient(135deg, #ECFDF5, #D1FAE5)`
- "Order Confirmed!" heading: gradient text
- Order Paper: gradient accent bar

### Orders Page
- Accordion: theme handles styling
- Expanded: `borderLeft: 3px solid #4F46E5`
- Item cards: disable hover transforms

---

## Global CSS (index.css)

- Selection: `background: #E0E7FF`, `color: #3730A3` (indigo-tinted)
- Font smoothing: `-webkit-font-smoothing: antialiased`
- Custom scrollbar: 8px width, `#D6D3D1` thumb, rounded
- `scroll-behavior: smooth`

---

## data-testid Preservation Checklist

| Attribute | File |
|-----------|------|
| `product-card` | products.tsx, search-results.tsx |
| `quantity-input` | product-detail.tsx |
| `add-to-cart-button` | product-detail.tsx |
| `cart-item` | cart.tsx |
| `cart-item-quantity` | cart.tsx |

---

## Implementation Order

1. `theme.ts` — Foundation (palette, typography, all component overrides)
2. `index.css` — Global CSS (scrollbar, selection, font smoothing)
3. `root-layout.tsx` — Header (gradient logo, glass effect, spacing)
4. `login.tsx` + `register.tsx` — Auth pages (gradient bg, refined form)
5. `products.tsx` + `search-results.tsx` — Product cards (warm colors, flexible height)
6. `product-detail.tsx` — Purchase zone, gradient CTA, image polish
7. `cart.tsx` — Item styling, summary accent, gradient CTA
8. `checkout.tsx` — Form section accents, summary accent, gradient CTA
9. `order-confirmation.tsx` — Celebration styling, gradient text
10. `orders-page.tsx` — Accordion accent, disable item hover
11. `cart-sidebar.tsx` — Warm colors, minor polish

## Hardcoded Colors to Replace

| Current | New | Context |
|---------|-----|---------|
| `#F3F4F6` | `#F5F5F4` | Image placeholder backgrounds (6+ files) |
| `#F8FAFC` | `#F5F5F4` | User badge bg in header |
| `#EFF6FF` | `#EEF2FF` | Hover tints (handled by theme) |
