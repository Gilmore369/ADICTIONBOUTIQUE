# Services

This directory contains business logic services for the CRM system.

## Rating Service

The rating service calculates client ratings based on their payment behavior and purchase history.

### Usage

```typescript
import { calculateClientRating } from '@/lib/services/rating-service'

// Calculate rating for a client
const rating = await calculateClientRating('client-uuid-123')

console.log(`Client Rating: ${rating.rating}`) // A, B, C, or D
console.log(`Score: ${rating.score}/100`)
console.log(`Payment Punctuality: ${rating.payment_punctuality}%`)
console.log(`Purchase Frequency Score: ${rating.purchase_frequency}`)
console.log(`Total Purchases: ${rating.total_purchases}`)
console.log(`Client Tenure: ${rating.client_tenure_days} days`)
```

### Rating Algorithm

The rating is calculated using a weighted formula:

- **Payment Punctuality (40%)**: Percentage of installments paid on or before due date
- **Purchase Frequency (30%)**: Number of purchases per month, normalized to 0-100 scale
- **Total Purchase Amount (20%)**: Total amount spent, normalized to 0-100 scale
- **Client Tenure (10%)**: Days since first purchase, normalized to 0-100 scale

### Rating Categories

| Category | Score Range | Description |
|----------|-------------|-------------|
| A        | 90-100      | Excellent   |
| B        | 70-89       | Good        |
| C        | 50-69       | Regular     |
| D        | 0-49        | Poor        |

### Edge Cases

- **No Purchase History**: Clients with no purchases receive a default rating of C (50 points)
- **No Payment History**: If a client has purchases but no installments, payment punctuality defaults to 50
- **New Clients**: Tenure score increases gradually as the client relationship matures

### Example Scenarios

#### Excellent Client (Rating A)
- All payments made on time (100% punctuality)
- 5+ purchases per month
- High total purchase amount
- Long-term client (1+ year)

#### Poor Client (Rating D)
- Frequent late payments (< 50% punctuality)
- Infrequent purchases (< 1 per month)
- Low total purchase amount
- New or inactive client

### Integration

To update a client's rating in the database:

```typescript
import { calculateClientRating } from '@/lib/services/rating-service'
import { createServerClient } from '@/lib/supabase/server'

async function updateClientRating(clientId: string) {
  const rating = await calculateClientRating(clientId)
  const supabase = await createServerClient()
  
  await supabase
    .from('clients')
    .update({
      rating: rating.rating,
      rating_score: rating.score
    })
    .eq('id', clientId)
  
  return rating
}
```
