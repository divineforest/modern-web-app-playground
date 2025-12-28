# Automatic Job Generation for Billing Periods

## Overview

This feature implements automated, scheduled generation of jobs based on approved billing periods. The system eliminates manual spreadsheet tracking by creating one job per approved billing period for each company, ensuring operational visibility and alignment with billing cycles.

Jobs are automatically created daily for companies with active billing, linking work management directly to billing periods. The feature processes billing periods from the core microservice's public db schema, creates corresponding jobs in the accounting microservice, and maintains idempotency to prevent duplicates.

The solution targets internal operations teams (accountants) who need centralized job management through Retool UI, replacing manual tracking with automated, consistent job creation tied to billing lifecycle.

This feature fits into the larger Practice Management System (PMS) by bridging billing and operations, ensuring every approved billing period has corresponding work tracked as a job.

## Goals and Non-Goals

### Goals

- **Automated Job Creation**: Eliminate manual job creation by automatically generating jobs from approved billing periods
- **Billing-Operation Alignment**: Ensure every approved billing period has exactly one corresponding job
- **Idempotency**: Prevent duplicate job creation through robust deduplication logic
- **Operational Visibility**: Provide accountants with complete visibility of work tied to billing cycles
- **Cross-Service Integration**: Successfully integrate billing period data from core microservice with job management

### Non-Goals

- **Manual Job Creation Interface**: Manual job creation remains available via existing API but is not the focus
- **Billing Period Modification**: This feature does not create, modify, or approve billing periods
- **Multi-Service Type Support**: MVP supports only LEGACY service type; other service types are future enhancements
- **Job Template Integration**: Automatic job creation does not use job templates in MVP
- **Retool UI Development**: Frontend job management interface is out of scope for backend specification
- **Real-time Synchronization**: Jobs are created via scheduled batch process, not real-time triggers

## Business Impact

### Operational Efficiency

- **Eliminate Manual Tracking**: Replace spreadsheet-based job tracking with automated system
- **Reduce Human Error**: Automated creation prevents missing jobs or data entry mistakes
- **Consistent Process**: Standardize job creation workflow across all companies and billing periods

### Business Value

- **Time Savings**: Reduce accountant time spent on manual job creation by ~90%
- **Improved Accuracy**: Ensure 100% coverage of billing periods with corresponding jobs
- **Better Planning**: Provide complete view of upcoming work based on billing cycles
- **Audit Trail**: Maintain clear linkage between billing periods and operational work

### Success Metrics

- One job per approved billing period (100% coverage)
- Zero duplicate jobs for same billing period
- Daily automated execution without manual intervention
- Accountant adoption of Retool UI for job management (measured post-deployment)

## Functional Requirements

### FR-1: Company and Billing Period Discovery

