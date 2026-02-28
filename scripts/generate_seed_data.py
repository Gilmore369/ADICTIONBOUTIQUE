#!/usr/bin/env python3
"""
Generate 3 months of seed data for testing
December 2025 - February 2026

This script generates:
- Cash shifts (daily)
- Sales (cash and credit)
- Credit plans and installments
- Payments
- Cash expenses
- Collection actions
"""

import random
import uuid
from datetime import datetime, timedelta
from decimal import Decimal

# Configuration
START_DATE = datetime(2025, 12, 1)
END_DATE = datetime(2026, 2, 28)
STORES = ['TIENDA_PRINCIPAL', 'TIENDA_SUCURSAL_1', 'TIENDA_SUCURSAL_2']
USER_ID = 'USER_ID_PLACEHOLDER'  # Replace with actual user ID

# Product IDs (you'll need to get these from your database)
PRODUCT_IDS = [f'prod-{i:04d}' for i in range(1, 51)]

# Client IDs (from seed data)
CLIENT_IDS = [f'c1000000-0000-0000-0000-{i:012d}' for i in range(1, 51)]

def generate_uuid():
    return str(uuid.uuid4())

def random_date_between(start, end):
    delta = end - start
    random_days = random.randint(0, delta.days)
    random_seconds = random.randint(0, 86400)
    return start + timedelta(days=random_days, seconds=random_seconds)

def generate_cash_shifts():
    """Generate daily cash shifts for each store"""
    shifts = []
    current_date = START_DATE
    
    while current_date <= END_DATE:
        for store in STORES:
            shift_id = generate_uuid()
            opening_amount = random.uniform(500, 1000)
            
            # Opening time: 8-9 AM
            opened_at = current_date.replace(hour=random.randint(8, 9), minute=random.randint(0, 59))
            
            # Closing time: 6-8 PM
            closed_at = current_date.replace(hour=random.randint(18, 20), minute=random.randint(0, 59))
            
            # Calculate sales for this shift (will be filled later)
            daily_sales = random.uniform(2000, 8000)
            daily_expenses = random.uniform(100, 500)
            
            expected_amount = opening_amount + daily_sales - daily_expenses
            closing_amount = expected_amount + random.uniform(-50, 50)  # Small variance
            difference = closing_amount - expected_amount
            
            shifts.append({
                'id': shift_id,
                'store_id': store,
                'user_id': USER_ID,
                'opening_amount': round(opening_amount, 2),
                'closing_amount': round(closing_amount, 2),
                'expected_amount': round(expected_amount, 2),
                'difference': round(difference, 2),
                'opened_at': opened_at.isoformat(),
                'closed_at': closed_at.isoformat(),
                'status': 'CLOSED',
                'daily_sales': round(daily_sales, 2),
                'daily_expenses': round(daily_expenses, 2)
            })
        
        current_date += timedelta(days=1)
    
    return shifts

def generate_sales(shifts):
    """Generate sales for each shift"""
    sales = []
    sale_items = []
    sale_number = 1
    
    for shift in shifts:
        # Generate 10-30 sales per shift
        num_sales = random.randint(10, 30)
        shift_sales_total = 0
        
        shift_start = datetime.fromisoformat(shift['opened_at'])
        shift_end = datetime.fromisoformat(shift['closed_at'])
        
        for _ in range(num_sales):
            sale_id = generate_uuid()
            client_id = random.choice(CLIENT_IDS) if random.random() > 0.3 else None
            payment_method = random.choice(['CASH', 'CASH', 'CASH', 'CREDIT'])  # 75% cash
            
            # Generate 1-5 items per sale
            num_items = random.randint(1, 5)
            sale_total = 0
            
            for _ in range(num_items):
                item_id = generate_uuid()
                product_id = random.choice(PRODUCT_IDS)
                quantity = random.randint(1, 3)
                unit_price = random.uniform(20, 200)
                subtotal = quantity * unit_price
                sale_total += subtotal
                
                sale_items.append({
                    'id': item_id,
                    'sale_id': sale_id,
                    'product_id': product_id,
                    'quantity': quantity,
                    'unit_price': round(unit_price, 2),
                    'subtotal': round(subtotal, 2)
                })
            
            sale_date = random_date_between(shift_start, shift_end)
            
            sales.append({
                'id': sale_id,
                'sale_number': sale_number,
                'client_id': client_id,
                'user_id': USER_ID,
                'payment_method': payment_method,
                'subtotal': round(sale_total, 2),
                'tax': round(sale_total * 0.18, 2),
                'total': round(sale_total * 1.18, 2),
                'created_at': sale_date.isoformat()
            })
            
            shift_sales_total += sale_total * 1.18
            sale_number += 1
        
        # Update shift with actual sales total
        shift['daily_sales'] = round(shift_sales_total, 2)
    
    return sales, sale_items

