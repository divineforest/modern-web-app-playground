import { initContract } from '@ts-rest/core';
import { cartContract } from './cart/contract.js';
import { ordersContract } from './orders/contract.js';
import { productsContract } from './products/contract.js';

const c = initContract();

export const apiContract = c.router({
  cart: cartContract,
  products: productsContract,
  orders: ordersContract,
});
