import { initClient } from '@ts-rest/core';
import { apiContract } from '@mercado/api-contracts';

export const api = initClient(apiContract, {
  baseUrl: '',
  baseHeaders: {},
});