- The system SHALL query eligible companies with their latest approved billing period via single SQL JOIN query
- The system SHALL apply filters (Note: companies and billing_periods tables are defined in core microservice's public schema):
  - company.status = `in_service`
  - company.billing_settings.isBillingEnabled = `true`
  - company.billing_address IS NOT NULL
  - billing_periods.is_approved = `TRUE`
- The system SHALL select the latest billing period per company by:
  - GROUP BY company_id
  - ORDER BY billing_periods.end_date DESC (or start_date DESC if end_date is identical)
  - Taking the most recent period using window functions or subquery with MAX(end_date)
- The system SHALL exclude companies without approved billing periods
- The system SHALL process results in batches to manage memory efficiently
- The system SHALL log the total number of company-period pairs discovered per execution

### FR-2: Idempotency and Deduplication

- The system SHALL add nullable `billing_period_id` foreign key column to jobs table
- The system SHALL create unique partial index on `billing_period_id` (WHERE billing_period_id IS NOT NULL) to enforce one job per billing period
- The system SHALL exclude billing periods that already have corresponding jobs via LEFT JOIN on billing_period_id in the discovery query

### FR-3: Job Creation

- The system SHALL create exactly one job per company-period pair returned from the discovery query
- The system SHALL set job fields from billing period data:
  - `company_id` = billing period's company_id
  - `billing_period_id` = billing period's id
  - `period_start` = billing period's start_date
  - `period_end` = billing period's end_date
  - `title` = generated from service type and period (e.g., "LEGACY - {Month} {Year}")
- The system SHALL set fixed job field values:
  - `service_type_id` = LEGACY service type UUID
  - `status` = "planned"
  - `due_at` = billing period's end_date + 2 days at 17:00 UTC
- The system SHALL use jobs service createJobService function directly

### FR-4: Scheduled Execution

- The system SHALL execute job generation automatically once per day via Render cron job
- The system SHALL execute at 02:00 UTC daily
- The system SHALL complete execution within 30 minutes for up to 1000 companies
- The system SHALL support manual execution via Render's manual trigger functionality
- The system SHALL not require human intervention for daily operation

### FR-5: Error Handling and Recovery

- The system SHALL continue processing remaining billing periods if individual job creation fails
- The system SHALL retry failed job creations up to 3 times with exponential backoff for transient errors
- The system SHALL log all job creation failures with company ID, billing period ID, and error details
- The system SHALL report all job creation failures to Sentry with full error context and stack traces (after retries exhausted)
- The system SHALL report summary statistics at completion (companies processed, periods discovered, failed)

### FR-6: Historical Backfill Script

- The system SHALL provide a manual backfill script for creating jobs for all billing periods that don't have jobs yet
- The script SHALL be implemented as a standalone TypeScript script using Drizzle ORM
- The script SHALL process billing periods in batches (batch size: 100)
- The script SHALL apply the same eligibility criteria and deduplication logic as automatic job generation
- The script SHALL be idempotent (safe to run multiple times without creating duplicates)
- The script SHALL log summary statistics (total jobs created)

## Technical Requirements

### TR-1: Cross-Microservice Data Access

- The system SHALL access billing period data via shared database connection to core microservice public schema
- The system SHALL use read-only queries (no writes to core tables)
- The system SHALL execute single JOIN query combining:
  - `public.companies` table (for eligibility filtering)
  - `public.billing_periods` table (for approved periods)
  - `jobs` table (for deduplication via LEFT JOIN on billing_period_id)
- The system SHALL select the latest billing period per company using:
  - Window function (ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY end_date DESC)) OR
  - Subquery with MAX(end_date) per company_id
- The system SHALL process query results in batches (recommended batch size: 100 rows per batch)

### TR-2: Service Type Configuration

- The system SHALL reference LEGACY service type from `service_types` table
- The system SHALL create LEGACY service type via database migration before deployment
- The system SHALL cache LEGACY service type UUID to avoid repeated lookups during script execution

### TR-3: Database Schema Changes

- The system SHALL add nullable `billing_period_id` column to jobs table:
  ```sql
  -- References billing_periods table in core microservice's public schema
  ALTER TABLE jobs 
  ADD COLUMN billing_period_id UUID NULL 
  REFERENCES public.billing_periods(id);
  ```
- The system SHALL update Drizzle schema definition in `src/db/schema.ts`:
  - Add `billing_period_id: uuid('billing_period_id').references(() => billing_periods.id)` to jobs table schema
  - Note: `billing_periods` table reference points to core microservice's public schema
- The system SHALL create unique partial index on billing_period_id:
  ```sql
  CREATE UNIQUE INDEX idx_jobs_unique_billing_period 
  ON jobs(billing_period_id)
  WHERE billing_period_id IS NOT NULL;
  ```
- The index SHALL enforce one job per billing period at database level
- The system SHALL create LEGACY service type via database migration:
  ```sql
  INSERT INTO service_types (id, code, name, status, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    'LEGACY',
    'Legacy Accounting Services',
    'active',
    NOW(),
    NOW()
  )
  ON CONFLICT (code) DO NOTHING;
  ```
