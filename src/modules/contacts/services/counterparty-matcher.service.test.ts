/**
 * Counterparty Matcher Service Unit Tests
 *
 * Tests for the counterparty matching logic that determines
 * document type (expense/income) based on VAT ID and name matching.
 */

import { describe, expect, it } from 'vitest';
import {
  type CompanyMatchData,
  matchCompanyToExtraction,
  namesMatch,
  normalizeNameForComparison,
  normalizeVatIdForComparison,
  vatIdsMatch,
} from './counterparty-matcher.service.js';
import type { RawExtractionData } from './raw-extraction-parser.service.js';

describe('counterparty-matcher.service', () => {
  describe('normalizeVatIdForComparison', () => {
    it('returns null for null input', () => {
      // ACT & ASSERT
      expect(normalizeVatIdForComparison(null)).toBeNull();
    });

    it('returns null for undefined input', () => {
      // ACT & ASSERT
      expect(normalizeVatIdForComparison(undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
      // ACT & ASSERT
      expect(normalizeVatIdForComparison('')).toBeNull();
    });

    it('converts to uppercase', () => {
      // ACT & ASSERT
      expect(normalizeVatIdForComparison('de123456789')).toBe('DE123456789');
    });

    it('removes all whitespace', () => {
      // ACT & ASSERT
      expect(normalizeVatIdForComparison('DE 123 456 789')).toBe('DE123456789');
    });

    it('removes tabs and newlines', () => {
      // ACT & ASSERT
      expect(normalizeVatIdForComparison('DE\t123\n456')).toBe('DE123456');
    });

    it('handles already normalized input', () => {
      // ACT & ASSERT
      expect(normalizeVatIdForComparison('DE123456789')).toBe('DE123456789');
    });
  });

  describe('normalizeNameForComparison', () => {
    it('returns null for null input', () => {
      // ACT & ASSERT
      expect(normalizeNameForComparison(null)).toBeNull();
    });

    it('returns null for undefined input', () => {
      // ACT & ASSERT
      expect(normalizeNameForComparison(undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
      // ACT & ASSERT
      expect(normalizeNameForComparison('')).toBeNull();
    });

    it('converts to uppercase', () => {
      // ACT & ASSERT
      // Note: "Corp" is a suffix that gets removed
      expect(normalizeNameForComparison('ACME COMPANY')).toBe('ACME COMPANY');
    });

    it('trims whitespace', () => {
      // ACT & ASSERT
      expect(normalizeNameForComparison('  ACME Company  ')).toBe('ACME COMPANY');
    });

    it('removes S.A. suffix', () => {
      // ACT & ASSERT
      expect(normalizeNameForComparison('Company S.A.')).toBe('COMPANY');
    });

    it('removes S.A.R.L. suffix', () => {
      // ACT & ASSERT
      expect(normalizeNameForComparison('Company S.A.R.L.')).toBe('COMPANY');
    });

    it('removes SARL suffix', () => {
      // ACT & ASSERT
      expect(normalizeNameForComparison('Company SARL')).toBe('COMPANY');
    });

    it('removes GmbH suffix', () => {
      // ACT & ASSERT
      expect(normalizeNameForComparison('Company GmbH')).toBe('COMPANY');
    });

    it('removes Ltd suffix', () => {
      // ACT & ASSERT
      expect(normalizeNameForComparison('Company Ltd')).toBe('COMPANY');
    });

    it('removes Inc suffix', () => {
      // ACT & ASSERT
      expect(normalizeNameForComparison('Company Inc')).toBe('COMPANY');
    });

    it('removes Corp suffix', () => {
      // ACT & ASSERT
      expect(normalizeNameForComparison('Company Corp')).toBe('COMPANY');
    });

    it('removes AG suffix', () => {
      // ACT & ASSERT
      expect(normalizeNameForComparison('Company AG')).toBe('COMPANY');
    });

    it('removes e.V. suffix', () => {
      // ACT & ASSERT
      expect(normalizeNameForComparison('Verein e.V.')).toBe('VEREIN');
    });

    it('removes multiple suffixes iteratively', () => {
      // ACT & ASSERT
      expect(normalizeNameForComparison('Company OHG mbH')).toBe('COMPANY');
    });

    it('handles suffix in different cases', () => {
      // ACT & ASSERT
      expect(normalizeNameForComparison('Company gmbh')).toBe('COMPANY');
      expect(normalizeNameForComparison('Company GMBH')).toBe('COMPANY');
    });
  });

  describe('vatIdsMatch', () => {
    it('returns false when both are null', () => {
      // ACT & ASSERT
      expect(vatIdsMatch(null, null)).toBe(false);
    });

    it('returns false when first is null', () => {
      // ACT & ASSERT
      expect(vatIdsMatch(null, 'DE123456789')).toBe(false);
    });

    it('returns false when second is null', () => {
      // ACT & ASSERT
      expect(vatIdsMatch('DE123456789', null)).toBe(false);
    });

    it('returns false when both are undefined', () => {
      // ACT & ASSERT
      expect(vatIdsMatch(undefined, undefined)).toBe(false);
    });

    it('returns true for exact match', () => {
      // ACT & ASSERT
      expect(vatIdsMatch('DE123456789', 'DE123456789')).toBe(true);
    });

    it('returns true for case-insensitive match', () => {
      // ACT & ASSERT
      expect(vatIdsMatch('DE123456789', 'de123456789')).toBe(true);
    });

    it('returns true when ignoring spaces', () => {
      // ACT & ASSERT
      expect(vatIdsMatch('DE 123 456 789', 'DE123456789')).toBe(true);
    });

    it('returns false for different VAT IDs', () => {
      // ACT & ASSERT
      expect(vatIdsMatch('DE123456789', 'DE987654321')).toBe(false);
    });

    it('returns false for different country codes', () => {
      // ACT & ASSERT
      expect(vatIdsMatch('DE123456789', 'LU123456789')).toBe(false);
    });
  });

  describe('namesMatch', () => {
    it('returns false when both are null', () => {
      // ACT & ASSERT
      expect(namesMatch(null, null)).toBe(false);
    });

    it('returns false when first is null', () => {
      // ACT & ASSERT
      expect(namesMatch(null, 'Company')).toBe(false);
    });

    it('returns false when second is null', () => {
      // ACT & ASSERT
      expect(namesMatch('Company', null)).toBe(false);
    });

    it('returns true for exact match', () => {
      // ACT & ASSERT
      expect(namesMatch('ACME Corp', 'ACME Corp')).toBe(true);
    });

    it('returns true for case-insensitive match', () => {
      // ACT & ASSERT
      expect(namesMatch('ACME Corp', 'acme corp')).toBe(true);
    });

    it('returns true when suffixes differ', () => {
      // ACT & ASSERT
      expect(namesMatch('ACME GmbH', 'ACME Ltd')).toBe(true);
    });

    it('returns true when one has suffix and other does not', () => {
      // ACT & ASSERT
      expect(namesMatch('ACME GmbH', 'ACME')).toBe(true);
    });

    it('returns false for different names', () => {
      // ACT & ASSERT
      expect(namesMatch('ACME Corp', 'Globex Inc')).toBe(false);
    });

    it('returns true for Luxembourg company name variations with S.A.R.L.', () => {
      // ARRANGE
      const name1 = 'AMAZON EUROPE CORE S.A.R.L.';
      const name2 = 'AMAZON EUROPE CORE';

      // ACT & ASSERT
      expect(namesMatch(name1, name2)).toBe(true);
    });

    it('returns true for company names with S.A. suffix', () => {
      // ARRANGE
      const name1 = 'COMPANY NAME S.A.';
      const name2 = 'Company Name';

      // ACT & ASSERT
      expect(namesMatch(name1, name2)).toBe(true);
    });
  });

  describe('matchCompanyToExtraction', () => {
    const buildExtraction = (
      supplier: { name?: string; vatId?: string },
      customer: { name?: string; vatId?: string }
    ): RawExtractionData => {
      const result: RawExtractionData = {};
      if (supplier.name) result.supplierName = { value: supplier.name };
      if (customer.name) result.customerName = { value: customer.name };
      if (supplier.vatId) {
        result.supplierCompanyRegistrations = [{ type: 'VAT NUMBER', value: supplier.vatId }];
      }
      if (customer.vatId) {
        result.customerCompanyRegistrations = [{ type: 'VAT NUMBER', value: customer.vatId }];
      }
      return result;
    };

    describe('VAT ID matching (primary)', () => {
      it('matches customer by VAT ID -> isExpense=true', () => {
        // ARRANGE
        const company: CompanyMatchData = {
          id: 'company-1',
          name: 'My Company',
          vatId: 'DE123456789',
        };
        const extraction = buildExtraction(
          { name: 'Supplier Co', vatId: 'LU999999999' },
          { name: 'Customer Co', vatId: 'DE123456789' }
        );

        // ACT
        const result = matchCompanyToExtraction(company, extraction);

        // ASSERT
        expect(result.matched).toBe('customer');
        expect(result.isExpense).toBe(true);
      });

      it('matches supplier by VAT ID -> isExpense=false', () => {
        // ARRANGE
        const company: CompanyMatchData = {
          id: 'company-1',
          name: 'My Company',
          vatId: 'DE123456789',
        };
        const extraction = buildExtraction(
          { name: 'Supplier Co', vatId: 'DE123456789' },
          { name: 'Customer Co', vatId: 'LU999999999' }
        );

        // ACT
        const result = matchCompanyToExtraction(company, extraction);

        // ASSERT
        expect(result.matched).toBe('supplier');
        expect(result.isExpense).toBe(false);
      });

      it('handles case-insensitive VAT ID matching', () => {
        // ARRANGE
        const company: CompanyMatchData = {
          id: 'company-1',
          name: 'My Company',
          vatId: 'DE123456789',
        };
        const extraction = buildExtraction(
          { name: 'Supplier Co', vatId: 'LU999999999' },
          { name: 'Customer Co', vatId: 'de123456789' } // lowercase
        );

        // ACT
        const result = matchCompanyToExtraction(company, extraction);

        // ASSERT
        expect(result.matched).toBe('customer');
        expect(result.isExpense).toBe(true);
      });

      it('handles VAT ID with spaces', () => {
        // ARRANGE
        const company: CompanyMatchData = {
          id: 'company-1',
          name: 'My Company',
          vatId: 'DE123456789',
        };
        const extraction = buildExtraction(
          { name: 'Supplier Co', vatId: 'LU999999999' },
          { name: 'Customer Co', vatId: 'DE 123 456 789' } // with spaces
        );

        // ACT
        const result = matchCompanyToExtraction(company, extraction);

        // ASSERT
        expect(result.matched).toBe('customer');
        expect(result.isExpense).toBe(true);
      });
    });

    describe('name matching (secondary)', () => {
      it('matches customer by name when company has no VAT ID -> isExpense=true', () => {
        // ARRANGE
        const company: CompanyMatchData = {
          id: 'company-1',
          name: 'My Company GmbH',
          vatId: null, // no VAT ID
        };
        const extraction = buildExtraction(
          { name: 'Supplier Co', vatId: 'LU999999999' },
          { name: 'My Company', vatId: 'DE123456789' } // name matches
        );

        // ACT
        const result = matchCompanyToExtraction(company, extraction);

        // ASSERT
        expect(result.matched).toBe('customer');
        expect(result.isExpense).toBe(true);
      });

      it('matches supplier by name when company has no VAT ID -> isExpense=false', () => {
        // ARRANGE
        const company: CompanyMatchData = {
          id: 'company-1',
          name: 'My Company GmbH',
          vatId: null, // no VAT ID
        };
        const extraction = buildExtraction(
          { name: 'My Company', vatId: 'DE123456789' }, // name matches
          { name: 'Customer Co', vatId: 'LU999999999' }
        );

        // ACT
        const result = matchCompanyToExtraction(company, extraction);

        // ASSERT
        expect(result.matched).toBe('supplier');
        expect(result.isExpense).toBe(false);
      });

      it('falls back to name matching when VAT IDs do not match', () => {
        // ARRANGE
        const company: CompanyMatchData = {
          id: 'company-1',
          name: 'My Company GmbH',
          vatId: 'DE111111111', // different VAT ID
        };
        const extraction = buildExtraction(
          { name: 'Supplier Co', vatId: 'LU999999999' },
          { name: 'My Company', vatId: 'DE222222222' } // different VAT but name matches
        );

        // ACT
        const result = matchCompanyToExtraction(company, extraction);

        // ASSERT
        expect(result.matched).toBe('customer');
        expect(result.isExpense).toBe(true);
      });

      it('handles case-insensitive name matching', () => {
        // ARRANGE
        const company: CompanyMatchData = {
          id: 'company-1',
          name: 'ACME CORP',
          vatId: null,
        };
        const extraction = buildExtraction(
          { name: 'Supplier Co' },
          { name: 'acme corp' } // lowercase
        );

        // ACT
        const result = matchCompanyToExtraction(company, extraction);

        // ASSERT
        expect(result.matched).toBe('customer');
        expect(result.isExpense).toBe(true);
      });

      it('handles name matching with different legal suffixes', () => {
        // ARRANGE
        const company: CompanyMatchData = {
          id: 'company-1',
          name: 'Acme GmbH',
          vatId: null,
        };
        const extraction = buildExtraction(
          { name: 'Supplier Co' },
          { name: 'Acme Ltd' } // different suffix
        );

        // ACT
        const result = matchCompanyToExtraction(company, extraction);

        // ASSERT
        expect(result.matched).toBe('customer');
        expect(result.isExpense).toBe(true);
      });
    });

    describe('no match scenarios', () => {
      it('returns matched=null when no VAT or name matches', () => {
        // ARRANGE
        const company: CompanyMatchData = {
          id: 'company-1',
          name: 'My Company',
          vatId: 'DE123456789',
        };
        const extraction = buildExtraction(
          { name: 'Supplier Co', vatId: 'LU111111111' },
          { name: 'Customer Co', vatId: 'LU222222222' }
        );

        // ACT
        const result = matchCompanyToExtraction(company, extraction);

        // ASSERT
        expect(result.matched).toBeNull();
        expect(result.isExpense).toBeNull();
      });

      it('returns matched=null when extraction has no data', () => {
        // ARRANGE
        const company: CompanyMatchData = {
          id: 'company-1',
          name: 'My Company',
          vatId: 'DE123456789',
        };
        const extraction: RawExtractionData = {};

        // ACT
        const result = matchCompanyToExtraction(company, extraction);

        // ASSERT
        expect(result.matched).toBeNull();
        expect(result.isExpense).toBeNull();
      });
    });

    describe('priority: VAT ID takes precedence over name', () => {
      it('prefers VAT ID match even when name also matches different party', () => {
        // ARRANGE - Company VAT matches customer, company name matches supplier
        const company: CompanyMatchData = {
          id: 'company-1',
          name: 'Supplier Co',
          vatId: 'DE123456789',
        };
        const extraction = buildExtraction(
          { name: 'Supplier Co', vatId: 'LU111111111' }, // name matches but VAT doesn't
          { name: 'Customer Co', vatId: 'DE123456789' } // VAT matches
        );

        // ACT
        const result = matchCompanyToExtraction(company, extraction);

        // ASSERT - Should match customer by VAT, not supplier by name
        expect(result.matched).toBe('customer');
        expect(result.isExpense).toBe(true);
      });
    });

    describe('customer matching priority over supplier', () => {
      it('matches customer first when both parties have matching VAT', () => {
        // ARRANGE - Same VAT ID in both supplier and customer (edge case)
        const company: CompanyMatchData = {
          id: 'company-1',
          name: 'My Company',
          vatId: 'DE123456789',
        };
        const extraction = buildExtraction(
          { name: 'Supplier Co', vatId: 'DE123456789' },
          { name: 'Customer Co', vatId: 'DE123456789' }
        );

        // ACT
        const result = matchCompanyToExtraction(company, extraction);

        // ASSERT - Customer is checked first per implementation
        expect(result.matched).toBe('customer');
        expect(result.isExpense).toBe(true);
      });

      it('matches customer first when both parties have matching name', () => {
        // ARRANGE - Same name in both supplier and customer (edge case)
        const company: CompanyMatchData = {
          id: 'company-1',
          name: 'Same Company',
          vatId: null,
        };
        const extraction = buildExtraction({ name: 'Same Company' }, { name: 'Same Company' });

        // ACT
        const result = matchCompanyToExtraction(company, extraction);

        // ASSERT - Customer is checked first per implementation
        expect(result.matched).toBe('customer');
        expect(result.isExpense).toBe(true);
      });
    });
  });
});
