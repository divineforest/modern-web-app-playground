import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestOrderItem } from '../../../../tests/factories/order-items.js';
import { createTestOrder } from '../../../../tests/factories/orders.js';
import { createTestProduct } from '../../../../tests/factories/products.js';
import { db, orderItems, orders, products } from '../../../db/index.js';
import type { Product } from '../../products/domain/product.entity.js';
import {
  CartNotFoundError,
  checkout,
  EmptyCartError,
  InactiveProductError,
  OrderNotCheckoutEligibleError,
} from './checkout.service.js';

const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';
const TEST_USER_ID_2 = '00000000-0000-0000-0000-000000000002';

describe('Checkout Service', () => {
  let testProduct: Product;

  beforeEach(async () => {
    testProduct = await createTestProduct({
      status: 'active',
      name: 'Test Product',
      price: '75.00',
      currency: 'EUR',
    });
  });

  afterEach(async () => {
    await db.delete(orderItems);
    await db.delete(orders);
    await db.delete(products);
  });

  it('should successfully convert cart to confirmed order', async () => {
    const cart = await createTestOrder({
      status: 'cart',
      userId: TEST_USER_ID,
      subtotal: '75.00',
      totalAmount: '75.00',
      currency: 'EUR',
    });

    await createTestOrderItem({
      orderId: cart.id,
      productId: testProduct.id,
      quantity: '1',
      unitPrice: '75.00',
      currency: 'EUR',
      productName: testProduct.name,
      productSku: testProduct.sku,
    });

    const result = await checkout(
      TEST_USER_ID,
      {
        shippingAddress: {
          fullName: 'Jane Smith',
          addressLine1: '789 Oak St',
          city: 'San Francisco',
          postalCode: '94102',
          countryCode: 'US',
        },
        billingSameAsShipping: true,
      },
      undefined,
      db
    );

    expect(result.status).toBe('confirmed');
    expect(result.orderNumber).toMatch(/^ORD-\d{8}-\d{5}$/);
    expect(result.shippingAddress.fullName).toBe('Jane Smith');
    expect(result.billingAddress.fullName).toBe('Jane Smith');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.productId).toBe(testProduct.id);
  });

  it('should use separate billing address when provided', async () => {
    const cart = await createTestOrder({
      status: 'cart',
      userId: TEST_USER_ID,
      subtotal: '75.00',
      totalAmount: '75.00',
      currency: 'EUR',
    });

    await createTestOrderItem({
      orderId: cart.id,
      productId: testProduct.id,
      quantity: '1',
      unitPrice: '75.00',
      currency: 'EUR',
      productName: testProduct.name,
      productSku: testProduct.sku,
    });

    const result = await checkout(
      TEST_USER_ID,
      {
        shippingAddress: {
          fullName: 'Jane Smith',
          addressLine1: '789 Oak St',
          city: 'San Francisco',
          postalCode: '94102',
          countryCode: 'US',
        },
        billingAddress: {
          fullName: 'Company Billing',
          addressLine1: '100 Corporate Blvd',
          city: 'Austin',
          postalCode: '78701',
          countryCode: 'US',
        },
        billingSameAsShipping: false,
      },
      undefined,
      db
    );

    expect(result.shippingAddress.fullName).toBe('Jane Smith');
    expect(result.billingAddress.fullName).toBe('Company Billing');
    expect(result.billingAddress.city).toBe('Austin');
  });

  it('should throw CartNotFoundError when no cart exists', async () => {
    await expect(
      checkout(
        TEST_USER_ID,
        {
          shippingAddress: {
            fullName: 'Jane Smith',
            addressLine1: '789 Oak St',
            city: 'San Francisco',
            postalCode: '94102',
            countryCode: 'US',
          },
          billingSameAsShipping: true,
        },
        undefined,
        db
      )
    ).rejects.toThrow(CartNotFoundError);
  });

  it('should throw EmptyCartError when cart has no items', async () => {
    await createTestOrder({
      status: 'cart',
      userId: TEST_USER_ID,
      subtotal: '0.00',
      totalAmount: '0.00',
      currency: 'EUR',
    });

    await expect(
      checkout(
        TEST_USER_ID,
        {
          shippingAddress: {
            fullName: 'Jane Smith',
            addressLine1: '789 Oak St',
            city: 'San Francisco',
            postalCode: '94102',
            countryCode: 'US',
          },
          billingSameAsShipping: true,
        },
        undefined,
        db
      )
    ).rejects.toThrow(EmptyCartError);
  });

  it('should throw InactiveProductError when product is no longer active', async () => {
    const inactiveProduct = await createTestProduct({
      status: 'archived',
      name: 'Inactive Product',
      price: '40.00',
      currency: 'EUR',
    });

    const cart = await createTestOrder({
      status: 'cart',
      userId: TEST_USER_ID,
      subtotal: '40.00',
      totalAmount: '40.00',
      currency: 'EUR',
    });

    await createTestOrderItem({
      orderId: cart.id,
      productId: inactiveProduct.id,
      quantity: '1',
      unitPrice: '40.00',
      currency: 'EUR',
      productName: inactiveProduct.name,
      productSku: inactiveProduct.sku,
    });

    await expect(
      checkout(
        TEST_USER_ID,
        {
          shippingAddress: {
            fullName: 'Jane Smith',
            addressLine1: '789 Oak St',
            city: 'San Francisco',
            postalCode: '94102',
            countryCode: 'US',
          },
          billingSameAsShipping: true,
        },
        undefined,
        db
      )
    ).rejects.toThrow(InactiveProductError);
  });

  it('should be idempotent when order is already confirmed', async () => {
    const existingOrder = await createTestOrder({
      status: 'confirmed',
      userId: TEST_USER_ID,
      subtotal: '75.00',
      totalAmount: '75.00',
      currency: 'EUR',
      shippingAddress: JSON.stringify({
        fullName: 'Original Name',
        addressLine1: '999 Old St',
        city: 'Portland',
        postalCode: '97201',
        countryCode: 'US',
      }),
      billingAddress: JSON.stringify({
        fullName: 'Original Name',
        addressLine1: '999 Old St',
        city: 'Portland',
        postalCode: '97201',
        countryCode: 'US',
      }),
    });

    await createTestOrderItem({
      orderId: existingOrder.id,
      productId: testProduct.id,
      quantity: '1',
      unitPrice: '75.00',
      currency: 'EUR',
      productName: testProduct.name,
      productSku: testProduct.sku,
    });

    const result = await checkout(
      TEST_USER_ID,
      {
        shippingAddress: {
          fullName: 'New Name',
          addressLine1: '123 New St',
          city: 'Seattle',
          postalCode: '98101',
          countryCode: 'US',
        },
        billingSameAsShipping: true,
      },
      undefined,
      db
    );

    expect(result.orderNumber).toBe(existingOrder.orderNumber);
    expect(result.shippingAddress.fullName).toBe('Original Name');
  });

  it('should throw OrderNotCheckoutEligibleError for non-cart orders', async () => {
    await createTestOrder({
      status: 'processing',
      userId: TEST_USER_ID,
      subtotal: '75.00',
      totalAmount: '75.00',
      currency: 'EUR',
    });

    await expect(
      checkout(
        TEST_USER_ID,
        {
          shippingAddress: {
            fullName: 'Jane Smith',
            addressLine1: '789 Oak St',
            city: 'San Francisco',
            postalCode: '94102',
            countryCode: 'US',
          },
          billingSameAsShipping: true,
        },
        undefined,
        db
      )
    ).rejects.toThrow(OrderNotCheckoutEligibleError);
  });

  it('should generate sequential order numbers within a day', async () => {
    const cart1 = await createTestOrder({
      status: 'cart',
      userId: TEST_USER_ID,
      subtotal: '75.00',
      totalAmount: '75.00',
      currency: 'EUR',
    });

    await createTestOrderItem({
      orderId: cart1.id,
      productId: testProduct.id,
      quantity: '1',
      unitPrice: '75.00',
      currency: 'EUR',
      productName: testProduct.name,
      productSku: testProduct.sku,
    });

    const result1 = await checkout(
      TEST_USER_ID,
      {
        shippingAddress: {
          fullName: 'Jane Smith',
          addressLine1: '789 Oak St',
          city: 'San Francisco',
          postalCode: '94102',
          countryCode: 'US',
        },
        billingSameAsShipping: true,
      },
      undefined,
      db
    );

    const cart2 = await createTestOrder({
      status: 'cart',
      userId: TEST_USER_ID_2,
      subtotal: '75.00',
      totalAmount: '75.00',
      currency: 'EUR',
    });

    await createTestOrderItem({
      orderId: cart2.id,
      productId: testProduct.id,
      quantity: '1',
      unitPrice: '75.00',
      currency: 'EUR',
      productName: testProduct.name,
      productSku: testProduct.sku,
    });

    const result2 = await checkout(
      TEST_USER_ID_2,
      {
        shippingAddress: {
          fullName: 'Bob Jones',
          addressLine1: '456 Pine St',
          city: 'Denver',
          postalCode: '80202',
          countryCode: 'US',
        },
        billingSameAsShipping: true,
      },
      undefined,
      db
    );

    const today = new Date().toISOString().split('T')[0];
    const formattedToday = today ? today.replace(/-/g, '') : '';
    expect(result1.orderNumber).toMatch(`ORD-${formattedToday}-00001`);
    expect(result2.orderNumber).toMatch(`ORD-${formattedToday}-00002`);
  });

  it('should clear cart token after checkout', async () => {
    const cart = await createTestOrder({
      status: 'cart',
      userId: TEST_USER_ID,
      cartToken: '00000000-0000-0000-0000-000000000099',
      subtotal: '75.00',
      totalAmount: '75.00',
      currency: 'EUR',
    });

    await createTestOrderItem({
      orderId: cart.id,
      productId: testProduct.id,
      quantity: '1',
      unitPrice: '75.00',
      currency: 'EUR',
      productName: testProduct.name,
      productSku: testProduct.sku,
    });

    await checkout(
      TEST_USER_ID,
      {
        shippingAddress: {
          fullName: 'Jane Smith',
          addressLine1: '789 Oak St',
          city: 'San Francisco',
          postalCode: '94102',
          countryCode: 'US',
        },
        billingSameAsShipping: true,
      },
      undefined,
      db
    );

    const updatedOrder = await db.query.orders.findFirst({
      where: (orders, { eq }) => eq(orders.id, cart.id),
    });

    expect(updatedOrder?.cartToken).toBeNull();
  });
});
