"use client";
import { AlertProvider, useAlert } from '@/app/context/AlertContext';
import ContextualAlert from '@/components/alerts/ContextualAlert';
import { Navbar } from '@/components/navbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Toaster } from '@/components/ui/toaster';
import { ALERT_TYPE, PROJECT_STAGES } from '@/lib/constants';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ArrowLeft, Calendar, Edit, FileText, MapPin, Users } from 'lucide-react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ProjectDataProvider, useProjectData } from "@/app/context/ProjectDataContext";



export default function ProjectLayout({ children }) {
  const params = useParams();
  const projectId = params.id;

  return (
    <AlertProvider>
      <ProjectDataProvider projectId={projectId}>
        <ProjectLayoutInner projectId={projectId}>{children}</ProjectLayoutInner>
      </ProjectDataProvider>
    </AlertProvider>
  );
}


function ProjectLayoutInner({ children }) {

  const { data: session, status } = useSession();
  const alert = useAlert();


  const router = useRouter();
  const params = useParams();
  const projectId = params.id;

  const { project, estimation, loading, fetchProjectData } = useProjectData();
  const [stageUpdate, setStageUpdate] = useState({ stage: '', remarks: '' });

  const [showStageDialog, setShowStageDialog] = useState(false);
  const [stages, setStages] = useState([]);

  const pathname = usePathname();
  const last_segment = pathname.split("/").pop();
  const activeTabs = ["estimation", "customer-payments", "vendor-boqs", "vendor-payments", "ledger", "documents", "details"];
  const activeTab = activeTabs.indexOf(last_segment) !== -1 ? last_segment : "estimation";



  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated') {
      fetchProjectData();
    }
  }, [status, router, projectId]);

  useEffect(() => {
    if (project) {
      console.log("here");
      fetchOtherData();
    }
  })

  useEffect(() => {
    if (estimation?.has_overpayment) {
      alert.showAlert(
        {
          estimation,
          userRole: session?.user?.role,
          fetchProjectData,
        },
        ALERT_TYPE.OVERPAYMENT_ALERT
      );
    } else {
      alert.hideAlert();
    }
  }, [estimation]);

  const fetchOtherData = async () => {
    if (project && project.biz_model_id && stages.length === 0) {
      const bizModelRes = await fetch(`/api/biz-models/${project.biz_model_id}`);
      if (bizModelRes.ok) {
        const bizData = await bizModelRes.json();
        setStages(bizData.stages || []);
      }
    }
  }

  const getStageColor = (stage) => {
    switch (stage) {
      case PROJECT_STAGES.ONBOARDING: return 'bg-blue-100 text-blue-700';
      case PROJECT_STAGES['2D']: return 'bg-purple-100 text-purple-700';
      case PROJECT_STAGES['3D']: return 'bg-amber-100 text-amber-700';
      case PROJECT_STAGES.EXEC: return 'bg-green-100 text-green-700';
      case PROJECT_STAGES.HANDOVER: return 'bg-slate-100 text-slate-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const handleStageUpdate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stageUpdate)
      });

      if (res.ok) {
        toast.success('Project stage updated');
        setShowStageDialog(false);
        fetchProjectData();
      } else {
        toast.error('Failed to update stage');
      }
    } catch (error) {
      console.error('Error updating stage:', error);
      toast.error('An error occurred');
    }
  };



  const handleTabChange = (val) => {
    if (val === "" || val === "estimation") {
      // navigate to parent page.js
      router.push(`/projects/${project.id}`);
    } else {
      router.push(`/projects/${project.id}/${val}`);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session || !project) return null;

  console.log("render");
  return (

    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <Toaster richColors position="top-right" />
      <main className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <Link href="/projects">
            <Button variant="ghost" size="sm" className="gap-2 mb-4">
              <ArrowLeft className="h-4 w-4" />
              Back to Projects
            </Button>
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
                <Badge className={getStageColor(project.stage)}>
                  {project.stage}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <Link href={`/customers/${project.customer_id}`}>
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {project.customer_name}
                  </span>
                </Link>
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {project.location}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatDate(project.created_at)}
                </span>
                {project.sales_order_id && (
                  <span className="flex items-center gap-1 font-medium text-primary">
                    <FileText className="h-4 w-4" />
                    SO: {project.sales_order_id}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Dialog open={showStageDialog} onOpenChange={setShowStageDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2" onClick={() => setStageUpdate({ stage: project.stage, remarks: '' })}>
                    <Edit className="h-4 w-4" />
                    Update Stage
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Update Project Stage</DialogTitle>
                    <DialogDescription>
                      Move the project to the next stage
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleStageUpdate} className="space-y-4">
                    <div className="space-y-2">
                      <Label>New Stage</Label>
                      <Select value={stageUpdate.stage} onValueChange={(value) => setStageUpdate({ ...stageUpdate, stage: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {stages.map((stage) => (
                            <SelectItem key={stage.id} value={stage.stage_code}>
                              {stage.stage_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Remarks</Label>
                      <Textarea
                        value={stageUpdate.remarks}
                        onChange={(e) => setStageUpdate({ ...stageUpdate, remarks: e.target.value })}
                        placeholder="Add any notes about this stage change..."
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setShowStageDialog(false)}>Cancel</Button>
                      <Button type="submit">Update Stage</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
              <Link href={`/projects/${projectId}/estimation`}>
                <Button className="gap-2">
                  <FileText className="h-4 w-4" />
                  Manage Estimation
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Financial Summary */}
        <FinancialSummary project={project} estimation={estimation} />
        {/* Displays Alert in Context if available */}
        <ContextualAlert />

        {/* Tabs */}
        <Tabs defaultValue={activeTab} className="space-y-4" onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="estimation">Estimation</TabsTrigger>
            <TabsTrigger value="customer-payments">Customer Payments</TabsTrigger>
            <TabsTrigger value="vendor-boqs">Vendor BOQs</TabsTrigger>
            <TabsTrigger value="vendor-payments">Vendor Payments</TabsTrigger>
            <TabsTrigger value="ledger">Ledger</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>
          <TabsContent value={activeTab} className="space-y-4">
            {children}
          </TabsContent>
        </Tabs>
      </main>
    </div>

  );
}

const FinancialSummary = ({ project, estimation }) => {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Estimated Value (with GST)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(parseFloat(estimation?.final_value || 0))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Received from Customer</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(project.payments_received)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Paid to Vendors</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            {formatCurrency(project.payments_made)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Net Position</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(project.payments_received - project.payments_made)}
          </div>
        </CardContent>
      </Card>
    </div>

  )
}