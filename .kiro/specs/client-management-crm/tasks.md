# Implementation Plan: Gestión Avanzada de Clientes (CRM)

## Overview

This implementation plan breaks down the CRM feature into discrete, manageable coding tasks. The system will be built using Next.js 14 with App Router, TypeScript, Supabase (PostgreSQL), and Shadcn/ui components. Tasks are organized to build incrementally, with each step validating functionality before moving forward.

## Tasks

- [ ] 1. Database schema setup and migrations
  - [x] 1.1 Create client_deactivations table
    - Write Supabase migration for client_deactivations table with columns: id, client_id, reason (enum), notes, deactivated_by, deactivated_at, created_at
    - Add foreign key constraints to clients and users tables
    - _Requirements: 4.2, 4.3, 4.6_
  
  - [x] 1.2 Create client_action_logs table
    - Write Supabase migration for client_action_logs table with columns: id, client_id, action_type (enum), description, user_id, created_at
    - Add foreign key constraints and indexes on client_id and created_at
    - _Requirements: 7.1, 7.3_
  
  - [x] 1.3 Create client_ratings table
    - Write Supabase migration for client_ratings table with columns: client_id, rating, score, payment_punctuality, purchase_frequency, total_purchases, client_tenure_days, last_calculated
    - Add unique constraint on client_id and index on rating
    - _Requirements: 2.1, 2.11_
  
  - [x] 1.4 Extend collection_actions table with new fields
    - Write Supabase migration to add columns: description, follow_up_date, completed (default false), completed_at
    - Add indexes on follow_up_date and completed status
    - _Requirements: 8.1, 8.4_
  
  - [x] 1.5 Create system_config table
    - Write Supabase migration for system_config table with columns: key (primary), value, description, updated_at
    - Insert default config values for inactivity_threshold_days (90)
    - _Requirements: 3.3_
  
  - [x] 1.6 Extend clients table with new fields
    - Write Supabase migration to add columns: last_purchase_date, rating, rating_score, deactivation_reason, deactivated_at, deactivated_by (birthday already exists)
    - Add indexes on last_purchase_date, rating, and birthday
    - _Requirements: 2.1, 3.2, 4.1, 5.5_

- [ ] 2. Core TypeScript types and interfaces
  - [x] 2.1 Create core data model interfaces and types
    - Write TypeScript interfaces in lib/types/crm.ts for: ClientProfile, CreditSummary, Purchase, InstallmentWithPlan, ClientActionLog, ClientRating, DashboardMetrics, Alert, ClientFilters, CollectionAction
    - Define enums for: DeactivationReason, ActionType, AlertType, AlertPriority, RatingCategory
    - _Requirements: 1.1, 2.1, 3.1, 7.1, 8.1_
  
  - [x] 2.2 Write property test for core data model
    - **Property 12: Profile Data Completeness**
    - **Validates: Requirements 1.1**

- [ ] 3. Client rating calculation service
  - [x] 3.1 Implement calculateClientRating function
    - Write function in lib/services/rating-service.ts that calculates rating based on payment punctuality (40%), purchase frequency (30%), total purchases (20%), and client tenure (10%)
    - Implement score normalization and category assignment (A: 90-100, B: 70-89, C: 50-69, D: 0-49)
    - Handle edge case for clients with no history (default to C/50)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_
  
  - [x] 3.2 Write property tests for rating calculation
    - **Property 1: Rating Score Range Invariant**
    - **Property 2: Rating Category Assignment**
    - **Validates: Requirements 2.1, 2.6, 2.7, 2.8, 2.9**
  
  - [x] 3.3 Write unit tests for rating edge cases
    - Test new client with no purchases
    - Test client with perfect payment history
    - Test client with all late payments
    - Test client with mixed payment history
    - _Requirements: 2.10_

