import type { APIRequestContext } from '@playwright/test';

const BACKEND_URL = 'http://localhost:3000';

export interface TestUser {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export class ApiHelper {
  private readonly request: APIRequestContext;

  constructor(request: APIRequestContext) {
    this.request = request;
  }

  async registerUser(user: TestUser): Promise<void> {
    const res = await this.request.post(`${BACKEND_URL}/api/auth/register`, { data: user });
    if (!res.ok()) {
      throw new Error(`Register failed (${res.status()}): ${await res.text()}`);
    }
  }

  async login(email: string, password: string): Promise<void> {
    const res = await this.request.post(`${BACKEND_URL}/api/auth/login`, {
      data: { email, password },
    });
    if (!res.ok()) {
      throw new Error(`Login failed (${res.status()}): ${await res.text()}`);
    }
  }

  async logout(): Promise<void> {
    const res = await this.request.post(`${BACKEND_URL}/api/auth/logout`, { data: {} });
    if (!res.ok()) {
      throw new Error(`Logout failed (${res.status()}): ${await res.text()}`);
    }
  }
}

export function uniqueEmail(): string {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
}

export function testUser(overrides?: Partial<TestUser>): TestUser {
  return {
    firstName: 'Test',
    lastName: 'User',
    email: uniqueEmail(),
    password: 'Password123!',
    ...overrides,
  };
}
