import { apiContract } from '@mercado/api-contracts';
import { initClient } from '@ts-rest/core';
import { initTsrReactQuery } from '@ts-rest/react-query/v5';

export const api = initClient(apiContract, {
  baseUrl: '',
  baseHeaders: {},
  credentials: 'include',
});

export const tsr = initTsrReactQuery(apiContract, {
  baseUrl: '',
  baseHeaders: {},
  credentials: 'include',
});