- [ ] 4. Client profile data fetching service
  - [x] 4.1 Implement fetchClientProfile function
    - Write function in lib/services/client-service.ts that fetches complete client profile using parallel queries (Promise.all)
    - Fetch client data, purchases, credit plans, installments, action logs, collection actions, and rating
    - Calculate credit summary (limit, used, available, total debt, overdue debt)
    - Sort installments by due date (ascending) and purchases by date (descending)
    - Calculate days overdue for each installment
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 11.1_
  
  - [x] 4.2 Write property tests for profile fetching
    - **Property 3: Credit Available Calculation**
    - **Property 13: Installments Ordered by Due Date**
    - **Property 14: Purchase History Ordered by Date**
    - **Property 21: Days Overdue Calculation**
    - **Validates: Requirements 1.3, 1.4, 10.4, 11.1**
  
  - [x] 4.3 Write unit tests for profile service
    - Test profile fetch with valid client ID
    - Test profile fetch with non-existent client (404 error)
    - Test credit summary calculations
    - _Requirements: 1.6_

- [ ] 5. Alert generation service
  - [x] 5.1 Implement generateAlerts function
    - Write function in lib/services/alert-service.ts that generates all alert types
    - Implement birthday alerts (7 days before, MEDIUM priority)
    - Implement inactivity alerts (configurable threshold, LOW priority)
    - Implement installment due alerts (7 days before, MEDIUM priority)
    - Implement overdue alerts (past due date, HIGH priority)
    - Ensure idempotence and unique alert IDs
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_
  
  - [x] 5.2 Write property tests for alert generation
    - **Property 6: Alert Generation Idempotence**
    - **Property 7: Overdue Alert Generation**
    - **Property 8: Birthday Alert Generation**
    - **Property 23: Alert Uniqueness**
    - **Validates: Requirements 3.2, 3.5, 3.7, 3.8**
  
  - [x] 5.3 Write unit tests for each alert type
    - Test birthday alert generation with various date scenarios
    - Test inactivity alert with different thresholds
    - Test installment due alerts
    - Test overdue alerts
    - _Requirements: 3.1_

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Client deactivation service
  - [x] 7.1 Implement deactivateClient function
    - Write function in lib/services/client-service.ts that deactivates a client
    - Set active = false on clients table
    - Create record in client_deactivations table with reason, notes, user_id, timestamp
    - Validate reason is one of: FALLECIDO, MUDADO, DESAPARECIDO, OTRO
    - Create audit log entry
    - _Requirements: 4.1, 4.2, 4.3, 4.6_
  
  - [x] 7.2 Implement reactivateClient function
    - Write function that sets active = true and creates REACTIVACION action log
    - _Requirements: 7.5_
  
  - [x] 7.3 Write property tests for deactivation
    - **Property 5: Deactivated Clients Cannot Purchase**
    - **Property 10: Deactivation Preserves History**
    - **Property 11: Deactivation Creates Audit Record**
    - **Property 24: Valid Deactivation Reasons**
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5, 4.6**
  
  - [x] 7.4 Write unit tests for deactivation
    - Test successful deactivation with each reason type
    - Test deactivation with invalid reason (should fail)
    - Test that historical data is preserved
    - Test reactivation flow
    - _Requirements: 4.1, 4.5, 7.5_

- [ ] 8. Client filtering service
  - [x] 8.1 Implement filterClients function
    - Write function in lib/services/client-service.ts that applies multiple filter criteria with AND logic
    - Implement debt status filters (AL_DIA, CON_DEUDA, MOROSO)
    - Implement days since last purchase filter
    - Implement rating filter (multiple categories)
    - Implement birthday month filter
    - Implement status filter (ACTIVO, INACTIVO, BAJA)
    - Implement deactivation reason filter
    - Sort results alphabetically by name
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10_
  
  - [x] 8.2 Write property tests for filtering
    - **Property 9: Filter Results Match All Criteria**
    - **Property 22: Filtered Results Alphabetical Order**
    - **Validates: Requirements 5.1, 5.10**
  
  - [x] 8.3 Write unit tests for each filter type
    - Test each filter criterion independently
    - Test combinations of multiple filters
    - Test empty results
    - _Requirements: 5.1_

