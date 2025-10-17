# KG Interiors Finance Management System

A comprehensive finance management platform built with Next.js and PostgreSQL for interior design businesses. Manages projects, estimations, payments, vendors, and complete financial tracking with real-time insights.

---

## ✨ Key Features

### 💼 Project Management
- Complete project lifecycle tracking
- Stage-based workflow (configurable per business model)
- Multiple estimation versions with approval workflow
- Collaborative project teams with role-based access

### 💰 Financial Management
- **Customer Payments**: Milestone-based with cumulative tracking
- **Overpayment Handling**: Automatic detection with credit note workflow
- **GST Management**: Integrated at estimation level
- **Vendor Payments**: BOQ-based vendor management
- **Real-time Ledger**: Complete financial audit trail

### 📊 Business Models
- Configurable payment milestones
- Separate tracking for Woodwork and Misc categories
- Versioned business models (V1, V2, V3...)
- Draft and published model states

### 📄 Document Management
- Payment receipts
- Project invoices
- Credit notes
- KYC documents

### 👥 Customer & Vendor Management
- KYC documentation (Aadhar, PAN, Bank details)
- B2B and B2C support
- Credit limit tracking
- Vendor BOQ management

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and Yarn
- PostgreSQL 15+
- Google OAuth credentials (for authentication)

### 1. Clone Repository
```bash
git clone <your-repo-url>
cd kg-interiors-finance
```

### 2. Setup Database
```bash
# Create database
psql -U postgres -c "CREATE DATABASE kg_interiors_finance;"

# Import schema
psql -U postgres -d kg_interiors_finance -f schema.sql
```

See [DATABASE_README.md](./DATABASE_README.md) for detailed setup instructions.

### 3. Configure Environment
```bash
cp .env.example .env
# Edit .env with your credentials
```

Required variables:
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/kg_interiors_finance
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 4. Install & Run
```bash
# Install dependencies
yarn install

# Run development server
yarn dev
```

Access at: http://localhost:3000

---

## 📚 Documentation

### Setup Guides
- **[DATABASE_README.md](./DATABASE_README.md)** - Complete database setup and schema documentation
- **[QUICK_START_GUIDE.md](./QUICK_START_GUIDE.md)** - General setup instructions
- **[GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md)** - Google OAuth configuration
- **[RDS_SETUP_INSTRUCTIONS.md](./RDS_SETUP_INSTRUCTIONS.md)** - AWS RDS deployment

### Architecture
- **[SCHEMA_CLEANUP_SUMMARY.md](./SCHEMA_CLEANUP_SUMMARY.md)** - Detailed schema documentation

---

## 🗂️ Project Structure

```
/app
├── app/
│   ├── api/[[...path]]/route.js    # Centralized API handler
│   ├── auth/                        # Authentication pages
│   ├── dashboard/                   # Dashboard
│   ├── projects/                    # Project management
│   ├── customers/                   # Customer management
│   ├── vendors/                     # Vendor management
│   ├── payments/                    # Payment tracking
│   ├── reports/                     # Financial reports
│   └── settings/                    # Configuration
├── components/
│   ├── navbar.js                    # Navigation
│   └── ui/                          # Shadcn UI components
├── lib/
│   ├── auth-options.js              # NextAuth config
│   ├── db.js                        # Database connection
│   └── utils.js                     # Utilities
├── schema.sql                       # Database schema
└── .env                             # Environment config
```

---

## 🔐 User Roles

- **Admin**: Full system access, approval workflows
- **Finance**: Payment approval, document uploads, financial operations
- **Sales**: Project creation, customer management
- **Estimator**: Estimation creation and editing
- **Designer**: Project collaboration
- **Project Manager**: Project oversight

---

## 💡 Key Workflows

### Creating a Project
1. Define customer with KYC details
2. Select business model (with stages and milestones)
3. Create project - automatically assigned to first stage
4. Create estimation with line items
5. Track payments by milestone

### Payment Flow
1. Record payment against milestone (or ad-hoc)
2. Finance uploads receipt
3. Payment becomes "approved"
4. Ledger entry created automatically
5. Dashboard reflects updated metrics

### Overpayment Workflow
1. Revise estimation to lower value
2. System detects overpayment
3. Admin approves revision
4. Credit note created (pending)
5. Finance uploads credit note document
6. Credit note approved → ledger adjusted

---

## 🛠️ Technology Stack

- **Frontend**: Next.js 14, React, Tailwind CSS, Shadcn UI
- **Backend**: Next.js API Routes, PostgreSQL
- **Authentication**: NextAuth.js with Google OAuth
- **Database**: PostgreSQL 15+
- **Deployment**: Docker, Kubernetes, AWS RDS

---

## 📊 Database Schema

30 tables organized in categories:
- Authentication (4)
- Business Configuration (3)
- Customers & KYC (2)
- Projects (3)
- Estimations (2)
- Financial Tracking (3)
- Payments (1)
- Vendors (4)
- Purchases (4)
- Documents & Logs (2)

See [DATABASE_README.md](./DATABASE_README.md) for complete schema details.

---

## 🧪 Development

### Running Locally
```bash
yarn dev          # Development server
yarn build        # Production build
yarn start        # Production server
yarn lint         # Lint code
```

### Database Migrations
For existing installations:
```bash
psql -U postgres -d kg_interiors_finance -f rename_phase_to_stage.sql
psql -U postgres -d kg_interiors_finance -f remove_expected_percentage.sql
```

---

## 🚢 Deployment

### Environment Variables
Ensure all production variables are set:
- `DATABASE_URL` with SSL enabled
- `NEXTAUTH_URL` with production domain
- `NEXTAUTH_SECRET` (generate new for production)
- Google OAuth credentials (production authorized URLs)

### Database Setup
1. Create PostgreSQL instance (AWS RDS, etc.)
2. Import `schema.sql`
3. Configure connection string in `.env`

See [RDS_SETUP_INSTRUCTIONS.md](./RDS_SETUP_INSTRUCTIONS.md) for AWS deployment.

---

## 🔒 Security

- Google OAuth for authentication
- Role-based access control
- PostgreSQL with SSL/TLS
- Environment variable protection
- API route protection with NextAuth

---

## 📝 License

[Your License Here]

---

## 🤝 Contributing

[Your contribution guidelines]

---

## 📧 Support

[Your support contact]

---

**Version**: 1.0  
**Last Updated**: June 2025  
**Status**: Production Ready ✅
