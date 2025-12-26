import { type HttpOptions, http } from '../../../lib/http.js';
import { createModuleLogger } from '../../../lib/logger.js';

const logger = createModuleLogger('odoo-sdk');

// Type definitions for Odoo credentials
export interface OdooCredentials {
  url: string;
  database: string;
  username: string;
  apiKey: string;
}

// Odoo SDK configuration
export interface OdooSdkConfig {
  timeout: number;
  retryAttempts: number;
  retryDelayMs: number;
}

// JSON-RPC request/response types
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params: Record<string, unknown>;
  id: number;
}

export interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// Authentication response type
export interface AuthResponse {
  uid: number;
  user_context: Record<string, unknown>;
  db: string;
  username: string;
  session_id: string;
}

// Error types
export class OdooSdkError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'OdooSdkError';
  }
}

// Type definitions for Odoo contact data
export interface OdooContact {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  write_date: string;
  active: boolean;
}

// Type definitions for Odoo contact category
export interface OdooContactCategory {
  id: number;
  name: string;
  write_date: string;
  active: boolean;
}

/**
 * Odoo SDK - Handles all interactions with Odoo JSON-RPC API
 */
export class OdooSdk {
  private config: OdooSdkConfig;
  private sessionId?: string;
  private uid?: number;
  private requestId = 1;

  constructor(
    private readonly credentials: OdooCredentials,
    config?: Partial<OdooSdkConfig>
  ) {
    this.config = {
      timeout: config?.timeout ?? 30000,
      retryAttempts: config?.retryAttempts ?? 3,
      retryDelayMs: config?.retryDelayMs ?? 1000,
    };

    logger.debug(
      {
        url: this.credentials.url,
        database: this.credentials.database,
        username: this.credentials.username,
        timeout: this.config.timeout,
        retryAttempts: this.config.retryAttempts,
      },
      'Odoo SDK initialized'
    );
  }

  /**
   * Get contacts from Odoo JSON-RPC API
   * @returns Promise<OdooContact[]> - Array of contacts
   */
  async getContacts(): Promise<OdooContact[]> {
    logger.debug({ database: this.credentials.database }, 'Getting contacts from Odoo');

    // Ensure we're authenticated
    if (!this.sessionId || !this.uid) {
      await this.authenticate();
    }

    try {
      const contacts = await this.jsonRpcCall<OdooContact[]>('call', {
        service: 'object',
        method: 'execute_kw',
        args: [
          this.credentials.database,
          this.uid as number,
          this.credentials.apiKey,
          'res.partner',
          'search_read',
          [[]], // domain - empty array means all records
          {
            fields: ['id', 'name', 'email', 'phone', 'write_date', 'active'],
            limit: 1000, // reasonable limit
          },
        ],
      });

      logger.info({ count: contacts.length }, 'Retrieved contacts from Odoo');
      return contacts;
    } catch (error) {
      logger.error({ error }, 'Failed to get contacts from Odoo');

      // Wrap network errors in OdooSdkError
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('Network error')) {
          throw new OdooSdkError(`Network error while getting contacts: ${error.message}`);
        }
        if (error.message.includes('timeout')) {
          throw new OdooSdkError(`Request timeout while getting contacts: ${error.message}`);
        }
      }

