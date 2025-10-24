"use client";

import { useProjectData } from '@/app/context/ProjectDataContext';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PROJECT_STAGES } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function ProjectDetailsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id;

  //const [project, setProject] = useState(null);
  // const [loading, setLoading] = useState(true);

  const { project, loading } = useProjectData();
  
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } 
  }, [status, router, projectId]);


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

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen pt-20 flex items-start justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session || !project) return null;


  return (

    <Card>
      <CardHeader>
        <CardTitle>Project Information</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Sales Order ID</p>
            <p className="font-medium">{project.sales_order_id || 'Not Generated'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Business Model</p>
            <p className="font-medium">{project.biz_model_name || 'No BizModel'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Project Code</p>
            <p className="font-medium">{project.project_code}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Customer</p>
            <p className="font-medium">{project.customer_name}</p>
            <p className="text-sm text-muted-foreground">{project.customer_phone}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Location</p>
            <p className="font-medium">{project.location}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Stage</p>
            <Badge className={getStageColor(project.stage)}>
              {project.stage}
            </Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Created By</p>
            <p className="font-medium">{project.created_by_name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Created On</p>
            <p className="font-medium">{formatDate(project.created_at)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}