- [ ] 9. Dashboard metrics service
  - [x] 9.1 Implement fetchDashboardMetrics function
    - Write function in lib/services/dashboard-service.ts that calculates all dashboard metrics
    - Count total active clients, deactivated clients, clients with debt, clients with overdue debt
    - Count inactive clients (based on threshold), birthdays this month, pending collection actions
    - Calculate total outstanding debt and total overdue debt
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9_
  
  - [x] 9.2 Write property tests for dashboard metrics
    - **Property 15: Dashboard Metrics Accuracy**
    - **Property 16: Overdue Debt Calculation**
    - **Validates: Requirements 6.1, 6.9**
  
  - [x] 9.3 Write unit tests for metrics calculations
    - Test each metric calculation with sample data
    - Test with empty database
    - _Requirements: 6.1_

- [ ] 10. Action logging service
  - [x] 10.1 Implement createActionLog function
    - Write function in lib/services/action-service.ts that creates action logs
    - Validate action type (NOTA, LLAMADA, VISITA, MENSAJE, REACTIVACION)
    - Store user_id and current timestamp
    - Handle REACTIVACION type by updating client active status
    - _Requirements: 7.1, 7.2, 7.3, 7.5_
  
  - [x] 10.2 Implement fetchActionLogs function
    - Write function that fetches action logs for a client, sorted by date (descending)
    - _Requirements: 7.4_
  
  - [x] 10.3 Write property tests for action logging
    - **Property 17: Action Log Timestamp Presence**
    - **Property 18: Reactivation Changes Status**
    - **Validates: Requirements 7.3, 7.5**
  
  - [x] 10.4 Write unit tests for action logging
    - Test creating each action type
    - Test reactivation flow
    - Test action log retrieval and ordering
    - _Requirements: 7.1, 7.4_

- [ ] 11. Collection actions service
  - [x] 11.1 Implement createCollectionAction function
    - Write function in lib/services/collection-service.ts that creates collection actions
    - Validate required fields (client_id, action_type, description, follow_up_date)
    - Store user_id and current timestamp
    - _Requirements: 8.1, 8.2_
  
  - [x] 11.2 Implement completeCollectionAction function
    - Write function that marks action as completed and sets completed_at timestamp
    - _Requirements: 8.4_
  
  - [x] 11.3 Implement fetchCollectionActions function
    - Write function that fetches collection actions for a client, sorted by follow_up_date
    - _Requirements: 8.3_
  
  - [x] 11.4 Write property tests for collection actions
    - **Property 27: Collection Action Required Fields**
    - **Property 28: Completed Action Timestamp**
    - **Validates: Requirements 8.1, 8.4**
  
  - [x] 11.5 Write unit tests for collection actions
    - Test creating collection action with all required fields
    - Test completing collection action
    - Test fetching and ordering
    - Test pending actions count for dashboard
    - _Requirements: 8.1, 8.2, 8.5_

- [x] 12. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Data export service
  - [x] 13.1 Implement exportClients function
    - Write function in lib/services/export-service.ts that generates CSV from filtered clients
    - Include columns: name, DNI, phone, address, credit_limit, credit_used, total_debt, overdue_debt, rating, last_purchase, status
    - Format dates as ISO 8601 (YYYY-MM-DD)
    - Format amounts with two decimals
    - Mask sensitive data (DNI, phone) for non-admin users
    - Generate filename with current date and time
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_
  
  - [x] 13.2 Write property tests for export
    - **Property 19: Export Contains All Filtered Clients**
    - **Property 20: Export Column Completeness**
    - **Validates: Requirements 9.1, 9.2**
  
  - [x] 13.3 Write unit tests for export
    - Test CSV generation with sample data
    - Test date and amount formatting
    - Test data masking for non-admin users
    - _Requirements: 9.3, 9.4, 9.5_