- The migration SHALL be idempotent using ON CONFLICT to allow safe re-runs

### TR-4: Script Implementation

- The system SHALL implement job generation as a standalone script in `src/scripts/`
- The script SHALL be executed by Render cron job on schedule
- The script SHALL call the automatic job generation service directly
- The script SHALL exit with code 0 on success, non-zero on failure
- The script SHALL log execution start, completion, and summary statistics

### TR-5: Module Organization

- The system SHALL organize code in `src/modules/practice-management/` following modular architecture
- The system SHALL create the following new files:
  - `services/automatic-job-generation.service.ts` - Business logic for job generation
  - `services/automatic-job-generation.service.test.ts` - Service tests
  - `repositories/company-billing-periods.repository.ts` - Single JOIN query for eligible companies with approved billing periods
  - `repositories/company-billing-periods.repository.test.ts` - Repository tests
- The system SHALL create script files:
  - `src/scripts/automatic-job-generation.ts` - Entry point script for daily cron job execution
  - `src/scripts/backfill-jobs.ts` - Manual backfill script for historical data migration

### TR-6: Configuration

- The system SHALL configure schedule in Render cron job settings (daily at 02:00 UTC)
- The system SHALL use environment variables for business logic:
  - `JOB_GENERATION_DUE_OFFSET_DAYS` - Days to add to period end for due date (default: 2)
  - `JOB_GENERATION_DUE_HOUR` - Hour for due date time (default: 17)
- The system SHALL use `src/lib/env.ts` for type-safe environment variable access with Zod validation

### TR-7: Backfill Script Implementation

The backfill script SHALL be implemented as a simple TypeScript script using Drizzle ORM with the following logic:

**Script Logic** (`src/scripts/backfill-jobs.ts`):
```typescript
// Initialize database connection
// Lookup LEGACY service type ID
// Loop until no more periods to process:
//   Execute INSERT INTO jobs ... SELECT ... LIMIT 100
//   (same eligibility and deduplication logic as automatic job generation)
//   Break if no rows inserted
// Log summary (total jobs created)
// Exit with code 0
```

The INSERT...SELECT query SHALL:
- Apply same filters as automatic job generation (company eligibility, approved periods)
- Use LEFT JOIN to exclude periods that already have jobs
- Process 100 billing periods per batch using LIMIT
- Generate same job fields (title, due_at, billing_period_id, etc.)

### TR-8: Logging and Observability

- The system SHALL log at INFO level:
  - Script execution start and completion
  - Summary statistics (companies processed, periods discovered, failed)
  - Service type lookup and caching
- The system SHALL log at WARN level and report to Sentry:
  - Companies skipped due to eligibility criteria
  - Jobs skipped due to existing records
- The system SHALL log at ERROR level and report to Sentry:
  - Individual job creation failures (with company ID, billing period ID, error details)
  - Service type not found
  - Database connection failures
- The system SHALL include structured logging fields:
  - `executionId` - Unique execution identifier (timestamp-based)
  - `companyId` - Company being processed
  - `billingPeriodId` - Billing period being processed
  - `jobId` - Created job ID (when applicable)
  - `executionDate` - Date of script execution
- The system SHALL use standard project logger from `src/lib/logger.ts`

## Data Flow

### Daily Automatic Job Generation