      throw error;
    }
  }

  /**
   * Get contact categories from Odoo JSON-RPC API
   * @returns Promise<OdooContactCategory[]> - Array of contact categories
   */
  async getContactCategories(): Promise<OdooContactCategory[]> {
    logger.debug({ database: this.credentials.database }, 'Getting contact categories from Odoo');

    // Ensure we're authenticated
    if (!this.sessionId || !this.uid) {
      await this.authenticate();
    }

    try {
      const categories = await this.jsonRpcCall<OdooContactCategory[]>('call', {
        service: 'object',
        method: 'execute_kw',
        args: [
          this.credentials.database,
          this.uid as number,
          this.credentials.apiKey,
          'res.partner.category',
          'search_read',
          [[]], // domain - empty array means all records
          {
            fields: ['id', 'name', 'write_date', 'active'],
            limit: 1000, // reasonable limit
          },
        ],
      });

      logger.info({ count: categories.length }, 'Retrieved contact categories from Odoo');
      return categories;
    } catch (error) {
      logger.error({ error }, 'Failed to get contact categories from Odoo');

      // Wrap network errors in OdooSdkError
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('Network error')) {
          throw new OdooSdkError(
            `Network error while getting contact categories: ${error.message}`
          );
        }
        if (error.message.includes('timeout')) {
          throw new OdooSdkError(
            `Request timeout while getting contact categories: ${error.message}`
          );
        }
      }

      throw error;
    }
  }

  /**
   * Authenticate with Odoo server
   * @returns Promise<void>
   */
  async authenticate(): Promise<void> {
    logger.debug(
      { url: this.credentials.url, database: this.credentials.database },
      'Authenticating with Odoo'
    );

    try {
      const authResult = await this.jsonRpcCall<AuthResponse>('/web/session/authenticate', {
        db: this.credentials.database,
        login: this.credentials.username,
        password: this.credentials.apiKey,
      });

      this.sessionId = authResult.session_id;
      this.uid = authResult.uid;

      logger.info(
        {
          uid: authResult.uid,
          database: authResult.db,
          username: authResult.username,
        },
        'Successfully authenticated with Odoo'
      );
    } catch (error) {
      logger.error({ error }, 'Failed to authenticate with Odoo');

      // Wrap network errors in OdooSdkError
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('Network error')) {
          throw new OdooSdkError(`Network error during authentication: ${error.message}`);
        }
        if (error.message.includes('timeout')) {
          throw new OdooSdkError(`Request timeout during authentication: ${error.message}`);
        }
      }

      throw error;
    }
  }

  /**
   * Test connection to Odoo server
   * @returns Promise<boolean> - True if connection successful
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.authenticate();
      logger.info('Odoo connection test successful');
      return true;
    } catch (error) {
      logger.error({ error }, 'Odoo connection test failed');
      return false;
    }
  }

  /**
   * Make JSON-RPC call to Odoo
   * @param method - JSON-RPC method name
   * @param params - Method parameters
   * @returns Promise<T> - Response result
   */
  private async jsonRpcCall<T>(method: string, params: Record<string, unknown>): Promise<T> {
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id: this.requestId++,
    };

    logger.debug(
      { method, requestId: request.id, paramsKeys: Object.keys(params) },
      'Making JSON-RPC call to Odoo'
    );

    const url = `${this.credentials.url}/jsonrpc`;
    const httpOptions: HttpOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      timeout: this.config.timeout,
      retryAttempts: this.config.retryAttempts,
      retryDelayMs: this.config.retryDelayMs,
    };

    const response = await http<JsonRpcResponse<T>>(url, httpOptions);

    if (response.status >= 400) {
      throw new OdooSdkError(
        `HTTP error! status: ${response.status}`,
        response.status,
        typeof response.body === 'string' ? response.body : JSON.stringify(response.body)
      );
    }

    const jsonResponse = response.body;

    if (jsonResponse.error) {
      throw new OdooSdkError(
        `Odoo RPC error: ${jsonResponse.error.message}`,
        jsonResponse.error.code,
        jsonResponse.error.data
      );
    }

    if (!('result' in jsonResponse)) {
      throw new OdooSdkError('Invalid JSON-RPC response format: missing result field');
    }

    return jsonResponse.result;
  }
}

/**
 * Factory function to create Odoo SDK instance
 * @param credentials - Odoo connection credentials
 * @param config - Optional SDK configuration
 * @returns OdooSdk instance
 */
export function createOdooSdk(
  credentials: OdooCredentials,
  config?: Partial<OdooSdkConfig>
): OdooSdk {
  return new OdooSdk(credentials, config);
}

/**
 * Convenience function to get contacts (maintains backward compatibility)
 * @param credentials - Odoo credentials
 * @returns Promise<OdooContact[]>
 */
export async function getContactsFromOdoo(credentials: OdooCredentials): Promise<OdooContact[]> {
  const sdk = createOdooSdk(credentials);
  return sdk.getContacts();
}
