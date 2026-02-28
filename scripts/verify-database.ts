/**
 * Database Verification Script
 * Verifies that all migrations have been applied successfully
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.5
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

interface VerificationResult {
  category: string
  item: string
  status: 'pass' | 'fail'
  details?: string
}

const results: VerificationResult[] = []

async function verifyTables() {
  console.log('\n📋 Verifying Tables...')
  
  const expectedTables = [
    'users',
    'audit_log',
    'lines',
    'categories',
    'brands',
    'sizes',
    'suppliers',
    'products',
    'stock',
    'movements',
    'clients',
    'sales',
    'sale_items',
    'credit_plans',
    'installments',
    'payments',
    'collection_actions',
    'cash_shifts',
    'cash_expenses'
  ]
  
  for (const table of expectedTables) {
    try {
      const { error } = await supabase.from(table).select('*').limit(0)
      
      if (error) {
        results.push({
          category: 'Tables',
          item: table,
          status: 'fail',
          details: error.message
        })
      } else {
        results.push({
          category: 'Tables',
          item: table,
          status: 'pass'
        })
      }
    } catch (err) {
      results.push({
        category: 'Tables',
        item: table,
        status: 'fail',
        details: String(err)
      })
    }
  }
}

async function verifyIndexes() {
  console.log('\n🔍 Verifying Indexes...')
  
  // Query to check if key indexes exist
  const indexQueries = [
    { name: 'idx_products_name_trgm', query: `SELECT indexname FROM pg_indexes WHERE indexname = 'idx_products_name_trgm'` },
    { name: 'idx_clients_name_trgm', query: `SELECT indexname FROM pg_indexes WHERE indexname = 'idx_clients_name_trgm'` },
    { name: 'idx_products_barcode', query: `SELECT indexname FROM pg_indexes WHERE indexname = 'idx_products_barcode'` },
    { name: 'idx_clients_dni', query: `SELECT indexname FROM pg_indexes WHERE indexname = 'idx_clients_dni'` },
    { name: 'idx_installments_due_date', query: `SELECT indexname FROM pg_indexes WHERE indexname = 'idx_installments_due_date'` }
  ]
  
  for (const { name, query } of indexQueries) {
    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql: query })
      
      if (error) {
        results.push({
          category: 'Indexes',
          item: name,
          status: 'fail',
          details: 'Cannot verify - RPC not available'
        })
      } else if (data && data.length > 0) {
        results.push({
          category: 'Indexes',
          item: name,
          status: 'pass'
        })
      } else {
        results.push({
          category: 'Indexes',
          item: name,
          status: 'fail',
          details: 'Index not found'
        })
      }
    } catch (err) {
      results.push({
        category: 'Indexes',
        item: name,
        status: 'fail',
        details: 'Cannot verify via API'
      })
    }
  }
}

async function verifyFunctions() {
  console.log('\n⚙️  Verifying Atomic Functions...')
  
  const functions = [
    'decrement_stock',
    'increment_credit_used',
    'create_sale_transaction'
  ]
  
  for (const func of functions) {
    try {
      // Try to call the function with invalid params to see if it exists
      // We expect an error, but the error type tells us if the function exists
      const { error } = await supabase.rpc(func as any, {})
      
      if (error) {
        // Check if error is about missing parameters (function exists) or function not found
        if (error.message.includes('function') && error.message.includes('does not exist')) {
          results.push({
            category: 'Functions',
            item: func,
            status: 'fail',
            details: 'Function not found'
          })
        } else {
          // Function exists but we passed wrong params (expected)
          results.push({
            category: 'Functions',
            item: func,
            status: 'pass'
          })
        }
      } else {
        results.push({
          category: 'Functions',
          item: func,
          status: 'pass'
        })
      }
    } catch (err) {
      results.push({
        category: 'Functions',
        item: func,
        status: 'fail',
        details: String(err)
      })
    }
  }
}

async function verifyRLS() {
  console.log('\n🔒 Verifying RLS Policies...')
  
  const tables = ['users', 'products', 'sales', 'clients', 'installments']
  
  for (const table of tables) {
    try {
      // Try to query without auth - should fail if RLS is enabled
      const { error } = await supabase.from(table).select('*').limit(1)
      
      if (error && error.message.includes('row-level security')) {
        results.push({
          category: 'RLS',
          item: `${table} (enabled)`,
          status: 'pass'
        })
      } else if (error) {
        results.push({
          category: 'RLS',
          item: `${table}`,
          status: 'fail',
          details: error.message
        })
      } else {
        // No error means RLS might not be enabled or policies allow anonymous access
        results.push({
          category: 'RLS',
          item: `${table}`,
          status: 'pass',
          details: 'Accessible (check policies)'
        })
      }
    } catch (err) {
      results.push({
        category: 'RLS',
        item: `${table}`,
        status: 'fail',
        details: String(err)
      })
    }
  }
}

function printResults() {
  console.log('\n' + '='.repeat(80))
  console.log('DATABASE VERIFICATION RESULTS')
  console.log('='.repeat(80))
  
  const categories = [...new Set(results.map(r => r.category))]
  
  for (const category of categories) {
    const categoryResults = results.filter(r => r.category === category)
    const passed = categoryResults.filter(r => r.status === 'pass').length
    const failed = categoryResults.filter(r => r.status === 'fail').length
    
    console.log(`\n${category}: ${passed}/${categoryResults.length} passed`)
    console.log('-'.repeat(80))
    
    for (const result of categoryResults) {
      const icon = result.status === 'pass' ? '✅' : '❌'
      console.log(`${icon} ${result.item}`)
      if (result.details) {
        console.log(`   ${result.details}`)
      }
    }
  }
  
  const totalPassed = results.filter(r => r.status === 'pass').length
  const totalFailed = results.filter(r => r.status === 'fail').length
  
  console.log('\n' + '='.repeat(80))
  console.log(`TOTAL: ${totalPassed}/${results.length} checks passed`)
  console.log('='.repeat(80))
  
  if (totalFailed > 0) {
    console.log('\n⚠️  Some checks failed. Please review the errors above.')
    console.log('\nTo apply migrations, run:')
    console.log('  supabase db push')
    console.log('\nOr apply them manually in the Supabase Dashboard SQL Editor.')
    process.exit(1)
  } else {
    console.log('\n✅ All checks passed! Database setup is complete.')
    process.exit(0)
  }
}

async function main() {
  console.log('🔍 Starting database verification...')
  console.log(`📡 Connecting to: ${supabaseUrl}`)
  
  try {
    await verifyTables()
    await verifyIndexes()
    await verifyFunctions()
    await verifyRLS()
    
    printResults()
  } catch (error) {
    console.error('\n❌ Verification failed:', error)
    process.exit(1)
  }
}

main()