1. **Render Cron Job** triggers script at 02:00 UTC daily
2. **Script** starts and initializes execution context with execution ID and timestamp
3. **Service** retrieves and caches LEGACY service type UUID from service_types table
4. **Service** queries eligible companies with their latest approved billing period in batches via single JOIN query:
   - INNER JOIN: `public.companies` JOIN `public.billing_periods` ON company_id (Note: these tables are from core microservice's public schema)
   - LEFT JOIN: with `jobs` table ON jobs.billing_period_id = billing_periods.id
   - Filters: 
     - company.status = "in_service" 
     - billing_settings.isBillingEnabled = true 
     - billing_address IS NOT NULL 
     - billing_periods.is_approved = TRUE
     - jobs.id IS NULL (exclude billing periods that already have jobs)
   - Select latest billing period per company (ORDER BY end_date DESC, using window function or subquery)
   - Process in batches (e.g., 100 per batch) to avoid memory issues
   - Returns only company-period pairs that need job creation
5. **Service** creates jobs for each company-period pair returned:
   - Generate job title from service type and period
   - Set billing_period_id to link job to billing period
   - Calculate due_at from period_end + offset
   - Call jobs service createJobService function directly
   - Retry failed creations up to 3 times with exponential backoff (for transient errors like database timeouts)
   - Log and report failures to Sentry after retries exhausted (ERROR level)
   - Continue processing remaining periods on individual failures
6. **Service** aggregates summary statistics:
   - Count total companies processed
   - Count billing periods discovered
   - Count failures
7. **Script** logs final summary with all statistics and exits with appropriate code

### Manual Execution for Testing

1. **Developer/Operator** triggers cron job manually via Render dashboard or API (https://render.com/docs/cronjobs#manually-triggering-a-run)
2. **Script** executes identical logic to scheduled execution
3. **Developer/Operator** reviews execution logs in Render dashboard and Sentry
4. **Developer/Operator** verifies created jobs in database or Retool UI

## Monitoring and Observability

### Metrics

- **Job Generation Metrics** (tracked per script execution):
  - `jobs.generation.companies_processed` - Total companies evaluated
  - `jobs.generation.periods_discovered` - Total approved billing periods found
  - `jobs.generation.jobs_failed` - Total job creation failures
  - `jobs.generation.execution_duration_ms` - Total script execution time
  - `jobs.generation.failure_rate_percent` - Percentage of billing periods that failed job creation

- **Render Cron Job Metrics** (provided by Render):
  - Job execution count
  - Job success/failure rate
  - Execution duration

### Logging Requirements

- **Script Start Log** (INFO):
  ```json
  {
    "level": "info",
    "msg": "Starting automatic job generation",
    "executionId": "auto-job-gen-2024-01-15T02:00:00Z",
    "executionDate": "2024-01-15T02:00:00Z"
  }
  ```

- **Company Processing Log** (DEBUG):
  ```json
  {
    "level": "debug",
    "msg": "Processing company for job generation",
    "companyId": "uuid",
    "companyName": "Acme Corp",
    "isEligible": true
  }
  ```

- **Job Creation Log** (INFO):
  ```json
  {
    "level": "info",
    "msg": "Created job for billing period",
    "jobId": "uuid",
    "companyId": "uuid",
    "billingPeriodId": "uuid",
    "periodStart": "2024-01-01",
    "periodEnd": "2024-01-31"
  }
  ```

- **Job Skipped Log** (WARN):
  ```json
  {
    "level": "warn",
    "msg": "Skipped job creation - already exists",
    "companyId": "uuid",
    "billingPeriodId": "uuid",
    "existingJobId": "uuid"
  }
  ```

- **Script Summary Log** (INFO):
  ```json
  {
    "level": "info",
    "msg": "Completed automatic job generation",
    "executionId": "auto-job-gen-2024-01-15T02:00:00Z",
    "statistics": {
      "companiesProcessed": 150,
      "periodsDiscovered": 145,
      "jobsFailed": 2,
      "executionDurationMs": 45000,
      "failureRatePercent": 1.38
    }
  }
  ```

### Alerting

All individual job creation failures and warnings are automatically reported to Sentry with full context. Additional monitoring:

- **Cron Job Execution Failure**: Monitored via Render dashboard and Sentry
  - Script exits with non-zero code on critical failures
  - Render provides built-in alerting for failed cron jobs



## Error Scenarios

### Ineligible Company

- **Scenario**: Company does not meet eligibility criteria (status, billing settings, address) or has no approved billing period
- **Detection**: Excluded by JOIN query filters (not returned in query results)
- **Response**: Company not processed (filtered at database level)
- **Impact**: No jobs created for that company
- **Recovery**: Update company data to meet criteria, next daily run will include company in query results

### Duplicate Job Prevention

- **Scenario**: Job already exists for billing period (previous run, manual creation)
- **Detection**: LEFT JOIN on billing_period_id in discovery query excludes periods with existing jobs
- **Response**: Billing period not returned in query results (filtered at database level)
- **Impact**: No duplicate created, existing job unchanged
- **Recovery**: None needed, this is expected behavior (LEFT JOIN on billing_period_id FK prevents duplicates)

### Job Creation Service Failure

- **Scenario**: jobs service createJobService function throws error
- **Detection**: Exception during job creation
- **Response**: Retry up to 3 times with exponential backoff (1s, 2s, 4s), log error with full details, report to Sentry after retries exhausted, continue processing remaining periods
- **Impact**: Job not created for that billing period in this execution if all retries fail
- **Recovery**: Review error in Sentry, fix underlying issue, next daily run will retry

### Database Unique Constraint Violation

- **Scenario**: Concurrent job creation attempts for same billing period
- **Detection**: PostgreSQL unique index violation on billing_period_id
- **Response**: Treat as duplicate, log warning (reported to Sentry), continue processing
- **Impact**: One job created successfully, duplicate attempt rejected
- **Recovery**: None needed, unique index on billing_period_id provides protection

### Script Timeout

- **Scenario**: Script exceeds reasonable execution time (e.g., processing 10,000+ companies)
- **Detection**: Render cron job timeout or monitoring alerts
- **Response**: Script may be terminated by platform, partial results committed
- **Impact**: Some billing periods not processed in this execution
- **Recovery**: Optimize query performance, consider batching, next daily run will process remaining

### Invalid Billing Period Data

- **Scenario**: Billing period has null start_date or end_date
- **Detection**: Data validation in service layer during job creation
- **Response**: Skip billing period, log error with period ID (reported to Sentry)
- **Impact**: Job not created for that specific billing period
- **Recovery**: Fix billing period data in core microservice, next daily run will process

## Testing and Validation

### Unit Tests

**Service Layer** (`automatic-job-generation.service.test.ts`):
- Generate job title from service type and period dates
- Calculate due date from period end with configurable offset
- Query and cache LEGACY service type
- Process empty company-period results
- Handle invalid date formats
- Create jobs via jobs service createJobService function
- Retry job creation on transient failures (up to 3 times with exponential backoff)
- Handle individual job creation failures after retries exhausted
- Continue processing on failures
- Calculate execution statistics

**Repository Layer** (`company-billing-periods.repository.test.ts`):
- Query eligible companies with approved billing periods via single JOIN
- Apply eligibility filters at database level (status, billing settings, address)
- Group by company_id to get one period per company
- Exclude periods that already have jobs (LEFT JOIN with jobs on billing_period_id)
- Support batch processing with limit/offset
- Return empty array when no eligible companies found

**Script Layer** (`automatic-job-generation.test.ts`):
- Daily script executes service and logs results
- Scripts exit with code 0 on success
- Scripts exit with non-zero code on critical failure

**Backfill Script Layer** (`backfill-jobs.test.ts`):
- Script creates jobs for billing periods without jobs
- Script skips periods that already have jobs (idempotency)
- Script processes in batches
- Script logs summary statistics

### Integration Tests

**Script Execution**:
- End-to-end script execution with test data
- Test batch processing (verify batches are processed correctly)
- Multiple companies with different eligibility states (test JOIN query filtering)
- Mix of approved and unapproved billing periods (only approved should be returned)
- Existing jobs (should be excluded by LEFT JOIN)
- Non-existing jobs (should create)
- Companies with multiple approved periods (verify GROUP BY returns only one)
- Verify idempotency (run twice, same results - LEFT JOIN prevents duplicates)
- Verify script exit codes (0 for success, non-zero for failure)

**Backfill Script Execution**:
- End-to-end backfill execution creates jobs for all periods without jobs
- Verify batches are processed until no more periods remain
- Verify same eligibility filtering as daily execution
- Verify idempotency (run twice, no duplicates created)
- Verify correct job data (title, due_at, billing_period_id linkage)

**Database Integration**:
- Verify unique index on billing_period_id prevents duplicates
- Test billing_period_id foreign key constraint
- Test JOIN query performance with large datasets
- Test query returns correct latest billing period per company (most recent end_date)
- Test LEFT JOIN on billing_period_id correctly excludes periods with existing jobs
- Test foreign key relationships (company cascade, billing_period FK constraint)
- Verify timestamp timezone handling

### Manual QA Test Cases

**Pre-deployment Checklist**:
1. Verify database migrations applied (billing_period_id column added, unique index created, LEGACY service type seeded)
2. Verify at least 5 test companies with approved billing periods exist
3. Verify environment variables configured correctly
4. Verify Render cron job configured with correct schedule (02:00 UTC)

**Functional Testing**:
1. **Initial Run**: Execute script manually, verify jobs created for all eligible billing periods
2. **Idempotency**: Execute script again, verify no duplicate jobs created
3. **Ineligible Company**: Disable billing for company, verify no jobs created
4. **New Billing Period**: Approve new billing period, run script, verify job created
5. **Manual Job**: Manually create job for billing period, run script, verify no duplicate
6. **Error Recovery**: Temporarily disable database, run script, verify graceful failure and appropriate exit code
7. **Historical Backfill**: Run backfill script, verify jobs created for all historical periods without jobs
8. **Backfill Idempotency**: Run backfill again, verify no duplicates created

**Performance Testing**:
1. Test with 100 companies, measure execution time (should be < 5 minutes)
2. Test with 500 companies, measure execution time (should be < 15 minutes)
3. Test with 1000 companies, measure execution time (should be < 30 minutes)
4. Monitor database query performance during execution
5. Test backfill script with 1000+ historical periods, verify completes within reasonable time

**Observability Validation**:
1. Verify cron job appears in Render dashboard with correct schedule
2. Verify logs contain all required structured fields
3. Verify summary statistics are accurate
4. Verify Sentry captures errors and warnings
5. Verify no sensitive data (API keys, passwords) in logs

### Test Coverage Requirements

- **Unit Test Coverage**: 100% for service layer
- **Integration Test Coverage**: Script execution and service interactions
- **Edge Cases**: All error scenarios documented above
- **Regression Tests**: Idempotency, deduplication, eligibility validation

### Acceptance Criteria Validation

| Requirement | Validation Method |
|-------------|------------------|
| One job per approved billing period | Query database: COUNT(jobs WHERE billing_period_id IS NOT NULL) matches eligible billing periods |
| No duplicate jobs | Run script twice, verify job count unchanged (unique index on billing_period_id prevents duplicates) |
| Correct period linkage | Verify job.billing_period_id references correct billing_period.id |
| Only eligible companies | Verify no jobs created for companies with billing disabled (filtered by JOIN) |
| Only latest billing period | Verify query returns most recent period (highest end_date) per company |
| Daily execution | Verify cron job runs at 02:00 UTC via Render dashboard |
| Execution completes in 30 min | Monitor execution duration in Render dashboard |

## Security Considerations

### Script Security

- The system SHALL not log sensitive company data (billing amounts, payment info)

- The system SHALL restrict manual cron job triggers to authorized operators via Render's access controls
- The system SHALL validate all inputs before processing

### Audit Trail

- The system SHALL log all job creation actions with company ID and billing period ID
- The system SHALL maintain execution logs in Render for audit purposes (per Render's retention policy)
- The system SHALL report all errors and warnings to Sentry for tracking and alerting

## Risks and Mitigations

### Risk: LEGACY Service Type Missing

- **Impact**: Script failure, no jobs created
- **Probability**: Very Low (prevented by required database migration)
- **Mitigation**: 
  - Require database migration to seed LEGACY service type before deployment
  - Make migration idempotent to allow safe re-runs
  - Document migration requirement in deployment guide
  - Add integration test to verify service type exists after migration

### Risk: Duplicate Jobs Created

- **Impact**: Accountants see duplicate work items, potential double-billing
- **Probability**: Low (database unique constraint prevents this)
- **Mitigation**:
  - Implement database unique constraint as defense-in-depth
  - Implement application-level deduplication check
  - Add integration tests for idempotency
  - Design script to be safely runnable multiple times

### Risk: High Failure Rate

- **Impact**: Many billing periods without corresponding jobs, incomplete work tracking
- **Probability**: Medium (database issues, data quality)
- **Mitigation**:
  - Continue processing on individual failures
  - Report all failures to Sentry for immediate visibility
  - Support manual cron job trigger via Render for recovery
  - Add detailed error logging for troubleshooting

### Risk: Performance Degradation

- **Impact**: Script timeout, incomplete processing
- **Probability**: Medium (company growth over time)
- **Mitigation**:
  - Monitor execution duration in Render dashboard
  - Optimize database queries with proper indexing
  - Monitor execution duration over time
  - Consider batch processing optimization if needed

### Risk: Billing Period Data Quality Issues

- **Impact**: Jobs created with incorrect dates, invalid references
- **Probability**: Low (controlled by billing system)
- **Mitigation**:
  - Validate billing period data before job creation
  - Log data quality issues for investigation
  - Skip invalid billing periods with clear logging
  - Coordinate with core team on data contracts

### Risk: Schedule Misconfiguration

- **Impact**: Cron job runs too frequently or not at all
- **Probability**: Low (configuration error in Render)
- **Mitigation**:
  - Use Render's UI for schedule configuration (reduces syntax errors)
  - Verify schedule in Render dashboard before enabling
  - Monitor execution history in Render dashboard
  - Document schedule requirement clearly
  - Test schedule in staging environment

### Risk: Cross-Service Dependency

- **Impact**: Changes to billing period schema break job generation
- **Probability**: Medium (schema evolution)
- **Mitigation**:
  - Coordinate schema changes with core team
  - Add integration tests for billing period queries
  - Version data contracts between services
  - Validate data types in service layer
  - Monitor for query failures

## Deployment Strategy

### Pre-deployment Requirements

1. **Database Migrations**: Apply migrations to:
   - Add billing_period_id column to jobs table with FK to public.billing_periods
   - Add unique partial index on billing_period_id (WHERE NOT NULL)
   - Create LEGACY service type in service_types table
2. **Environment Configuration**: Set job generation offset variables (due date calculation)
3. **Render Cron Job Setup**: Create cron job in Render with schedule: daily at 02:00 UTC
4. **Monitoring Setup**: Verify Sentry integration (if ready)

### Deployment Steps

1. **Deploy Database Migrations**: Run migrations to add billing_period_id column, unique index, and create LEGACY service type
2. **Verify Service Type**: Confirm LEGACY service type exists in service_types table
3. **Deploy Application Code**: Deploy script, services, updated repositories
4. **Verify Configuration**: Check environment variables are set correctly
5. **Create Render Cron Job**: Configure in Render dashboard with:
   - Schedule: Daily at 02:00 UTC (cron expression: `0 2 * * *`)
   - Command: `node dist/scripts/automatic-job-generation.js`
   - Initially disabled for manual testing
6. **Manual Test Run**: Trigger cron job manually via Render dashboard, verify jobs created
7. **Enable Schedule**: Activate cron job schedule in Render
8. **Monitor First Scheduled Run**: Verify cron executes successfully at scheduled time

### Rollback Plan

1. **Disable Schedule**: Pause or delete cron job in Render dashboard
2. **Revert Code**: Roll back to previous application version
3. **Preserve Jobs**: Do not delete created jobs (data loss risk)
4. **Investigate**: Review logs in Render dashboard and Sentry to determine root cause
5. **Fix and Redeploy**: Address issues and follow deployment steps again



## Future Enhancements

### Phase 2: Multi-Service Type Support

- Support automatic job creation for all service types, not just LEGACY
- Read service type from company billing settings
- Generate appropriate job titles per service type
- Configure different due date offsets per service type

### Phase 3: Job Template Integration

- Generate jobs from job templates instead of fixed structure
- Support template variables (company name, period, etc.)
- Allow template-specific default assignees
- Enable custom job configurations per company

### Phase 4: Advanced Scheduling

- Support different schedules per company or service type
- Weekend/holiday awareness for due date calculation
- Time zone support for due dates
- Multiple jobs per billing period (start, mid, end)

### Phase 5: Enhanced Observability

- Real-time dashboard for job generation status
- Metrics exported to Prometheus
- Integration with APM tools (DataDog, New Relic)
- Detailed execution reports sent via email

### Phase 6: Smart Assignment

- Automatically assign jobs based on workload balancing
- Consider assignee availability and capacity
- Historical performance-based assignment
- Support for assignment rules and policies

## Dependencies

### Internal Dependencies

- **Jobs Module**: Existing job service layer (createJobService function)
- **Jobs Repository**: Database access for jobs table (used in LEFT JOIN for deduplication)
- **Database Connection**: Shared connection to core microservice public schema
- **Service Types**: LEGACY service type created by database migration

### External Dependencies

- **Core Microservice Database**: Access to billing_periods table in public schema
- **Render Platform**: Cron job execution and scheduling
- **Sentry**: Error and warning reporting
- **Environment Configuration**: Required environment variables set

### Data Contracts

**Billing Period (from core microservice)**:
```typescript
{
  id: string;
  company_id: string;
  start_date: Date;
  end_date: Date;
  is_approved: boolean;
  // Other fields not used by job generation
}
```

**Company (from core microservice)**:
```typescript
{
  id: string;
  name: string;
  status: "in_service" | "onboarding" | "churned" | ...;
  billing_settings: {
    isBillingEnabled: boolean;
    // Other settings not used by job generation
  };
  billing_address: string | null;
}
```

**Service Type (local)**:
```typescript
{
  id: string;
  code: "LEGACY" | ...;
  name: string;
  status: "active" | "deprecated";
}
```

## Success Criteria

- ✅ Cron job successfully executes on schedule (daily at 02:00 UTC)
- ✅ One job per approved billing period for eligible companies (100% coverage)
- ✅ Zero duplicate jobs created (verified by running script twice)
- ✅ Jobs correctly link to billing periods (period_start, period_end match)
- ✅ Only eligible companies processed (status, billing settings, address validated)
- ✅ Execution completes within 30 minutes for up to 1000 companies
- ✅ Idempotency verified (repeated executions produce same result)
- ✅ Error handling works (individual failures don't stop entire execution)
- ✅ Logging provides complete observability (all required fields present)
- ✅ Sentry receives all errors and warnings
- ✅ Integration tests pass with 100% success rate
- ✅ Unit test coverage = 100% for service layer
- ✅ Manual QA test cases pass successfully
- ✅ Database migration creates LEGACY service type successfully
- ✅ Database migration adds billing_period_id column with FK constraint
- ✅ Unique index on billing_period_id prevents duplicates at database level
- ✅ Accountants can view and manage auto-generated jobs in Retool (post-deployment verification)
