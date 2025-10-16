"use client";

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Briefcase, TrendingUp, TrendingDown } from 'lucide-react';

export default function BizModelsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [bizModels, setBizModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [modelDetails, setModelDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated') {
      fetchBizModels();
    }
  }, [status, router]);

  const fetchBizModels = async () => {
    try {
      const res = await fetch('/api/biz-models');
      if (res.ok) {
        const data = await res.json();
        setBizModels(data.bizModels);
        if (data.bizModels.length > 0) {
          setSelectedModel(data.bizModels[0].id);
          fetchModelDetails(data.bizModels[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching bizmodels:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchModelDetails = async (modelId) => {
    try {
      const res = await fetch(`/api/biz-models/${modelId}`);
      if (res.ok) {
        const data = await res.json();
        setModelDetails(data);
      }
    } catch (error) {
      console.error('Error fetching model details:', error);
    }
  };

  const handleModelSelect = (modelId) => {
    setSelectedModel(modelId);
    fetchModelDetails(modelId);
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

  if (!session) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="container mx-auto p-6 space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Settings className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Business Model Configuration</h1>
          </div>
          <p className="text-muted-foreground">
            Manage project workflows, stages, and payment milestones
          </p>
        </div>

        {/* BizModel Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Business Model</CardTitle>
            <CardDescription>Choose a business model to view its configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {bizModels.map((model) => (
                <button
                  key={model.id}
                  onClick={() => handleModelSelect(model.id)}
                  className={`text-left p-4 rounded-lg border-2 transition-all ${
                    selectedModel === model.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Briefcase className="h-5 w-5 text-primary" />
                    <Badge variant={model.is_active ? 'default' : 'secondary'}>
                      {model.version}
                    </Badge>
                  </div>
                  <h3 className="font-semibold mb-1">{model.name}</h3>
                  <p className="text-sm text-muted-foreground">{model.description}</p>
                  <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">Service Charge</p>
                      <p className="font-medium">{model.service_charge_percentage}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Max Discount</p>
                      <p className="font-medium">{model.max_discount_percentage}%</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Model Details */}
        {modelDetails && (
          <Tabs defaultValue="stages" className="space-y-4">
            <TabsList>
              <TabsTrigger value="stages">Project Stages</TabsTrigger>
              <TabsTrigger value="milestones">Payment Milestones</TabsTrigger>
              <TabsTrigger value="config">Configuration</TabsTrigger>
            </TabsList>

            <TabsContent value="stages" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Project Stages</CardTitle>
                  <CardDescription>
                    Workflow stages for projects using this business model
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {modelDetails.stages.map((stage, index) => (
                      <div
                        key={stage.id}
                        className="flex items-center gap-4 p-4 border rounded-lg"
                      >
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-bold text-primary">{index + 1}</span>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium">{stage.stage_name}</h4>
                          <p className="text-sm text-muted-foreground">{stage.description}</p>
                        </div>
                        <Badge variant="outline">{stage.stage_code}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="milestones" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {/* Inflow Milestones */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                      <CardTitle className="text-green-600">Customer Payments (Inflow)</CardTitle>
                    </div>
                    <CardDescription>Money received from customers</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {modelDetails.milestones
                        .filter((m) => m.direction === 'inflow')
                        .map((milestone) => (
                          <div
                            key={milestone.id}
                            className="p-3 border border-green-200 bg-green-50 rounded-lg"
                          >
                            <div className="flex items-start justify-between mb-1">
                              <h4 className="font-medium text-sm">{milestone.milestone_name}</h4>
                              <Badge className="bg-green-600">
                                {milestone.default_percentage}%
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">
                              {milestone.description}
                            </p>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-muted-foreground">Stage:</span>
                              <Badge variant="outline" className="text-xs">
                                {milestone.stage_code}
                              </Badge>
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Outflow Milestones */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-5 w-5 text-red-600" />
                      <CardTitle className="text-red-600">Vendor Payments (Outflow)</CardTitle>
                    </div>
                    <CardDescription>Money paid to vendors</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {modelDetails.milestones
                        .filter((m) => m.direction === 'outflow')
                        .map((milestone) => (
                          <div
                            key={milestone.id}
                            className="p-3 border border-red-200 bg-red-50 rounded-lg"
                          >
                            <div className="flex items-start justify-between mb-1">
                              <h4 className="font-medium text-sm">{milestone.milestone_name}</h4>
                              <Badge className="bg-red-600">{milestone.default_percentage}%</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">
                              {milestone.description}
                            </p>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-muted-foreground">Stage:</span>
                              <Badge variant="outline" className="text-xs">
                                {milestone.stage_code}
                              </Badge>
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="config" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Business Model Configuration</CardTitle>
                  <CardDescription>Settings and rules for this business model</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Model Code</p>
                        <p className="text-lg font-medium">{modelDetails.model.code}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Version</p>
                        <Badge>{modelDetails.model.version}</Badge>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Status</p>
                        <Badge variant={modelDetails.model.is_active ? 'default' : 'secondary'}>
                          {modelDetails.model.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-700 mb-1">Default Service Charge</p>
                        <p className="text-2xl font-bold text-green-700">
                          {modelDetails.model.service_charge_percentage}%
                        </p>
                        <p className="text-xs text-green-600 mt-1">
                          Added to all estimations by default
                        </p>
                      </div>
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-sm text-amber-700 mb-1">Maximum Discount</p>
                        <p className="text-2xl font-bold text-amber-700">
                          {modelDetails.model.max_discount_percentage}%
                        </p>
                        <p className="text-xs text-amber-600 mt-1">
                          Discounts above this require approval
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-4 text-sm">
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <p className="text-muted-foreground mb-1">Total Stages</p>
                      <p className="text-2xl font-bold">{modelDetails.stages.length}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <p className="text-muted-foreground mb-1">Inflow Milestones</p>
                      <p className="text-2xl font-bold text-green-600">
                        {modelDetails.milestones.filter((m) => m.direction === 'inflow').length}
                      </p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <p className="text-muted-foreground mb-1">Outflow Milestones</p>
                      <p className="text-2xl font-bold text-red-600">
                        {modelDetails.milestones.filter((m) => m.direction === 'outflow').length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