- [ ] 14. Credit limit validation service
  - [x] 14.1 Implement validateCreditLimit function
    - Write function in lib/services/credit-service.ts that validates credit purchases
    - Check that credit_used + new_purchase_amount <= credit_limit
    - Return validation result with available credit amount
    - _Requirements: 10.1, 10.2_
  
  - [x] 14.2 Implement updateCreditUsed function
    - Write function that updates credit_used after payments and recalculates available credit
    - _Requirements: 10.3, 10.4_
  
  - [x] 14.3 Write property tests for credit validation
    - **Property 4: Credit Limit Enforcement**
    - **Validates: Requirements 10.1, 10.2**
  
  - [x] 14.4 Write unit tests for credit validation
    - Test validation with amount within limit
    - Test validation with amount exceeding limit
    - Test credit_used update after payment
    - _Requirements: 10.1, 10.2, 10.3_

- [ ] 15. Authorization middleware and utilities
  - [x] 15.1 Implement authorization middleware
    - Write middleware in lib/auth/authorization.ts that checks user roles
    - Implement requireRole function for 'admin' and 'vendedor' roles
    - Return 403 error for unauthorized access
    - _Requirements: 13.1, 13.2, 13.3_
  
  - [x] 15.2 Implement audit logging utility
    - Write function in lib/utils/audit.ts that creates audit log entries
    - Log user, timestamp, action type, and details for sensitive operations
    - _Requirements: 4.6, 13.6_
  
  - [x] 15.3 Write property tests for authorization
    - **Property 29: Authorization Role Verification**
    - **Property 30: Admin-Only Deactivation**
    - **Validates: Requirements 13.1, 13.2, 13.3**
  
  - [x] 15.4 Write unit tests for authorization
    - Test role verification for admin and vendedor
    - Test 403 error for unauthorized users
    - Test admin-only operations
    - _Requirements: 13.1, 13.2, 13.3_

- [x] 16. Client profile page and components
  - [x] 16.1 Create client profile page
    - Create app/(auth)/clients/[id]/page.tsx with server component that fetches client profile
    - Implement error handling for non-existent clients (404)
    - Add authorization check for admin/vendedor roles
    - _Requirements: 1.1, 1.6, 13.1_
  
  - [x] 16.2 Create ClientProfileView component
    - Create components/clients/client-profile-view.tsx with tabs for overview, purchases, credits, and actions
    - Implement tab navigation using Shadcn Tabs component
    - _Requirements: 1.1_
  
  - [x] 16.3 Create ClientHeader component
    - Create components/clients/client-header.tsx that displays client name, rating badge, and key info
    - Show rating with color coding (A: green, B: blue, C: yellow, D: red)
    - _Requirements: 1.1, 2.1_
  
  - [x] 16.4 Create CreditSummaryCard component
    - Create components/clients/credit-summary-card.tsx that displays credit limit, used, available, total debt, and overdue debt
    - Use Shadcn Card component with visual indicators
    - _Requirements: 1.5_
  
  - [x] 16.5 Create InstallmentsTable component
    - Create components/clients/installments-table.tsx that displays installments with due dates, amounts, status, and days overdue
    - Highlight overdue installments in red
    - Sort by due date (earliest first)
    - _Requirements: 1.3, 11.1_
  
  - [x] 16.6 Create PurchaseHistoryTable component
    - Create components/clients/purchase-history-table.tsx that displays purchase history
    - Sort by date (most recent first)
    - _Requirements: 1.4_
  
  - [x] 16.7 Create ActionLogsTable component
    - Create components/clients/action-logs-table.tsx that displays action logs
    - Show action type, description, user, and timestamp
    - _Requirements: 7.4_
  
  - [x] 16.8 Create CollectionActionsTable component
    - Create components/clients/collection-actions-table.tsx that displays collection actions
    - Show follow-up date, status (pending/completed), and completion button
    - _Requirements: 8.3_
  
  - [x] 16.9 Create AddActionForm component
    - Create components/clients/add-action-form.tsx with form to add new action logs
    - Use Shadcn Form, Select, and Textarea components
    - Implement form validation with Zod
    - _Requirements: 7.1, 7.2_
  
  - [x] 16.10 Create AddCollectionActionForm component
    - Create components/clients/add-collection-action-form.tsx with form to add collection actions
    - Include fields for action type, description, and follow-up date
    - _Requirements: 8.1, 8.2_

