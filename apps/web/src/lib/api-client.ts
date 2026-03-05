import { apiContract } from '@mercado/api-contracts';
import { initClient } from '@ts-rest/core';

const DEV_USER_ID = import.meta.env.VITE_DEV_USER_ID;
const DEV_AUTH_TOKEN = import.meta.env.VITE_DEV_AUTH_TOKEN;

const baseHeaders: Record<string, string> = {};

if (DEV_USER_ID && DEV_AUTH_TOKEN) {
  console.info('[API Client] Development authentication enabled');
}

export function getAuthHeaders(): Record<string, string> {
  if (DEV_USER_ID && DEV_AUTH_TOKEN) {
    return {
      Authorization: `Bearer ${DEV_AUTH_TOKEN}`,
      'X-User-Id': DEV_USER_ID,
      'X-User-Email': 'dev@example.com',
      'X-User-Name': 'Dev User',
    };
  }
  return {};
}

export const api = initClient(apiContract, {
  baseUrl: '',
  baseHeaders,
});
