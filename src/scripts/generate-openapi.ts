/**
 * OpenAPI Specification Generator
 *
 * Generates a complete OpenAPI 3.0 specification from ts-rest contracts.
 * This script is designed to produce production-ready specs for client generation.
 *
 * Usage:
 *   pnpm openapi:generate                          # Generate all APIs
 *   pnpm openapi:generate --contract=contacts      # Generate only contacts API
 *   pnpm openapi:generate --contract=contacts,jobs # Generate contacts and jobs APIs
 *   pnpm openapi:generate --yaml                   # Also generate YAML format
 *
 * Available contracts: contacts, jobs, jobTemplates
 *
 * Output directory: generated/openapi/
 *   - openapi.json                    (all contracts)
 *   - openapi-contacts.json           (single contract filter)
 *   - openapi-contacts-jobs.json      (multiple contracts filter)
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { initContract } from '@ts-rest/core';
import { generateOpenApi } from '@ts-rest/open-api';
import type { OpenAPIObject, SecurityRequirementObject } from 'openapi3-ts/oas30';
import { stringify as yamlStringify } from 'yaml';
import { contactsContract } from '../modules/contacts/api/contacts.contracts.js';
import { jobTemplatesContract } from '../modules/practice-management/api/job-templates.contracts.js';
import { jobsContract } from '../modules/practice-management/api/jobs.contracts.js';

/**
 * Available contracts that can be filtered
 */
const AVAILABLE_CONTRACTS = {
  contacts: contactsContract,
  jobs: jobsContract,
  jobTemplates: jobTemplatesContract,
} as const;

type ContractName = keyof typeof AVAILABLE_CONTRACTS;

/**
 * API metadata configuration
 */
const API_INFO = {
  title: 'EasyBiz Backend Accounting API',
  description: `
REST API for the EasyBiz Backend Accounting System.

## Authentication

All endpoints under \`/api/internal/*\` require Bearer token authentication.
Include the token in the Authorization header:

\`\`\`
Authorization: Bearer <your-api-token>
\`\`\`

## API Versioning

This API uses URL-based versioning where applicable. Internal APIs are prefixed with \`/api/internal/\`.

## Error Handling

All endpoints return consistent error responses:

- **400 Bad Request**: Validation errors with details
- **401 Unauthorized**: Missing or invalid authentication
- **404 Not Found**: Resource not found
- **500 Internal Server Error**: Unexpected server errors

## Rate Limiting

API requests are rate-limited to 100 requests per minute per client.
`.trim(),
  version: '1.0.0',
  contact: {
    name: 'EasyBiz API Support',
    email: 'api-support@easybiz.io',
  },
  license: {
    name: 'Proprietary',
    url: 'https://easybiz.io/terms',
  },
};

/**
 * Server configurations for different environments
 */
const SERVERS = [
  {
    url: 'https://api.easybiz.io',
    description: 'Production server',
  },
  {
    url: 'http://localhost:3000',
    description: 'Local development server',
  },
];

/**
 * Security scheme definitions
 */
const SECURITY_SCHEMES = {
  BearerAuth: {
    type: 'http' as const,
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'Internal API authentication using Bearer tokens',
  },
};

/**
 * Default security requirement for protected endpoints
 */
const DEFAULT_SECURITY: SecurityRequirementObject[] = [{ BearerAuth: [] }];

/**
 * API tags for organizing endpoints
 */
const TAGS = [
  {
    name: 'Contacts',
    description:
      'Contact management endpoints for creating, listing, and retrieving global contacts',
  },
  {
    name: 'Jobs',
    description: 'Job management endpoints for CRUD operations on accounting jobs',
  },
  {
    name: 'Job Templates',
    description: 'Job template management for defining reusable job configurations',
  },
];

/**
 * Map contract paths to their corresponding tags
 */
function getTagsForPath(path: string): string[] {
  if (path.includes('/contacts') || path.includes('/global-contacts')) {
    return ['Contacts'];
  }
  if (path.includes('/job-templates')) {
    return ['Job Templates'];
  }
  if (path.includes('/jobs')) {
    return ['Jobs'];
  }
  return [];
}

/**
 * Parse and validate the --contract CLI argument
 */
function parseContractFilter(args: string[]): ContractName[] | null {
  const contractArg = args.find((arg) => arg.startsWith('--contract='));
  if (!contractArg) {
    return null; // No filter, use all contracts
  }

  const contractValue = contractArg.split('=')[1];
  if (!contractValue) {
    throw new Error('--contract flag requires a value. Example: --contract=contacts');
  }

  const contractNames = contractValue.split(',').map((s) => s.trim());
  const validNames = Object.keys(AVAILABLE_CONTRACTS);

  for (const name of contractNames) {
    if (!validNames.includes(name)) {
      throw new Error(
        `Invalid contract name: "${name}". Available contracts: ${validNames.join(', ')}`
      );
    }
  }

  return contractNames as ContractName[];
}

