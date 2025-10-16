# KG Interiors ERP System

Complete Finance Workflow Automation Tool for Interior Design Business

## Overview

This is a comprehensive ERP system designed specifically for KG Interiors to manage their ₹200 Cr annual GMV business. The system replaces Excel-based tracking with real-time financial visibility across all departments.

## Tech Stack

- **Frontend**: Next.js 14.2.3, React, TailwindCSS, shadcn/ui
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL 15
- **Authentication**: NextAuth.js with Google OAuth
- **Deployment**: Kubernetes-ready

## Features Implemented

### 1. Authentication & Authorization
- ✅ Google OAuth integration
- ✅ Role-based access control (estimator, finance, sales, designer, project_manager, admin)
- ✅ Secure session management
- ✅ Protected routes middleware

### 2. Project Management
- ✅ Create and track projects through all phases (Onboarding → 2D → 3D → Execution → Handover)
- ✅ Customer assignment and management
- ✅ Project phase tracking with history
- ✅ Real-time project status updates
- ✅ Activity logging

### 3. Customer Management
- ✅ Complete customer database
- ✅ KYC document tracking
- ✅ Contact management
- ✅ Customer search and filtering

### 4. Vendor Management
- ✅ Multi-vendor type support (PI/Inhouse, Aristo/External, Other)
- ✅ Vendor database with contact details
- ✅ Vendor rate card management
- ✅ Vendor search and filtering

### 5. Estimation System
- ✅ Project estimation builder
- ✅ Multiple line items (Woodwork, Misc Internal, Misc External)
- ✅ Version control for estimations
- ✅ Auto-calculation of totals and margins
- ✅ Status management (Draft, Finalized, Locked)

### 6. Financial Tracking
- ✅ Customer payment recording (Advance 10%, 3D 50%, Misc 100%, Final)
- ✅ Vendor payment tracking
- ✅ Automatic ledger entries
- ✅ Real-time cash flow visibility
- ✅ Payment history with filtering

### 7. Dashboard & Analytics
- ✅ Real-time financial dashboard
- ✅ Active projects count
- ✅ Total project value tracking
- ✅ Payments received vs paid
- ✅ Net position calculation
- ✅ Recent project activities

### 8. Vendor BOQ Management
- ✅ Create BOQs from estimations
- ✅ Link BOQ items to estimation items
- ✅ Margin calculation
- ✅ Approval workflow (for margins < 30%)
- ✅ BOQ status tracking

## Database Schema

Complete PostgreSQL schema with:
- 30+ tables covering all workflows
- Foreign key relationships
- Automated triggers for wallet balance management
- Financial event definitions
- Audit logs and activity tracking
- Complete indexes for performance

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 15
- Google OAuth credentials
- Yarn package manager

### Environment Variables

Create a `.env` file with:

```env
# PostgreSQL
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kg_erp

# NextAuth
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-secret-key-min-32-chars

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### Installation

```bash
# Install dependencies
yarn install

# Initialize database
psql -U postgres -d kg_erp -f init_schema.sql

# Start development server
yarn dev
```

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create/select project
3. Navigate to APIs & Services → Credentials
4. Create OAuth 2.0 Client ID (Web application)
5. Add authorized redirect URI:
   - `https://your-domain.com/api/auth/callback/google`
6. Copy Client ID and Client Secret to `.env`

## API Endpoints

### Authentication
- `GET /api/auth/session` - Get current session
- `POST /api/auth/signin` - Sign in with Google

### Projects
- `GET /api/projects` - List all projects
- `GET /api/projects/:id` - Get project details
- `POST /api/projects` - Create new project
- `PUT /api/projects/:id` - Update project

### Customers
- `GET /api/customers` - List all customers
- `POST /api/customers` - Create new customer

### Vendors
- `GET /api/vendors` - List all vendors
- `POST /api/vendors` - Create new vendor

### Estimations
- `POST /api/estimations` - Create estimation
- `GET /api/estimations/project/:id` - Get project estimations
- `GET /api/estimation-items/:id` - Get estimation items
- `PUT /api/estimations/:id` - Update estimation

### Payments
- `GET /api/customer-payments` - List customer payments
- `POST /api/customer-payments` - Record customer payment
- `GET /api/vendor-payments` - List vendor payments
- `POST /api/vendor-payments` - Record vendor payment

### Vendor BOQs
- `GET /api/vendor-boqs` - List vendor BOQs
- `POST /api/vendor-boqs` - Create vendor BOQ
- `PUT /api/vendor-boqs/:id` - Update BOQ status

### Dashboard
- `GET /api/dashboard/stats` - Get financial statistics
- `GET /api/dashboard/activities` - Get recent activities

## User Roles

### Sales Executive
- Create projects
- Manage customer relationships
- Record advance payments

### Designer
- Access assigned projects
- Update design phase status
- Upload deliverables

### Project Manager
- Manage vendor relationships
- Create and track BOQs
- Update execution status

### Finance Team
- View all financial data
- Approve payments
- Generate reports
- Reconcile transactions

### Admin
- Full system access
- User management
- System configuration

## Project Phases

1. **Onboarding** - Initial customer onboarding
2. **2D Design** - 2D drawings and initial quote (10% advance)
3. **3D Design** - Detailed 3D design (50% payment including advance)
4. **Execution** - Project execution (100% misc items payment)
5. **Handover** - Final handover (100% payment)

## Vendor Workflows

### PI (Inhouse) Vendors
- KG generates BOQ based on standard rate card
- 50% woodwork + 100% misc as 1st installment
- 80% woodwork + 100% additional misc on carcass installation
- 20% balance on handover

### Aristo (External) Vendors
- Vendor provides BOQ
- Margin < 30% requires management approval
- 40% advance on approval
- 90% payment on material dispatch (can be batched)
- Balance on completion

### Other Vendors
- For misc items
- KG adds 30% markup
- Customer pays with markup
- KG pays vendor after customer signoff

## Future Enhancements (Not Yet Implemented)

- Purchase Order management
- Document/file upload system
- Email notifications
- Advanced reports and exports (CSV, PDF)
- Shopping team workflow (10% commission tracking)
- Wallet system integration
- Credit/Debit notes
- Approval workflows UI
- Materialized views for complex reports
- Mobile app
- WhatsApp integration

## Development

```bash
# Development mode with hot reload
yarn dev

# Production build
yarn build

# Start production server
yarn start
```

## Support

For issues or questions, contact the development team or refer to the inline documentation in the code.

## License

Proprietary - KG Interiors © 2025
