# Setup Guide - Adiction Boutique Suite

This guide walks you through setting up the Next.js + Supabase infrastructure.

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Supabase account (free tier available at https://supabase.com)
- Git (optional, for version control)

## Step 1: Supabase Project Setup

### 1.1 Create Supabase Project

1. Go to https://supabase.com and sign in
2. Click "New Project"
3. Fill in project details:
   - **Name**: adiction-boutique-suite
   - **Database Password**: (generate a strong password and save it)
   - **Region**: Choose closest to your location
4. Click "Create new project" and wait for provisioning (~2 minutes)

### 1.2 Get API Credentials

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (under "Project URL")
   - **anon/public key** (under "Project API keys")

### 1.3 Configure Environment Variables

1. In the `supa` directory, copy the example file:
   ```bash
   cp .env.local.example .env.local
   ```

2. Edit `.env.local` and replace with your actual values:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

## Step 2: Install Dependencies

All dependencies are already installed during task 1 execution. If you need to reinstall:

```bash
cd supa
npm install
```

### Installed Packages

**Core:**
- `next` - Next.js 14 framework
- `react` & `react-dom` - React 18
- `typescript` - TypeScript support

**Supabase:**
- `@supabase/supabase-js` - Supabase JavaScript client
- `@supabase/ssr` - Supabase SSR helpers for Next.js

**UI & Forms:**
- `tailwindcss` - Utility-first CSS framework
- `shadcn/ui` components - Pre-built accessible components
- `react-hook-form` - Form state management
- `zod` - Schema validation
- `@hookform/resolvers` - Zod integration for React Hook Form

**State & Data:**
- `@tanstack/react-query` - Client-side caching and data fetching
- `date-fns` - Date manipulation utilities

## Step 3: Verify Installation

### 3.1 Check Project Structure

Verify the following directories exist:
```
supa/
├── app/
├── components/
│   ├── ui/
│   ├── catalogs/
│   ├── pos/
│   ├── debt/
│   ├── collections/
│   ├── map/
│   └── shared/
├── lib/
│   ├── supabase/
│   ├── validations/
│   └── auth/
├── hooks/
├── actions/
├── types/
└── config/
```

### 3.2 Verify Design Tokens

Check that `app/globals.css` includes design tokens:
- Spacing scale: 4px, 8px, 12px, 16px, 24px, 32px
- Border radius: 8px (standard), 999px (pills)

### 3.3 Run Development Server

```bash
npm run dev
```

Open http://localhost:3000 - you should see the Next.js welcome page.

## Step 4: Next Steps

The infrastructure is now ready! The next tasks will:

1. **Task 2**: Create PostgreSQL database schema (19 tables)
2. **Task 4**: Implement authentication and RBAC
3. **Task 6-9**: Build Catalog module
4. **Task 11-12**: Build POS module
5. **Task 14-16**: Build Debt and Collections modules
6. **Task 18**: Build Map module

## Design System Reference

### Spacing (8px base)
```tsx
// Use design tokens from config/design-tokens.ts
import { designTokens } from '@/config/design-tokens'

// In Tailwind: p-1 (4px), p-2 (8px), p-3 (12px), p-4 (16px), p-6 (24px), p-8 (32px)
<div className="p-4 gap-2">
```

### Border Radius
```tsx
// Standard: rounded-lg (8px)
<Card className="rounded-lg">

// Pills: rounded-full (999px)
<Badge className="rounded-full">
```

### Components
```tsx
// Button: h-9 (36px), px-4 py-3 (16px × 12px)
<Button className="h-9 px-4">

// Card: p-4 (16px), border
<Card className="p-4 border">
```

## Performance Guidelines

### Debounced Search (300ms)
```tsx
import { useDebounce } from '@/hooks/use-debounce'

const [search, setSearch] = useState('')
const debouncedSearch = useDebounce(search, 300)
```

### Search Limits (50 results)
```tsx
const { data } = await fetch(`/api/products/search?q=${query}&limit=50`)
```

### React Query Caching
```tsx
// Catalogs: 1 hour staleTime
useQuery({
  queryKey: ['products'],
  queryFn: fetchProducts,
  staleTime: 3600000, // 1 hour
})

// Products: 5 minutes staleTime
useQuery({
  queryKey: ['product', id],
  queryFn: () => fetchProduct(id),
  staleTime: 300000, // 5 minutes
})
```

## Troubleshooting

### Issue: "Module not found" errors
**Solution**: Run `npm install` again to ensure all dependencies are installed.

### Issue: Supabase connection fails
**Solution**: 
1. Verify `.env.local` has correct credentials
2. Check that Supabase project is active (not paused)
3. Ensure `NEXT_PUBLIC_` prefix is present on environment variables

### Issue: TypeScript errors in Supabase client files
**Solution**: The `types/database.ts` file is a placeholder. It will be generated from the actual database schema in Task 2.

### Issue: Port 3000 already in use
**Solution**: 
```bash
# Use a different port
npm run dev -- -p 3001
```

## Additional Resources

- [Next.js 14 Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com)
- [React Query Documentation](https://tanstack.com/query/latest)
- [Zod Documentation](https://zod.dev)

## Support

For issues or questions:
1. Check the [Requirements Document](../.kiro/specs/migracion-supabase/requirements.md)
2. Review the [Design Document](../.kiro/specs/migracion-supabase/design.md)
3. Consult the [Implementation Tasks](../.kiro/specs/migracion-supabase/tasks.md)

---

✅ Infrastructure setup complete! Ready for Task 2: Database Schema Creation.
