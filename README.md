# Bharath Forklift — Enterprise CMS

A full-stack, enterprise-grade Company Management System built with **Next.js 14**, **Supabase**, and **Tailwind CSS**.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, JavaScript) |
| Database & Auth | Supabase (PostgreSQL + Auth) |
| Styling | Tailwind CSS |
| State | React Context API + Zustand |
| Forms | React Hook Form |
| Charts | Recharts |
| PDF | jsPDF + jspdf-autotable |
| Excel | SheetJS (xlsx) |
| Theme | next-themes (dark/light) |
| Toasts | react-hot-toast |

---

## Features

### Authentication
- Login / Logout / Forgot Password / Change Password
- Session persistence via Supabase Auth
- Middleware route protection
- Role-based access control (RBAC)

### Modules
| Module | Description |
|---|---|
| Dashboard | KPI cards, sales charts, alerts, recent activity |
| Customers | CRUD, credit tracking, invoice history |
| Suppliers | CRUD, payment & purchase history |
| Products | CRUD, stock management, transaction history, restock |
| Purchase | Multi-product POs, auto stock increase, PDF |
| Quotations | Builder, duplicate, convert to invoice, PDF |
| Invoices | Manual + from quotation, partial payments, PDF |
| Vehicles | Fleet management, insurance expiry alerts |
| Delivery Challans | Rental & contract, PDF, expiry alerts |
| Maintenance | Service records, reminders, cost tracking |
| Reports | Sales/Purchase/Inventory/Customer/Vehicle/Maintenance charts + Excel export |
| User Management | RBAC, role/permission editor, activity logs |
| Profile | Avatar, name, password change |
| Settings | Company info, invoice config, tax/currency |

### RBAC Architecture
- Fully dynamic — no hardcoded permissions in code
- `roles` → `role_permissions` → `permissions` tables
- New roles created from admin panel, no code changes needed
- Seeded roles: **Admin**, **Sales**, **Vehicle Manager**

---

## Quick Start

### 1. Create Supabase Project
Go to [supabase.com](https://supabase.com) and create a new project.

### 2. Run Database Schema
In **Supabase SQL Editor**, paste and run the entire contents of:
```
supabase-schema.sql
```
This creates all tables, indexes, RLS policies, seeds permissions/roles, and company settings.

### 3. Create Storage Buckets
In Supabase → Storage, create two buckets:
- `profiles` — for user avatars (public)
- `company` — for company logo (public)

### 4. Configure Environment Variables
```bash
cp .env.local.example .env.local
```
Edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 5. Create Admin User
In **Supabase → Authentication → Users**, create a user manually with email + password.

Then in **SQL Editor**, link the user to a profile:
```sql
-- Replace with your actual auth user ID and role ID
INSERT INTO users (auth_user_id, name, email, role_id)
SELECT
  '<your-auth-user-id>',
  'Admin User',
  '<your-email>',
  id
FROM roles WHERE role_name = 'admin';
```

### 6. Install & Run
```bash
npm install
npm run dev
```

Visit: [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
src/
├── app/
│   ├── login/                  # Auth pages
│   ├── forgot-password/
│   ├── unauthorized/
│   ├── dashboard/              # Main layout + dashboard
│   ├── customers/
│   ├── suppliers/
│   ├── products/
│   ├── purchase/
│   ├── quotations/
│   ├── invoices/
│   ├── vehicles/
│   ├── delivery-challans/
│   ├── maintenance/
│   ├── reports/
│   ├── users/
│   ├── profile/
│   └── settings/
├── components/
│   └── shared/                 # Reusable UI components
│       └── index.js            # DataTable, Modal, Pagination, StatCard, etc.
├── contexts/
│   └── AuthContext.js          # Auth + RBAC context
├── lib/
│   ├── supabase/client.js      # Browser + server clients
│   ├── hooks/index.js          # useTableData, useDashboardStats, etc.
│   ├── pdf/generators.js       # Invoice, Quotation, Challan, Purchase PDFs
│   └── excel/exporters.js      # Excel export utility
├── middleware.js               # Route protection middleware
└── styles/globals.css          # Tailwind + custom CSS classes
```

---

## Role Permissions Reference

### Admin
Full access to all modules.

### Sales
`view_dashboard`, `view/create/edit_customer`, `view_product`, `view_supplier`,
`create/edit/view_purchase`, `create/edit/view/delete_quotation`,
`create/edit/view_invoice`

### Vehicle Manager
`view_dashboard`, `view/create/edit/delete_vehicle`,
`create/edit/view_challan`, `create/edit/view_maintenance`

### Adding New Roles
1. In Supabase SQL Editor:
```sql
INSERT INTO roles (role_name, description) VALUES ('accountant', 'Finance team member');
```
2. Go to **User Management** → click the shield icon on the new role → assign permissions.
3. Assign users to this role. No code changes needed.

---

## PDF Documents
All PDFs use the Bharath Forklift brand color (orange `#ea580c`) with:
- Company header with logo area, GST, address
- Customer/party details
- Line items table with tax breakdown
- Totals section
- Signature lines (challans)

---

## Key Design Decisions

- **Soft deletes** everywhere — `deleted_at` column, never hard delete
- **Audit columns** on all tables — `created_by`, `updated_by`, `created_at`, `updated_at`
- **Stock transactions** log every movement with previous/new stock
- **Generated columns** — `stock_status` and `pending_amount` computed in DB
- **RLS** — Supabase Row Level Security enabled, write operations via service role in API routes
- **Permission checks** done in components via `hasPermission()` — no hardcoded role names

---

## Deployment (Vercel)

```bash
npm run build
```

Or connect the GitHub repo to Vercel and set the environment variables in the Vercel dashboard.

---

## License
MIT — Built for Bharath Forklift internal operations.
