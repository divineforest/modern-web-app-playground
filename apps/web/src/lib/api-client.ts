import { apiContract } from '@mercado/api-contracts';
import { initClient } from '@ts-rest/core';

export const api = initClient(apiContract, {
  baseUrl: '',
  baseHeaders: {},
  credentials: 'include',
});