- [x] 17. Client dashboard page and components
  - [x] 17.1 Create client dashboard page
    - Create app/(auth)/clients/dashboard/page.tsx that fetches metrics and alerts
    - Implement caching with 5-minute TTL using React Query or Next.js cache
    - Add authorization check for admin/vendedor roles
    - _Requirements: 6.1, 13.1, 14.6_
  
  - [x] 17.2 Create DashboardMetrics component
    - Create components/clients/dashboard-metrics.tsx that displays all metrics in cards
    - Use Shadcn Card component with icons and color coding
    - Display: active clients, deactivated clients, clients with debt, overdue debt, inactive clients, birthdays, pending actions, total debt, overdue debt amount
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9_
  
  - [x] 17.3 Create AlertsList component
    - Create components/clients/alerts-list.tsx that displays alerts sorted by priority
    - Use color coding for priority (HIGH: red, MEDIUM: yellow, LOW: gray)
    - Show alert type icon, client name, message, and due date/amount if applicable
    - Make client name clickable to navigate to profile
    - _Requirements: 3.6, 6.10_

- [x] 18. Client list page with filters
  - [x] 18.1 Create client list page
    - Create app/(auth)/clients/page.tsx with server component that fetches filtered clients
    - Implement pagination with 100 records per page
    - Add authorization check for admin/vendedor roles
    - _Requirements: 5.1, 13.1, 14.5_
  
  - [x] 18.2 Create ClientFilters component
    - Create components/clients/client-filters.tsx with filter controls
    - Implement filters for: debt status, rating, days since last purchase, birthday month, status, deactivation reason
    - Use Shadcn Select and Input components
    - Implement debouncing (300ms) for filter changes
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 14.4_
  
  - [x] 18.3 Create ClientsTable component
    - Create components/clients/clients-table.tsx that displays filtered clients
    - Show name, DNI, phone, rating, last purchase, debt status, and actions
    - Make rows clickable to navigate to profile
    - Add export button that triggers CSV download
    - _Requirements: 5.10, 9.1_
  
  - [x] 18.4 Implement responsive design for client list
    - Add responsive breakpoints for mobile, tablet, and desktop
    - Collapse non-essential columns on mobile
    - Use horizontal scroll for tables on small screens
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [x] 19. Client deactivation UI
  - [x] 19.1 Create DeactivateClientDialog component
    - Create components/clients/deactivate-client-dialog.tsx with form to deactivate client
    - Use Shadcn Dialog, Select, and Textarea components
    - Include reason dropdown (FALLECIDO, MUDADO, DESAPARECIDO, OTRO) and notes field
    - Show confirmation message before deactivation
    - Restrict to admin users only
    - _Requirements: 4.1, 4.2, 4.3, 13.3_
  
  - [x] 19.2 Add deactivation button to client profile
    - Add "Dar de Baja" button to ClientHeader component
    - Show button only for admin users
    - Open DeactivateClientDialog on click
    - _Requirements: 4.1, 13.3_

- [x] 20. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 21. Server actions for mutations
  - [x] 21.1 Create client actions
    - Create actions/clients.ts with server actions for: createActionLog, createCollectionAction, completeCollectionAction, deactivateClient, reactivateClient
    - Implement authorization checks in each action
    - Implement input validation with Zod schemas
    - Handle errors and return appropriate error messages
    - _Requirements: 7.1, 8.1, 8.4, 4.1, 7.5, 13.1, 15.2_
  
  - [x] 21.2 Create rating actions
    - Create actions/ratings.ts with server action for: calculateAndUpdateRating
    - Call calculateClientRating service and update clients table
    - _Requirements: 2.1, 2.11_
  
  - [x] 21.3 Create export actions
    - Create actions/export.ts with server action for: exportFilteredClients
    - Call exportClients service and return CSV data
    - Implement role-based data masking
    - _Requirements: 9.1, 9.5_

