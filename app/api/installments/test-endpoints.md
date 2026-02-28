# Installments API Endpoints - Testing Guide

## Endpoints Created

### 1. Overdue Installments
**Endpoint:** `GET /api/installments/overdue`

**Description:** Fetches installments where `due_date < current_date` and status is 'PENDING', 'PARTIAL', or 'OVERDUE'

**Query Parameters:**
- `client_id` (optional): Filter by client UUID
- `status` (optional): Filter by status (pending, partial, overdue)
- `limit` (optional): Maximum results (default: 50, max: 100)

**Example Requests:**
```bash
# Get all overdue installments
GET /api/installments/overdue

# Get overdue installments for specific client
GET /api/installments/overdue?client_id=uuid-here

# Get overdue installments with specific status
GET /api/installments/overdue?status=pending&limit=20
```

**Response Format:**
```json
{
  "data": [
    {
      "id": "uuid",
      "plan_id": "uuid",
      "installment_number": 1,
      "amount": 100.00,
      "due_date": "2024-01-15",
      "paid_amount": 0.00,
      "status": "OVERDUE",
      "paid_at": null,
      "credit_plans": {
        "id": "uuid",
        "sale_id": "uuid",
        "client_id": "uuid",
        "total_amount": 300.00,
        "installments_count": 3,
        "status": "ACTIVE",
        "clients": {
          "id": "uuid",
          "name": "Cliente Name",
          "dni": "12345678",
          "phone": "999999999",
          "credit_limit": 1000.00,
          "credit_used": 300.00
        },
        "sales": {
          "id": "uuid",
          "sale_number": "V-123456",
          "total": 300.00,
          "created_at": "2024-01-01T00:00:00Z"
        }
      }
    }
  ]
}
```

### 2. Upcoming Installments
**Endpoint:** `GET /api/installments/upcoming`

**Description:** Fetches installments where `due_date >= current_date` and status is 'PENDING' or 'PARTIAL'

**Query Parameters:**
- `client_id` (optional): Filter by client UUID
- `status` (optional): Filter by status (pending, partial)
- `days` (optional): Number of days ahead to look (default: 30)
- `limit` (optional): Maximum results (default: 50, max: 100)

**Example Requests:**
```bash
# Get upcoming installments for next 30 days
GET /api/installments/upcoming

# Get upcoming installments for next 7 days
GET /api/installments/upcoming?days=7

# Get upcoming installments for specific client
GET /api/installments/upcoming?client_id=uuid-here&days=15

# Get upcoming installments with specific status
GET /api/installments/upcoming?status=pending&limit=20
```

**Response Format:**
```json
{
  "data": [
    {
      "id": "uuid",
      "plan_id": "uuid",
      "installment_number": 2,
      "amount": 100.00,
      "due_date": "2024-02-15",
      "paid_amount": 0.00,
      "status": "PENDING",
      "paid_at": null,
      "credit_plans": {
        "id": "uuid",
        "sale_id": "uuid",
        "client_id": "uuid",
        "total_amount": 300.00,
        "installments_count": 3,
        "status": "ACTIVE",
        "clients": {
          "id": "uuid",
          "name": "Cliente Name",
          "dni": "12345678",
          "phone": "999999999",
          "credit_limit": 1000.00,
          "credit_used": 300.00
        },
        "sales": {
          "id": "uuid",
          "sale_number": "V-123456",
          "total": 300.00,
          "created_at": "2024-01-01T00:00:00Z"
        }
      }
    }
  ]
}
```

## Features Implemented

✅ Filter by client_id (optional query param)
✅ Filter by status (pending, partial, overdue for overdue; pending, partial for upcoming)
✅ Filter by due_date (overdue: < today, upcoming: >= today and <= today + days)
✅ Return installments with client and plan information (nested joins)
✅ Order by due_date ascending (oldest/nearest first)
✅ Use Supabase server client
✅ Enforce LIMIT (max 100 results)
✅ Error handling with descriptive messages

## Requirements Validated

- **Requirement 6.7:** THE Debt_Module SHALL mark installments as overdue when due_date < current_date and status = 'pending'
  - ✅ Overdue endpoint filters by `due_date < today` and status in ['PENDING', 'PARTIAL', 'OVERDUE']
  - ✅ Upcoming endpoint filters by `due_date >= today` and status in ['PENDING', 'PARTIAL']

## Testing Checklist

- [ ] Test overdue endpoint without filters
- [ ] Test overdue endpoint with client_id filter
- [ ] Test overdue endpoint with status filter
- [ ] Test upcoming endpoint without filters
- [ ] Test upcoming endpoint with days parameter
- [ ] Test upcoming endpoint with client_id filter
- [ ] Test limit enforcement (try requesting > 100)
- [ ] Verify nested data includes client and sale information
- [ ] Verify ordering by due_date ascending
- [ ] Test error handling with invalid parameters
