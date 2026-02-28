# Payment Processing Module

This module implements the **oldest_due_first** payment allocation algorithm for the Collections module.

## Overview

The oldest_due_first algorithm ensures that payments are applied to installments in the correct priority order:
1. **Overdue installments first** (due_date < today)
2. **Upcoming installments second** (due_date >= today)
3. Within each group, installments are sorted by **due_date ascending** (oldest first)

## Requirements Validated

- **Requirement 7.1**: Applies oldest_due_first algorithm when processing payments
- **Requirement 7.2**: Prioritizes overdue installments before upcoming ones
- **Requirement 7.3**: Handles partial payments (updates paid_amount, keeps status as 'PARTIAL')
- **Requirement 7.4**: Sets status to 'PAID' when payment fully covers an installment

## Files

### `oldest-due-first.ts`
Core implementation of the payment algorithm with TypeScript types.

**Exports:**
- `Installment` - Type definition for installment records
- `UpdatedInstallment` - Type for installment updates after payment
- `PaymentApplicationResult` - Result type containing updated installments and remaining amount
- `sortInstallmentsByDueDate()` - Sorts installments by due date (overdue first)
- `applyPaymentToInstallments()` - Applies payment to installments in order
- `calculateOutstandingDebt()` - Calculates total unpaid amount

### `oldest-due-first.test.ts`
Unit tests for the algorithm (requires Jest to be configured).

### `verify-algorithm.mjs`
Standalone verification script that demonstrates the algorithm working correctly.

**Run verification:**
```bash
node lib/payments/verify-algorithm.mjs
```

## Usage Example

```typescript
import {
  applyPaymentToInstallments,
  sortInstallmentsByDueDate,
  type Installment
} from '@/lib/payments/oldest-due-first'

// Fetch client's unpaid installments
const installments: Installment[] = await fetchClientInstallments(clientId)

// Apply payment using oldest_due_first algorithm
const paymentAmount = 250
const result = applyPaymentToInstallments(paymentAmount, installments)

// Update database with results
for (const updated of result.updatedInstallments) {
  await supabase
    .from('installments')
    .update({
      paid_amount: updated.paid_amount,
      status: updated.status,
      paid_at: updated.paid_at
    })
    .eq('id', updated.id)
}

// Handle remaining amount (if any)
if (result.remainingAmount > 0) {
  console.log(`Excess payment: $${result.remainingAmount}`)
  // Could be refunded or applied to future installments
}
```

## Algorithm Behavior

### Example Scenario

**Installments:**
1. Due: 2024-01-15 (overdue) - $100 unpaid
2. Due: 2024-01-20 (overdue) - $100 unpaid
3. Due: 2024-02-15 (upcoming) - $100 unpaid
4. Due: 2024-03-15 (upcoming) - $100 unpaid

**Payment: $250**

**Result:**
1. Installment #1: $100 paid → Status: PAID ✓
2. Installment #2: $100 paid → Status: PAID ✓
3. Installment #3: $50 paid → Status: PARTIAL (still owes $50)
4. Installment #4: $0 paid → Status: PENDING (untouched)

**Remaining: $0**

### Partial Payment Handling

If an installment already has a partial payment, the new payment is **added** to the existing amount:

**Before:**
- Installment #1: $30 paid of $100 → Status: PARTIAL

**Payment: $70**

**After:**
- Installment #1: $100 paid of $100 → Status: PAID ✓

### Overpayment Handling

If the payment exceeds the total debt, the remaining amount is returned:

**Total debt: $200**
**Payment: $300**

**Result:**
- All installments paid
- Remaining: $100 (to be handled by caller)

## Status Transitions

```
PENDING → PARTIAL → PAID
   ↓         ↓
OVERDUE → PARTIAL → PAID
```

- **PENDING**: No payment made yet, not overdue
- **PARTIAL**: Some payment made, but not fully paid
- **PAID**: Fully paid (paid_amount >= amount)
- **OVERDUE**: Not fully paid and past due date (status updated by separate process)

## Integration Points

This module will be used by:
- `actions/payments.ts` - Server Action for processing payments
- `components/collections/payment-form.tsx` - UI for payment entry
- Task 15.7: processPayment Server Action implementation

## Testing

Run verification to ensure algorithm works correctly:

```bash
cd supa
node lib/payments/verify-algorithm.mjs
```

Expected output shows all 6 test scenarios passing with correct payment allocation.

## Next Steps

- Task 15.7: Implement `processPayment` Server Action using this algorithm
- Task 15.9: Create payment UI components
- Task 15.10: Create payments page with client selector