def generate_cash_expenses(shifts):
    """Generate cash expenses for each shift"""
    expenses = []
    categories = ['SERVICIOS', 'COMPRAS', 'MANTENIMIENTO', 'TRANSPORTE', 'OTROS']
    
    for shift in shifts:
        # Generate 1-5 expenses per shift
        num_expenses = random.randint(1, 5)
        shift_expenses_total = 0
        
        for _ in range(num_expenses):
            expense_id = generate_uuid()
            category = random.choice(categories)
            amount = random.uniform(20, 150)
            shift_expenses_total += amount
            
            expenses.append({
                'id': expense_id,
                'shift_id': shift['id'],
                'user_id': USER_ID,
                'amount': round(amount, 2),
                'category': category,
                'description': f'Gasto de {category.lower()}',
                'created_at': random_date_between(
                    datetime.fromisoformat(shift['opened_at']),
                    datetime.fromisoformat(shift['closed_at'])
                ).isoformat()
            })
        
        # Update shift with actual expenses total
        shift['daily_expenses'] = round(shift_expenses_total, 2)
    
    return expenses

def generate_credit_plans_and_installments(sales):
    """Generate credit plans for credit sales"""
    credit_plans = []
    installments = []
    
    credit_sales = [s for s in sales if s['payment_method'] == 'CREDIT' and s['client_id']]
    
    for sale in credit_sales:
        plan_id = generate_uuid()
        num_installments = random.choice([2, 3, 4, 6])
        installment_amount = sale['total'] / num_installments
        
        credit_plans.append({
            'id': plan_id,
            'client_id': sale['client_id'],
            'sale_id': sale['id'],
            'total_amount': sale['total'],
            'installments_count': num_installments,
            'installment_amount': round(installment_amount, 2),
            'status': 'ACTIVE',
            'created_at': sale['created_at']
        })
        
        # Generate installments
        sale_date = datetime.fromisoformat(sale['created_at'])
        for i in range(num_installments):
            installment_id = generate_uuid()
            due_date = sale_date + timedelta(days=30 * (i + 1))
            
            # Randomly mark some as paid
            is_paid = random.random() > 0.3 and due_date < datetime.now()
            paid_amount = installment_amount if is_paid else 0
            status = 'PAID' if is_paid else ('OVERDUE' if due_date < datetime.now() else 'PENDING')
            
            installments.append({
                'id': installment_id,
                'credit_plan_id': plan_id,
                'installment_number': i + 1,
                'amount': round(installment_amount, 2),
                'paid_amount': round(paid_amount, 2),
                'due_date': due_date.date().isoformat(),
                'status': status
            })
    
    return credit_plans, installments

def generate_payments(installments):
    """Generate payments for paid installments"""
    payments = []
    
    paid_installments = [i for i in installments if i['status'] == 'PAID']
    
    for inst in paid_installments:
        payment_id = generate_uuid()
        due_date = datetime.fromisoformat(inst['due_date'])
        # Payment made 0-5 days after due date
        payment_date = due_date + timedelta(days=random.randint(0, 5))
        
        payments.append({
            'id': payment_id,
            'installment_id': inst['id'],
            'amount': inst['paid_amount'],
            'payment_method': random.choice(['CASH', 'TRANSFER', 'CARD']),
            'user_id': USER_ID,
            'created_at': payment_date.isoformat()
        })
    
    return payments

def generate_sql_inserts(table_name, records):
    """Generate SQL INSERT statements"""
    if not records:
        return ""
    
    columns = list(records[0].keys())
    sql = f"INSERT INTO {table_name} ({', '.join(columns)}) VALUES\n"
    
    values = []
    for record in records:
        value_list = []
        for col in columns:
            val = record[col]
            if val is None:
                value_list.append('NULL')
            elif isinstance(val, (int, float)):
                value_list.append(str(val))
            else:
                # Escape single quotes
                val_str = str(val).replace("'", "''")
                value_list.append(f"'{val_str}'")
        values.append(f"({', '.join(value_list)})")
    
    sql += ',\n'.join(values) + ';\n\n'
    return sql