- [x] 22. Error handling and validation
  - [x] 22.1 Implement global error boundary
    - Create app/error.tsx with error boundary component
    - Display user-friendly error messages
    - Log errors to server logs
    - _Requirements: 15.3_
  
  - [x] 22.2 Implement form validation schemas
    - Create lib/validations/crm.ts with Zod schemas for all forms
    - Validate action logs, collection actions, deactivation, filters
    - _Requirements: 15.2_
  
  - [x] 22.3 Implement database error handling
    - Add try-catch blocks with retry logic (3 attempts, exponential backoff) for all database operations
    - Show "Error de conexión. Intente nuevamente." message on connection failures
    - _Requirements: 15.1_
  
  - [x] 22.4 Implement input validation error messages
    - Add field-level validation messages to all forms
    - Use Shadcn Form component error display
    - _Requirements: 15.2_

- [x] 23. Performance optimizations
  - [x] 23.1 Add database indexes
    - Create Supabase migration to add indexes on: clients.last_purchase_date, clients.rating, clients.birthday, installments.due_date, installments.status
    - _Requirements: 14.1, 14.2_
  
  - [x] 23.2 Implement parallel data fetching
    - Ensure all profile data fetching uses Promise.all() for parallel queries
    - _Requirements: 1.2, 14.1_
  
  - [x] 23.3 Implement dashboard caching
    - Add React Query or Next.js cache with 5-minute TTL for dashboard metrics
    - _Requirements: 14.6_
  
  - [x] 23.4 Implement filter debouncing
    - Add 300ms debounce to filter input changes using useDebouncedCallback
    - _Requirements: 14.4_
  
  - [x] 23.5 Implement pagination
    - Add pagination to client list with 100 records per page
    - Use Supabase range queries for efficient pagination
    - _Requirements: 14.5_

- [x] 24. Row-level security policies
  - [x] 24.1 Create RLS policies for client_deactivations
    - Write Supabase RLS policies to restrict access by user role and store
    - _Requirements: 13.4_
  
  - [x] 24.2 Create RLS policies for client_action_logs
    - Write Supabase RLS policies to restrict access by user role and store
    - _Requirements: 13.4_
  
  - [x] 24.3 Create RLS policies for collection_actions
    - Write Supabase RLS policies to restrict access by user role and store
    - _Requirements: 13.4_
  
  - [x] 24.4 Create RLS policies for client_ratings
    - Write Supabase RLS policies to allow read access for admin/vendedor roles
    - _Requirements: 13.4_

- [x] 25. Integration and wiring
  - [x] 25.1 Wire all components together
    - Connect all UI components to server actions
    - Implement optimistic updates for better UX
    - Add loading states and skeletons
    - Add success/error toast notifications
    - _Requirements: 1.1_
  
  - [x] 25.2 Add navigation links
    - Add CRM navigation links to main navigation menu
    - Add links to: client list, dashboard, client profile
    - _Requirements: 1.1_
  
  - [x] 25.3 Implement responsive design polish
    - Test and refine responsive layouts for all pages
    - Ensure mobile, tablet, and desktop views work correctly
    - _Requirements: 12.1, 12.2, 12.3, 12.4_
  
  - [x] 25.4 Write integration tests
    - Test complete workflows: create client → add purchases → calculate rating → view profile
    - Test filter → export flow
    - Test deactivation → reactivation flow
    - Test collection action creation → completion flow

- [x] 26. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All database operations use parameterized queries via Supabase client for SQL injection prevention
- Authorization checks are implemented at both middleware and action levels
- Performance optimizations include parallel queries, caching, debouncing, and pagination
- The implementation follows Next.js 14 App Router patterns with Server Components and Server Actions
