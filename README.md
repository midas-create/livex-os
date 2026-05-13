# LiveX Supply — B2B Office Supplies Platform

A modern, professional B2B ordering platform for office supplies. Built with Next.js 14, Supabase, Tailwind CSS, and shadcn/ui.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Backend**: Supabase (Auth + PostgreSQL)
- **Toast**: Sonner

## Getting Started

### 1. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `supabase/schema.sql`
3. In **Authentication > Settings**, configure your email auth settings

### 2. Configure environment variables

Copy `.env.local` and fill in your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Both values are found in your Supabase project: **Settings > API**.

### 3. Create user accounts

In Supabase **Authentication > Users**, create users. The trigger in `schema.sql` auto-populates the `users` table, but you should also set `company_name` and `role` manually in the `users` table for now, or use the SQL editor:

```sql
-- Create an admin user (after signing up via the app or Supabase dashboard)
UPDATE public.users 
SET role = 'admin', company_name = 'LiveX Supply Co.' 
WHERE email = 'admin@yourcompany.com';

-- Set company name for a client
UPDATE public.users 
SET company_name = 'Acme Corp' 
WHERE email = 'client@acmecorp.com';
```

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Application Structure

```
src/
├── app/
│   ├── (dashboard)/          # Client-facing pages
│   │   ├── dashboard/        # Product catalog
│   │   ├── cart/             # Shopping cart + order validation
│   │   └── orders/           # Order history
│   ├── (admin)/              # Admin pages
│   │   └── admin/
│   │       ├── page.tsx      # Admin overview / stats
│   │       ├── products/     # Product management
│   │       └── orders/       # Order management
│   └── login/                # Authentication
├── components/
│   ├── layout/               # AppHeader
│   ├── products/             # ProductCard
│   ├── cart/                 # CartItemRow
│   ├── orders/               # OrderDetailsModal
│   └── ui/                   # shadcn components
├── context/
│   └── CartContext.tsx        # Cart state management
├── hooks/
│   └── useUser.ts             # Current user hook
└── lib/
    ├── supabase/              # Supabase clients (browser + server)
    ├── types.ts               # TypeScript types
    └── utils.ts               # Utilities
```

## User Roles

| Role   | Access |
|--------|--------|
| client | Browse catalog, manage cart, place & view own orders |
| admin  | All client access + manage products, stock, all orders |

## Key Features

- **Product Catalog** — search, filter by category/subcategory, live stock display
- **Cart System** — quantity controls, stock validation, persistent during session
- **Order Validation** — firm commitment flow with confirmation dialog
- **Admin Dashboard** — stats overview, product CRUD, order status management
- **Auth** — Supabase Auth with automatic user profile creation

## Future Ready

The codebase is structured to support:
- Pricing tiers per client
- Recurring/scheduled orders
- Subscription bundles
- Email notifications (via Supabase Edge Functions)
