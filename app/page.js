import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  
  if (session) {
    redirect('/dashboard');
  }
  
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold tracking-tight">KG Interiors ERP</h1>
          <Link href="/auth/signin">
            <Button>Sign In</Button>
          </Link>
        </div>
      </header>
      
      <main className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-8">
          <h2 className="text-5xl font-bold tracking-tight">
            Finance Workflow Automation
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Streamline your interior design business with real-time project tracking, 
            vendor management, and financial insights.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/auth/signin">
              <Button size="lg" className="h-12 px-8 text-base">
                Get Started
              </Button>
            </Link>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6 mt-16 text-left">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="font-semibold text-lg mb-2">Project Management</h3>
              <p className="text-sm text-muted-foreground">
                Track projects from 2D drawings to final handover with complete visibility
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="font-semibold text-lg mb-2">Financial Tracking</h3>
              <p className="text-sm text-muted-foreground">
                Real-time cash flow monitoring with automated ledger entries
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="font-semibold text-lg mb-2">Vendor Management</h3>
              <p className="text-sm text-muted-foreground">
                Handle multiple vendor types with automated BOQ and payment tracking
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