/**
 * Build a filtered contract based on the specified contract names
 */
function buildFilteredContract(filter: ContractName[] | null) {
  const c = initContract();

  if (!filter) {
    // No filter, include all contracts
    return c.router(AVAILABLE_CONTRACTS);
  }

  // Build a router with only the filtered contracts
  const filteredContracts: Record<string, (typeof AVAILABLE_CONTRACTS)[ContractName]> = {};
  for (const name of filter) {
    filteredContracts[name] = AVAILABLE_CONTRACTS[name];
  }

  return c.router(filteredContracts);
}

/**
 * Generate OpenAPI specification from ts-rest contracts
 */
function generateSpec(filter: ContractName[] | null): OpenAPIObject {
  const contract = buildFilteredContract(filter);

  const openApiDocument = generateOpenApi(
    contract,
    {
      openapi: '3.0.3',
      info: API_INFO,
      servers: SERVERS,
      tags: TAGS,
      // Global security - all endpoints require BearerAuth by default
      // Individual operations can override with security: [] for public endpoints
      security: DEFAULT_SECURITY,
      components: {
        securitySchemes: SECURITY_SCHEMES,
      },
    },
    {
      // Enable operation IDs based on contract path
      setOperationId: 'concatenated-path',

      // Map operations to add tags and optionally override security for public endpoints
      operationMapper: (operation, appRoute) => {
        const path = appRoute.path;
        const pathTags = getTagsForPath(path);
        const finalTags = pathTags.length > 0 ? pathTags : (operation.tags ?? []);

        // Internal endpoints inherit global security (BearerAuth)
        // Public endpoints explicitly set security: [] to override global security
        const isPublicEndpoint = !path.includes('/api/internal/');

        return {
          ...operation,
          tags: finalTags,
          // Public endpoints need explicit empty security to override global BearerAuth
          ...(isPublicEndpoint ? { security: [] } : {}),
        };
      },
    }
  );

  return openApiDocument as OpenAPIObject;
}

/**
 * Convert OpenAPI object to YAML format
 */
function toYaml(spec: OpenAPIObject): string {
  return yamlStringify(spec, { lineWidth: 0 });
}

/**
 * Default output directory for generated OpenAPI specs
 */
const DEFAULT_OUTPUT_DIR = 'generated/openapi';

/**
 * Generate output filename based on contract filter
 */
function getOutputFilename(filter: ContractName[] | null): string {
  if (!filter) {
    return 'openapi';
  }
  return `openapi-${filter.join('-')}`;
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const outputYaml = args.includes('--yaml');
  const outputDir =
    args.find((arg) => arg.startsWith('--output='))?.split('=')[1] || DEFAULT_OUTPUT_DIR;
  const contractFilter = parseContractFilter(args);
  const baseFilename = getOutputFilename(contractFilter);

  if (contractFilter) {
    console.log(`Generating OpenAPI specification for: ${contractFilter.join(', ')}...`);
  } else {
    console.log('Generating OpenAPI specification for all contracts...');
  }

  try {
    const spec = generateSpec(contractFilter);

    // Validate the generated spec
    if (!spec.paths || Object.keys(spec.paths).length === 0) {
      throw new Error('Generated spec has no paths. Check contract configuration.');
    }

    const pathCount = Object.keys(spec.paths).length;
    console.log(`Generated spec with ${pathCount} paths`);

    // Ensure output directory exists
    await mkdir(outputDir, { recursive: true });

    // Write JSON output
    const jsonPath = resolve(outputDir, `${baseFilename}.json`);
    await writeFile(jsonPath, JSON.stringify(spec, null, 2), 'utf-8');
    console.log(`Written: ${jsonPath}`);

    // Optionally write YAML output
    if (outputYaml) {
      const yamlContent = toYaml(spec);
      const yamlPath = resolve(outputDir, `${baseFilename}.yaml`);
      await writeFile(yamlPath, yamlContent, 'utf-8');
      console.log(`Written: ${yamlPath}`);
    }

    console.log('\nOpenAPI generation complete!');
    console.log('\nNext steps:');
    console.log(`  - Validate: npx @redocly/cli lint ${jsonPath}`);
    console.log(
      `  - Generate client: npx openapi-generator-cli generate -i ${jsonPath} -g typescript-fetch -o ./client`
    );
    console.log(`  - View docs: npx @redocly/cli preview-docs ${jsonPath}`);
  } catch (error) {
    console.error('Failed to generate OpenAPI spec:', error);
    process.exit(1);
  }
}

void main();
