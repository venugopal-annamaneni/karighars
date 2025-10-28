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
import { BIZMODEL_STATUS, USER_ROLE } from '@/app/constants';

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
    description: '',
    gst_percentage: 18,
    is_active: true,
    category_rates: {
      categories: []
    }
  });

  const [categories, setCategories] = useState([]);

  const [stages, setStages] = useState([
    { stage_code: '', stage_name: '', sequence_order: 1, description: '' }
  ]);

  const [milestones, setMilestones] = useState([
    { milestone_code: '', milestone_name: '', direction: 'inflow', stage_code: '', description: '', sequence_order: 1, category_percentages: {} }
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

  const addCategory = () => {
    const newId = `category_${Date.now()}`;
    setCategories([...categories, {
      id: newId,
      category_name: '',
      kg_label: '',
      max_item_discount_percentage: 20,
      kg_percentage: 10,
      max_kg_discount_percentage: 50,
      pay_to_vendor_directly: false,
      sort_order: categories.length + 1
    }]);
  };

  const removeCategory = (index) => {
    setCategories(categories.filter((_, i) => i !== index));
  };

  const updateCategory = (index, field, value) => {
    const updated = [...categories];
    updated[index][field] = value;
    setCategories(updated);
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
      stage_code: '',
      description: '',
      is_mandatory: true,
      sequence_order: milestones.length + 1,
      category_percentages: {}
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

  const updateMilestoneCategoryPercentage = (milestoneIndex, categoryId, percentage) => {
    const updated = [...milestones];
    if (!updated[milestoneIndex].category_percentages) {
      updated[milestoneIndex].category_percentages = {};
    }
    updated[milestoneIndex].category_percentages[categoryId] = parseFloat(percentage) || 0;
    setMilestones(updated);
  };

  const handleCreateModel = async () => {
    try {
      const isEditing = editingModelId !== null;
      const api = isEditing ? `/api/biz-models/${editingModelId}` : '/api/biz-models';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(api, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newModel,
          is_editing: isEditing,
          base_model_id: editingModelId,
          category_rates: {
            categories: categories.filter(c => c.category_name && c.kg_label)
          },
          stages: stages.filter(s => s.stage_code && s.stage_name),
          milestones: milestones.filter(m => m.milestone_code && m.milestone_name)
        })
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(isEditing ? `Business Model saved successfully` : 'Business Model created successfully');
        setShowCreateDialog(false);
        setEditingModelId(null);
        fetchBizModels();
        // Reset form
        setNewModel({
          code: '',
          name: '',
          description: '',
          gst_percentage: 18,
          is_active: true,
          category_rates: {
            categories: []
          }
        });
        setCategories([]);
        setStages([{ stage_code: '', stage_name: '', sequence_order: 1, description: '' }]);
        setMilestones([{ milestone_code: '', milestone_name: '', direction: 'inflow', stage_code: '', description: '', sequence_order: 1, category_percentages: {} }]);
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
          description: data.model.description,
          gst_percentage: data.model.gst_percentage || 18,
          is_active: data.model.is_active,
        });

        // Load categories from JSONB or use empty array
        if (data.model.category_rates && data.model.category_rates.categories) {
          setCategories(data.model.category_rates.categories);
        } else {
          // Empty array if no categories defined yet
          setCategories([]);
        }

        setStages(data.stages.length > 0 ? data.stages : [{ stage_code: '', stage_name: '', sequence_order: 1, description: '' }]);
        setMilestones(data.milestones.length > 0 ? data.milestones : [{ milestone_code: '', milestone_name: '', direction: 'inflow', stage_code: '', description: '', sequence_order: 1, category_percentages: {} }]);

        setEditingModelId(modelId);
        setShowCreateDialog(true);
      }
    } catch (error) {
      console.error('Error loading model:', error);
      toast.error('Failed to load model for editing');
    }
  };

  // const handleBuildModel = async (modelId) => {
  //   try {
  //     const res = await fetch(`/api/biz-models/${modelId}/build`, {
  //       method: 'PUT',
  //       headers: { 'Content-Type': 'application/json' },
  //       body: JSON.stringify({})
  //     });

  //     const data = await res.json();

  //     if (res.ok) {
  //       toast.success(data.message || 'BizModel built successfully');
  //       fetchBizModels();
  //       if (selectedModel === modelId) {
  //         handleModelSelect(modelId); // Refresh details
  //       }
  //     } else {
  //       toast.error(data.error || 'Failed to build BizModel');
  //     }
  //   } catch (error) {
  //     console.error('Error building model:', error);
  //     toast.error('An error occurred');
  //   }
  // };

  const handleToggleStatus = async (modelId, e) => {
    e.stopPropagation(); // Prevent card selection
    try {
      const res = await fetch(`/api/biz-models/${modelId}?action=toggle-status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(data.message || 'Status updated successfully');
        fetchBizModels();
        if (selectedModel === modelId) {
          handleModelSelect(modelId); // Refresh details
        }
      } else {
        toast.error(data.error || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error toggling status:', error);
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
          {session.user.role === USER_ROLE.ADMIN && (
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="gap-2" onClick={() => setEditingModelId(null)}>
                  <Plus className="h-4 w-4" />
                  Create New Business Model
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingModelId ? 'Edit Business Model' : 'Create New Business Model'}</DialogTitle>
                  <DialogDescription>
                    {editingModelId ? 'Business Model can be edited till it is published' : 'Define a new business model with stages and payment milestones'}
                  </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="basic" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="basic">Basic Info</TabsTrigger>
                    <TabsTrigger value="categories">Categories & Rates</TabsTrigger>
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
                        <Label>GST % *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={newModel.gst_percentage}
                          onChange={(e) => setNewModel({ ...newModel, gst_percentage: parseFloat(e.target.value) })}
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="categories" className="space-y-4">
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-muted-foreground">Define item categories with pricing rules</p>
                      <Button onClick={addCategory} size="sm" variant="outline" className="gap-2">
                        <Plus className="h-4 w-4" />
                        Add Category
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {categories.map((category, index) => (
                        <div key={index} className="border rounded-lg p-4 space-y-3 bg-slate-50">
                          <div className="flex justify-between items-start">
                            <p className="text-sm font-medium">Category {index + 1}</p>
                            {categories.length > 1 && (
                              <Button
                                onClick={() => removeCategory(index)}
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
                              <Label className="text-xs">Category Name *</Label>
                              <Input
                                placeholder="e.g., Woodwork"
                                value={category.category_name}
                                onChange={(e) => updateCategory(index, 'category_name', e.target.value)}
                                className="h-9"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">KG Charge Label *</Label>
                              <Input
                                placeholder="e.g., Design and Consultation"
                                value={category.kg_label}
                                onChange={(e) => updateCategory(index, 'kg_label', e.target.value)}
                                className="h-9"
                              />
                            </div>
                          </div>
                          <div className="grid md:grid-cols-3 gap-3">
                            <div className="space-y-2">
                              <Label className="text-xs">Max Item Discount %</Label>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="20"
                                value={category.max_item_discount_percentage}
                                onChange={(e) => updateCategory(index, 'max_item_discount_percentage', parseFloat(e.target.value))}
                                className="h-9"
                              />
                              <p className="text-xs text-muted-foreground">Max discount on item price</p>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">KG Charge %</Label>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="10"
                                value={category.kg_percentage}
                                onChange={(e) => updateCategory(index, 'kg_percentage', parseFloat(e.target.value))}
                                className="h-9"
                              />
                              <p className="text-xs text-muted-foreground">Service charge percentage</p>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Max KG Discount %</Label>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="50"
                                value={category.max_kg_discount_percentage}
                                onChange={(e) => updateCategory(index, 'max_kg_discount_percentage', parseFloat(e.target.value))}
                                className="h-9"
                              />
                              <p className="text-xs text-muted-foreground">Max discount on KG charges</p>
                            </div>
                          </div>
                          <div className="grid md:grid-cols-2 gap-3 mt-3">
                            <div className="space-y-2">
                              <Label className="text-xs">Sort Order</Label>
                              <Input
                                type="number"
                                placeholder="1"
                                value={category.sort_order}
                                onChange={(e) => updateCategory(index, 'sort_order', parseInt(e.target.value))}
                                className="h-9"
                              />
                              <p className="text-xs text-muted-foreground">Display order (1, 2, 3...)</p>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Payment Type</Label>
                              <div className="flex items-center space-x-2 h-9 pt-1">
                                <input
                                  type="checkbox"
                                  checked={category.pay_to_vendor_directly || false}
                                  onChange={(e) => updateCategory(index, 'pay_to_vendor_directly', e.target.checked)}
                                  className="h-4 w-4"
                                />
                                <span className="text-sm">Customer pays vendor directly</span>
                              </div>
                              <p className="text-xs text-muted-foreground">If checked, only KG charges billed to customer</p>
                            </div>
                          </div>
                        </div>
                      ))}
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
                                placeholder="e.g., 2D"
                                value={stage.stage_code}
                                onChange={(e) => updateStage(index, 'stage_code', e.target.value)}
                                className="h-9"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Stage Name</Label>
                              <Input
                                placeholder="e.g., 2D Design"
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
                              <Label className="text-xs">Sequence Order</Label>
                              <Input
                                type="number"
                                placeholder="1"
                                value={milestone.sequence_order}
                                onChange={(e) => updateMilestone(index, 'sequence_order', parseInt(e.target.value))}
                                className="h-9"
                              />
                            </div>
                            <div className="space-y-2 md:col-span-2">
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
                              <Label className="text-xs">Stage Code</Label>
                              <Input
                                placeholder="e.g., 2D"
                                value={milestone.stage_code}
                                onChange={(e) => updateMilestone(index, 'stage_code', e.target.value)}
                                className="h-9"
                              />
                            </div>
                          </div>
                          {milestone.direction === 'inflow' && (
                            <div className="space-y-3">
                              <p className="text-xs font-medium text-muted-foreground">Category Percentages (Cumulative)</p>
                              <div className="grid md:grid-cols-3 gap-3">
                                {categories
                                  .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                                  .map((category, catIndex) => (
                                    <div key={catIndex} className="space-y-2">
                                      <Label className="text-xs">{category.category_name} %</Label>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        placeholder="0"
                                        value={milestone.category_percentages?.[category.id] || 0}
                                        onChange={(e) => updateMilestoneCategoryPercentage(index, category.id, e.target.value)}
                                        className="h-9"
                                      />
                                      <p className="text-xs text-muted-foreground">% of {category.category_name.toLowerCase()} to collect</p>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                          <div className="space-y-2">
                            <Label className="text-xs">Description</Label>
                            <Input
                              placeholder="Description..."
                              value={milestone.description}
                              onChange={(e) => updateMilestone(index, 'description', e.target.value)}
                              className="h-9"
                            />
                          </div>
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
                    {editingModelId ? "Save Business Model" : "Create Business Model"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Business Model Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Business Model</CardTitle>
            <CardDescription>Choose a business model to view its configuration</CardDescription>
          </CardHeader>
          <CardContent>
            {bizModels.length === 0 && (
              <p className='text-xs italic text-red-900'>No business model created yet.</p>
            )}
            <div className="grid gap-4 md:grid-cols-3">
              {bizModels.map((model) => (
                <div key={model.id} className="relative">
                  <button
                    onClick={() => handleModelSelect(model.id)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${selectedModel === model.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                      }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Briefcase className="h-5 w-5 text-primary" />
                      <Badge variant="outline" className="font-mono text-xs">
                        {model.code}
                      </Badge>
                      <Badge variant={model.status === BIZMODEL_STATUS.PUBLISHED ? 'default' : 'secondary'}
                        className={model.status === BIZMODEL_STATUS.PUBLISHED ? 'bg-green-50 text-green-700 border-green-300' : 'bg-amber-50 text-amber-700 border-amber-300'}>
                        {model.status === BIZMODEL_STATUS.PUBLISHED ? `✓ ${BIZMODEL_STATUS.PUBLISHED}` : BIZMODEL_STATUS.DRAFT}
                      </Badge>
                    </div>
                    <h3 className="font-semibold mb-1">{model.name}</h3>
                    <p className="text-sm text-muted-foreground">{model.description || "Description is not provided"}</p>
                  </button>
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 h-7 px-2"
                      disabled={model.status === BIZMODEL_STATUS.PUBLISHED}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditModel(model.id);
                      }}
                    >
                      <Edit className="h-3 w-3" />
                      Edit
                    </Button>
                    {session.user.role === USER_ROLE.ADMIN && (
                      <Button
                        size="sm"
                        variant={model.status === BIZMODEL_STATUS.PUBLISHED ? 'secondary' : 'default'}
                        className="gap-1 h-7 px-2"
                        onClick={(e) => handleToggleStatus(model.id, e)}
                      >
                        {model.status === BIZMODEL_STATUS.PUBLISHED ? 'Unpublish' : 'Publish'}
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
          <Tabs defaultValue="config" className="space-y-4">
            <TabsList>
              <TabsTrigger value="config">Configuration</TabsTrigger>
              <TabsTrigger value="stages">Project Stages</TabsTrigger>
              <TabsTrigger value="milestones">Payment Milestones</TabsTrigger>
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
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">
                              {milestone.description}
                            </p>
                            <div className="flex items-center gap-2 flex-wrap text-xs">
                              <span className="text-muted-foreground">Stage:</span>
                              <Badge variant="outline" className="text-xs">
                                {milestone.stage_code}
                              </Badge>
                              {milestone.category_percentages && Object.entries(milestone.category_percentages).map(([catId, percentage]) => (
                                percentage > 0 && (
                                  <React.Fragment key={catId}>
                                    <span className="text-muted-foreground">{catId}:</span>
                                    <Badge className="bg-green-600">{percentage}%</Badge>
                                  </React.Fragment>
                                )
                              ))}
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
                  <CardDescription>Category-wise pricing rules and settings</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Model Code</p>
                        <p className="text-lg font-medium">{modelDetails.model.code}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Status</p>
                        <Badge variant={modelDetails.model.is_active ? 'default' : 'secondary'}>
                          {modelDetails.model.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">GST %</p>
                        <p className="text-lg font-medium">{modelDetails.model.gst_percentage}%</p>
                      </div>
                    </div>
                    
                    <div className="border-t pt-4 mt-4">
                      <h3 className="font-semibold mb-3">Categories & Rates</h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        {modelDetails.model.category_rates?.categories?.map((category, index) => (
                          <div key={index} className="p-4 border rounded-lg bg-slate-50">
                            <div className="mb-3">
                              <h4 className="font-bold text-primary">{category.category_name}</h4>
                              <p className="text-xs text-muted-foreground italic">{category.kg_label}</p>
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Max Item Discount:</span>
                                <span className="font-semibold">{category.max_item_discount_percentage}%</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">KG Charge:</span>
                                <span className="font-semibold text-blue-600">{category.kg_percentage}%</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Max KG Discount:</span>
                                <span className="font-semibold text-amber-600">{category.max_kg_discount_percentage}%</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className='grid grid-cols-1 text-right mt-4'>
                    <p className="text-xs font-semibold text-red-700 italic">
                      Rates applied to all estimations by default
                    </p>
                    <p className="text-xs font-semibold text-red-700 italic">
                      Discounts above maximum require approval
                    </p>
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
