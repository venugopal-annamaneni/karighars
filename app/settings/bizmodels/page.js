"use client";

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { Settings, Briefcase, TrendingUp, TrendingDown, Plus, Trash2, Edit } from 'lucide-react';

export default function BizModelsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [bizModels, setBizModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [modelDetails, setModelDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingModelId, setEditingModelId] = useState(null);
  
  const [newModel, setNewModel] = useState({
    code: '',
    name: '',
    version: '',
    description: '',
    service_charge_percentage: 10,
    max_discount_percentage: 5,
    is_active: true,
  });

  const [stages, setStages] = useState([
    { stage_code: '', stage_name: '', sequence_order: 1, description: '' }
  ]);

  const [milestones, setMilestones] = useState([
    { milestone_code: '', milestone_name: '', direction: 'inflow', default_percentage: 0, stage_code: '', description: '', sequence_order: 1, woodwork_percentage: 0, misc_percentage: 0 }
  ]);

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

  const addStage = () => {
    setStages([...stages, { 
      stage_code: '', 
      stage_name: '', 
      sequence_order: stages.length + 1, 
      description: '' 
    }]);
  };

  const removeStage = (index) => {
    setStages(stages.filter((_, i) => i !== index));
  };

  const updateStage = (index, field, value) => {
    const updated = [...stages];
    updated[index][field] = value;
    setStages(updated);
  };

  const addMilestone = () => {
    setMilestones([...milestones, { 
      milestone_code: '', 
      milestone_name: '', 
      direction: 'inflow', 
      default_percentage: 0, 
      stage_code: '', 
      description: '', 
      sequence_order: milestones.length + 1 
    }]);
  };

  const removeMilestone = (index) => {
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  const updateMilestone = (index, field, value) => {
    const updated = [...milestones];
    updated[index][field] = value;
    setMilestones(updated);
  };

  const handleCreateModel = async () => {
    try {
      // If editing, we're creating a new version
      const isEditing = editingModelId !== null;
      
      const res = await fetch('/api/biz-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newModel,
          is_editing: isEditing,
          base_model_id: editingModelId,
          stages: stages.filter(s => s.stage_code && s.stage_name),
          milestones: milestones.filter(m => m.milestone_code && m.milestone_name)
        })
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(isEditing ? `New version created: ${data.bizModel.version}` : 'Business Model created successfully');
        setShowCreateDialog(false);
        setEditingModelId(null);
        fetchBizModels();
        // Reset form
        setNewModel({
          code: '',
          name: '',
          version: '',
          description: '',
          service_charge_percentage: 10,
          max_discount_percentage: 5,
          is_active: true,
        });
        setStages([{ stage_code: '', stage_name: '', sequence_order: 1, description: '' }]);
        setMilestones([{ milestone_code: '', milestone_name: '', direction: 'inflow', default_percentage: 0, stage_code: '', description: '', sequence_order: 1, woodwork_percentage: 0, misc_percentage: 0 }]);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to create business model');
      }
    } catch (error) {
      console.error('Error creating model:', error);
      toast.error('An error occurred');
    }
  };

  const handleEditModel = async (modelId) => {
    try {
      const res = await fetch(`/api/biz-models/${modelId}`);
      if (res.ok) {
        const data = await res.json();
        
        // Populate form with existing data
        setNewModel({
          code: data.model.code,
          name: data.model.name,
          version: '', // Will be auto-generated
          description: data.model.description,
          service_charge_percentage: data.model.service_charge_percentage,
          max_discount_percentage: data.model.max_discount_percentage,
          is_active: data.model.is_active,
        });
        
        setStages(data.stages.length > 0 ? data.stages : [{ stage_code: '', stage_name: '', sequence_order: 1, description: '' }]);
        setMilestones(data.milestones.length > 0 ? data.milestones : [{ milestone_code: '', milestone_name: '', direction: 'inflow', default_percentage: 0, stage_code: '', description: '', sequence_order: 1, woodwork_percentage: 0, misc_percentage: 0 }]);
        
        setEditingModelId(modelId);
        setShowCreateDialog(true);
      }
    } catch (error) {
      console.error('Error loading model:', error);
      toast.error('Failed to load model for editing');
    }
  };

  const handleBuildModel = async (modelId) => {
    try {
      const res = await fetch(`/api/biz-models/${modelId}/build`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(data.message || 'BizModel built successfully');
        fetchBizModels();
        if (selectedModel === modelId) {
          handleModelSelect(modelId); // Refresh details
        }
      } else {
        toast.error(data.error || 'Failed to build BizModel');
      }
    } catch (error) {
      console.error('Error building model:', error);
      toast.error('An error occurred');
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

  if (!session) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <Toaster richColors position="top-right" />
      <main className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Settings className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold tracking-tight">Business Model Configuration</h1>
            </div>
            <p className="text-muted-foreground">
              Manage project workflows, stages, and payment milestones
            </p>
          </div>
          {session.user.role === 'admin' && (
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create New BizModel
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Business Model</DialogTitle>
                  <DialogDescription>
                    Define a new business model with stages and payment milestones
                  </DialogDescription>
                </DialogHeader>
                
                <Tabs defaultValue="basic" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="basic">Basic Info</TabsTrigger>
                    <TabsTrigger value="stages">Stages</TabsTrigger>
                    <TabsTrigger value="milestones">Milestones</TabsTrigger>
                  </TabsList>

                  <TabsContent value="basic" className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Code *</Label>
                        <Input
                          placeholder="e.g., BIZ_MODEL_V2"
                          value={newModel.code}
                          onChange={(e) => setNewModel({ ...newModel, code: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Version *</Label>
                        <Input
                          placeholder="e.g., V2"
                          value={newModel.version}
                          onChange={(e) => setNewModel({ ...newModel, version: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>Name *</Label>
                        <Input
                          placeholder="e.g., Premium Project Model"
                          value={newModel.name}
                          onChange={(e) => setNewModel({ ...newModel, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>Description</Label>
                        <Textarea
                          placeholder="Describe this business model..."
                          value={newModel.description}
                          onChange={(e) => setNewModel({ ...newModel, description: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Service Charge (%)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={newModel.service_charge_percentage}
                          onChange={(e) => setNewModel({ ...newModel, service_charge_percentage: parseFloat(e.target.value) })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Max Discount (%)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={newModel.max_discount_percentage}
                          onChange={(e) => setNewModel({ ...newModel, max_discount_percentage: parseFloat(e.target.value) })}
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="stages" className="space-y-4">
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-muted-foreground">Define project stages</p>
                      <Button onClick={addStage} size="sm" variant="outline" className="gap-2">
                        <Plus className="h-4 w-4" />
                        Add Stage
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {stages.map((stage, index) => (
                        <div key={index} className="border rounded-lg p-4 space-y-3">
                          <div className="flex justify-between items-start">
                            <p className="text-sm font-medium">Stage {index + 1}</p>
                            {stages.length > 1 && (
                              <Button
                                onClick={() => removeStage(index)}
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          <div className="grid md:grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label className="text-xs">Stage Code</Label>
                              <Input
                                placeholder="e.g., onboarding"
                                value={stage.stage_code}
                                onChange={(e) => updateStage(index, 'stage_code', e.target.value)}
                                className="h-9"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Stage Name</Label>
                              <Input
                                placeholder="e.g., Onboarding"
                                value={stage.stage_name}
                                onChange={(e) => updateStage(index, 'stage_name', e.target.value)}
                                className="h-9"
                              />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                              <Label className="text-xs">Description</Label>
                              <Input
                                placeholder="Description..."
                                value={stage.description}
                                onChange={(e) => updateStage(index, 'description', e.target.value)}
                                className="h-9"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="milestones" className="space-y-4">
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-muted-foreground">Define payment milestones</p>
                      <Button onClick={addMilestone} size="sm" variant="outline" className="gap-2">
                        <Plus className="h-4 w-4" />
                        Add Milestone
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {milestones.map((milestone, index) => (
                        <div key={index} className="border rounded-lg p-4 space-y-3">
                          <div className="flex justify-between items-start">
                            <p className="text-sm font-medium">Milestone {index + 1}</p>
                            {milestones.length > 1 && (
                              <Button
                                onClick={() => removeMilestone(index)}
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          <div className="grid md:grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label className="text-xs">Milestone Code</Label>
                              <Input
                                placeholder="e.g., ADVANCE_10"
                                value={milestone.milestone_code}
                                onChange={(e) => updateMilestone(index, 'milestone_code', e.target.value)}
                                className="h-9"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Milestone Name</Label>
                              <Input
                                placeholder="e.g., Advance Payment"
                                value={milestone.milestone_name}
                                onChange={(e) => updateMilestone(index, 'milestone_name', e.target.value)}
                                className="h-9"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Direction</Label>
                              <Select
                                value={milestone.direction}
                                onValueChange={(value) => updateMilestone(index, 'direction', value)}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="inflow">Inflow (Customer)</SelectItem>
                                  <SelectItem value="outflow">Outflow (Vendor)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Default %</Label>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0"
                                value={milestone.default_percentage}
                                onChange={(e) => updateMilestone(index, 'default_percentage', parseFloat(e.target.value))}
                                className="h-9"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Stage Code</Label>
                              <Input
                                placeholder="e.g., 2D"
                                value={milestone.stage_code}
                                onChange={(e) => updateMilestone(index, 'stage_code', e.target.value)}
                                className="h-9"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Sequence Order</Label>
                              <Input
                                type="number"
                                placeholder="1"
                                value={milestone.sequence_order}
                                onChange={(e) => updateMilestone(index, 'sequence_order', parseInt(e.target.value))}
                                className="h-9"
                              />
                            </div>
                            {milestone.direction === 'inflow' && milestone.milestone_code !== 'MISC_PAYMENT' && (
                              <>
                                <div className="space-y-2">
                                  <Label className="text-xs">Woodwork % 🪵</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="0"
                                    value={milestone.woodwork_percentage}
                                    onChange={(e) => updateMilestone(index, 'woodwork_percentage', parseFloat(e.target.value))}
                                    className="h-9"
                                  />
                                  <p className="text-xs text-muted-foreground">% of woodwork value to collect</p>
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs">Misc % 🔧</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="0"
                                    value={milestone.misc_percentage}
                                    onChange={(e) => updateMilestone(index, 'misc_percentage', parseFloat(e.target.value))}
                                    className="h-9"
                                  />
                                  <p className="text-xs text-muted-foreground">% of misc (internal + external) to collect</p>
                                </div>
                              </>
                            )}
                            <div className="space-y-2 md:col-span-2">
                              <Label className="text-xs">Description</Label>
                              <Input
                                placeholder="Description..."
                                value={milestone.description}
                                onChange={(e) => updateMilestone(index, 'description', e.target.value)}
                                className="h-9"
                              />
                            </div>
                          </div>
                          {milestone.milestone_code === 'MISC_PAYMENT' && (
                            <div className="bg-amber-50 border border-amber-200 rounded p-2">
                              <p className="text-xs text-amber-800">
                                💡 MISC_PAYMENT milestone captures user-entered amount only (no auto-calculation)
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateModel}>
                    Create Business Model
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
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
                <div key={model.id} className="relative">
                  <button
                    onClick={() => handleModelSelect(model.id)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
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
                      <Badge variant={model.status === 'built' ? 'outline' : 'secondary'} 
                             className={model.status === 'built' ? 'bg-green-50 text-green-700 border-green-300' : 'bg-amber-50 text-amber-700 border-amber-300'}>
                        {model.status === 'built' ? '✓ Built' : 'Draft'}
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
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="gap-1 h-7 px-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditModel(model.id);
                      }}
                    >
                      <Edit className="h-3 w-3" />
                      Edit
                    </Button>
                    {model.status === 'draft' && session.user.role === 'admin' && (
                      <Button 
                        size="sm" 
                        className="gap-1 h-7 px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBuildModel(model.id);
                        }}
                      >
                        Build
                      </Button>
                    )}
                  </div>
                </div>
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