def main():
    print("Generating seed data...")
    
    # Generate all data
    print("Generating cash shifts...")
    shifts = generate_cash_shifts()
    
    print("Generating sales...")
    sales, sale_items = generate_sales(shifts)
    
    print("Generating cash expenses...")
    expenses = generate_cash_expenses(shifts)
    
    print("Generating credit plans and installments...")
    credit_plans, installments = generate_credit_plans_and_installments(sales)
    
    print("Generating payments...")
    payments = generate_payments(installments)
    
    # Generate SQL file
    print("Writing SQL file...")
    with open('supabase/seed_data_complete.sql', 'w', encoding='utf-8') as f:
        f.write("-- ============================================================================\n")
        f.write("-- COMPLETE SEED DATA: 3 MONTHS (December 2025 - February 2026)\n")
        f.write("-- ============================================================================\n")
        f.write("-- Generated data includes:\n")
        f.write(f"-- - {len(shifts)} cash shifts\n")
        f.write(f"-- - {len(sales)} sales\n")
        f.write(f"-- - {len(sale_items)} sale items\n")
        f.write(f"-- - {len(expenses)} cash expenses\n")
        f.write(f"-- - {len(credit_plans)} credit plans\n")
        f.write(f"-- - {len(installments)} installments\n")
        f.write(f"-- - {len(payments)} payments\n")
        f.write("-- ============================================================================\n\n")
        
        f.write("-- IMPORTANT: Replace 'USER_ID_PLACEHOLDER' with your actual user ID\n")
        f.write("-- Get it with: SELECT id FROM users LIMIT 1;\n\n")
        
        f.write("-- Disable triggers for faster insertion\n")
        f.write("SET session_replication_role = 'replica';\n\n")
        
        f.write("-- ============================================================================\n")
        f.write("-- CASH SHIFTS\n")
        f.write("-- ============================================================================\n\n")
        # Remove daily_sales and daily_expenses from shifts (they were just for calculation)
        for shift in shifts:
            del shift['daily_sales']
            del shift['daily_expenses']
        f.write(generate_sql_inserts('cash_shifts', shifts))
        
        f.write("-- ============================================================================\n")
        f.write("-- SALES\n")
        f.write("-- ============================================================================\n\n")
        f.write(generate_sql_inserts('sales', sales))
        
        f.write("-- ============================================================================\n")
        f.write("-- SALE ITEMS\n")
        f.write("-- ============================================================================\n\n")
        f.write(generate_sql_inserts('sale_items', sale_items))
        
        f.write("-- ============================================================================\n")
        f.write("-- CASH EXPENSES\n")
        f.write("-- ============================================================================\n\n")
        f.write(generate_sql_inserts('cash_expenses', expenses))
        
        f.write("-- ============================================================================\n")
        f.write("-- CREDIT PLANS\n")
        f.write("-- ============================================================================\n\n")
        f.write(generate_sql_inserts('credit_plans', credit_plans))
        
        f.write("-- ============================================================================\n")
        f.write("-- INSTALLMENTS\n")
        f.write("-- ============================================================================\n\n")
        f.write(generate_sql_inserts('installments', installments))
        
        f.write("-- ============================================================================\n")
        f.write("-- PAYMENTS\n")
        f.write("-- ============================================================================\n\n")
        f.write(generate_sql_inserts('payments', payments))
        
        f.write("-- Re-enable triggers\n")
        f.write("SET session_replication_role = 'origin';\n\n")
        
        f.write("-- Update client credit_used based on credit plans\n")
        f.write("UPDATE clients SET credit_used = (\n")
        f.write("  SELECT COALESCE(SUM(total_amount), 0)\n")
        f.write("  FROM credit_plans\n")
        f.write("  WHERE credit_plans.client_id = clients.id\n")
        f.write("  AND credit_plans.status = 'ACTIVE'\n")
        f.write(");\n\n")
        
        f.write("-- Update client last_purchase_date\n")
        f.write("UPDATE clients SET last_purchase_date = (\n")
        f.write("  SELECT MAX(created_at::date)\n")
        f.write("  FROM sales\n")
        f.write("  WHERE sales.client_id = clients.id\n")
        f.write(");\n")
    
    print(f"\n✅ Seed data generated successfully!")
    print(f"📁 File: supabase/seed_data_complete.sql")
    print(f"\n📊 Statistics:")
    print(f"   - Cash shifts: {len(shifts)}")
    print(f"   - Sales: {len(sales)}")
    print(f"   - Sale items: {len(sale_items)}")
    print(f"   - Cash expenses: {len(expenses)}")
    print(f"   - Credit plans: {len(credit_plans)}")
    print(f"   - Installments: {len(installments)}")
    print(f"   - Payments: {len(payments)}")
    print(f"\n⚠️  Remember to:")
    print(f"   1. Replace 'USER_ID_PLACEHOLDER' with your actual user ID")
    print(f"   2. Ensure you have products in your database")
    print(f"   3. Run the seed_data_3_months.sql first to create clients")

if __name__ == '__main__':
    main()
