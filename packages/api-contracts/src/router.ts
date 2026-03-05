import { initContract } from '@ts-rest/core';
import { authContract } from './auth/contract.js';
import { cartContract } from './cart/contract.js';
import { checkoutContract } from './checkout/contract.js';
import { ordersContract } from './orders/contract.js';
import { productsContract } from './products/contract.js';

const c = initContract();

export const apiContract = c.router({
  auth: authContract,
  cart: cartContract,
  products: productsContract,
  orders: ordersContract,
  checkout: checkoutContract,
});
