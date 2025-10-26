"use client";

import { useProjectData } from '@/app/context/ProjectDataContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ESTIMATION_CATEGORY, PROJECT_STAGES, USER_ROLE } from '@/app/constants';
import { formatCurrency, UIFriendly } from '@/lib/utils';
import {
  Edit,
  FileText,
  Plus,
  StepBackIcon,
  Download
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

export default function ProjectEstimationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id;
  const [estimationItems, setEstimationItems] = useState([]);
  const [estimationLoading, setEstimationLoading] = useState(true);
  const gridRef = useRef();

  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);
  const { fetchProjectData, project, estimation, loading } = useProjectData();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router, projectId]);

  useEffect(() => {
    if (project && project.id)
      fetchEstimationDetails();
  }, [loading])

  const fetchEstimationDetails = async () => {
    try {
      if (estimation && estimation.id) {
        const itemsRes = await fetch(`/api/projects/${project.id}/estimations/${estimation.id}/items`);
        if (itemsRes.ok) {
          const itemsData = await itemsRes.json();
          setEstimationItems(itemsData.items);
        }
      }


    } catch (error) {
      console.error('Error fetching project estimations:', error);
      toast.error('Failed to load project estimations');
    } finally {
      setEstimationLoading(false);
    }
  };

  // AG-Grid Column Definitions
  const columnDefs = useMemo(() => [
    {
      field: 'room_name',
      headerName: 'Room/Section',
      rowGroup: true,
      hide: true,
      sortable: true,
    },
    {
      field: 'category',
      headerName: 'Category',
      rowGroup: true,
      hide: true,
      sortable: true,
      comparator: (valueA, valueB) => {
        const categoryOrder = {
          'woodwork': 1,
          'misc_internal': 2,
          'misc_external': 3,
          'shopping_service': 4
        };
        return (categoryOrder[valueA] || 999) - (categoryOrder[valueB] || 999);
      }
    },
    {
      field: 'description',
      headerName: 'Description',
      flex: 2,
      sortable: true,
      filter: true,
    },
    {
      field: 'unit',
      headerName: 'Unit',
      width: 100,
      cellStyle: { textTransform: 'capitalize' },
    },
    {
      field: 'width',
      headerName: 'Width',
      width: 100,
      type: 'numericColumn',
      valueGetter: (params) => {
        if (params.data && params.data.unit === 'sqft' && params.data.width) {
          return parseFloat(params.data.width).toFixed(2);
        }
        return '-';
      },
    },
    {
      field: 'height',
      headerName: 'Height',
      width: 100,
      type: 'numericColumn',
      valueGetter: (params) => {
        if (params.data && params.data.unit === 'sqft' && params.data.height) {
          return parseFloat(params.data.height).toFixed(2);
        }
        return '-';
      },
    },
    {
      field: 'quantity',
      headerName: 'Quantity',
      width: 130,
      type: 'numericColumn',
      cellRenderer: (params) => {
        if (!params.data) return '';
        const qty = parseFloat(params.data.quantity).toFixed(2);
        if (params.data.unit === 'sqft' && params.data.width && params.data.height) {
          return (
            <div>
              <div className="font-medium">{qty}</div>
              <div className="text-xs text-blue-600">
                ({params.data.width} × {params.data.height})
              </div>
            </div>
          );
        }
        return qty;
      },
    },
    {
      field: 'unit_price',
      headerName: 'Unit Price',
      width: 120,
      type: 'numericColumn',
      valueFormatter: (params) => formatCurrency(params.value || 0),
    },
    {
      field: 'subtotal',
      headerName: 'Subtotal',
      width: 130,
      type: 'numericColumn',
      aggFunc: 'sum',
      valueFormatter: (params) => formatCurrency(params.value || 0),
      cellStyle: { fontWeight: '500' },
    },
    {
      field: 'karighar_charges_amount',
      headerName: 'KG Charges',
      width: 140,
      type: 'numericColumn',
      aggFunc: 'sum',
      cellRenderer: (params) => {
        if (!params.data) {
          // This is a group row, show aggregated value
          return formatCurrency(params.value || 0);
        }
        return (
          <div>
            <div>{formatCurrency(params.data.karighar_charges_amount || 0)}</div>
            <div className="text-xs text-red-500">({params.data.karighar_charges_percentage}%)</div>
          </div>
        );
      },
    },
    {
      field: 'discount_amount',
      headerName: 'Discount',
      width: 130,
      type: 'numericColumn',
      aggFunc: 'sum',
      cellRenderer: (params) => {
        if (!params.data) {
          return formatCurrency(params.value || 0);
        }
        return (
          <div>
            <div>{formatCurrency(params.data.discount_amount || 0)}</div>
            <div className="text-xs text-red-500">({params.data.discount_percentage}%)</div>
          </div>
        );
      },
    },
    {
      field: 'gst_percentage',
      headerName: 'GST%',
      width: 90,
      type: 'numericColumn',
      valueFormatter: (params) => params.data ? `${params.value}%` : '',
    },
    {
      field: 'item_total',
      headerName: 'Item Total',
      width: 150,
      type: 'numericColumn',
      aggFunc: 'sum',
      valueFormatter: (params) => formatCurrency(params.value || 0),
      cellStyle: { fontWeight: 'bold', color: '#059669' },
    },
  ], []);

  // Default column properties
  const defaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
  }), []);

  // Auto group column definition
  const autoGroupColumnDef = useMemo(() => ({
    headerName: 'Room / Category',
    minWidth: 250,
    cellRendererParams: {
      suppressCount: false,
      checkbox: false,
    },
    cellRenderer: 'agGroupCellRenderer',
    cellStyle: (params) => {
      if (params.node.level === 0) {
        // Room level - blue background
        return { 
          backgroundColor: '#dbeafe',
          fontWeight: 'bold',
          fontSize: '15px',
          color: '#1e40af'
        };
      } else if (params.node.level === 1) {
        // Category level - slate background
        return { 
          backgroundColor: '#f1f5f9',
          fontWeight: '600',
          fontSize: '14px',
          color: '#475569'
        };
      }
      return {};
    },
  }), []);

  // Export to CSV function
  const onExportCSV = () => {
    if (gridRef.current && gridRef.current.api) {
      gridRef.current.api.exportDataAsCsv({
        fileName: `${project?.name || 'Project'}_Estimation_v${estimation?.version || 1}_${new Date().toISOString().split('T')[0]}.csv`,
        columnKeys: [
          'room_name', 
          'category', 
          'description', 
          'unit',
          'width', 
          'height', 
          'quantity', 
          'unit_price', 
          'subtotal',
          'karighar_charges_amount',
          'discount_amount',
          'gst_percentage',
          'item_total'
        ],
        processCellCallback: (params) => {
          // Format currency values
          if (['unit_price', 'subtotal', 'karighar_charges_amount', 'discount_amount', 'item_total'].includes(params.column.getColId())) {
            return `₹${parseFloat(params.value || 0).toLocaleString('en-IN')}`;
          }
          return params.value;
        }
      });
      toast.success('CSV exported successfully!');
    }
  };

  // Helper function to group and sort estimation items
  const sortedGroupedItems = () => {
    const grouped = estimationItems.reduce((acc, item) => {
      const roomName = item.room_name || 'Unassigned';
      const category = item.category || 'misc';
      
      if (!acc[roomName]) {
        acc[roomName] = {};
      }
      if (!acc[roomName][category]) {
        acc[roomName][category] = [];
      }
      acc[roomName][category].push(item);
      return acc;
    }, {});

    // Sort categories within each room
    Object.keys(grouped).forEach(roomName => {
      const categoryOrder = {
        'woodwork': 1,
        'misc_internal': 2,
        'misc_external': 3,
        'shopping_service': 4
      };
      
      const sortedCategories = {};
      Object.keys(grouped[roomName])
        .sort((a, b) => (categoryOrder[a] || 999) - (categoryOrder[b] || 999))
        .forEach(category => {
          sortedCategories[category] = grouped[roomName][category];
        });
      
      grouped[roomName] = sortedCategories;
    });

    return grouped;
  };

  if (status === 'loading' || loading || estimationLoading) {
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

  return (
    <div>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Project Estimation</CardTitle>
              <CardDescription>
                {estimation ? `Version ${estimation.version} • ${estimation.status}` : 'No estimation created yet'}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {(estimation && (estimation.created_by === session.user.id || session.user.role === USER_ROLE.ADMIN) && (estimation.version > 1)) && (
                <Button
                  onClick={() => setShowCancelConfirmModal(true)}
                  variant="outline"
                  className="border-orange-500 text-orange-700 hover:bg-orange-50"
                >
                  <StepBackIcon className="h-4 w-4" />
                  Revert to v{estimation.version - 1}
                </Button>
              )}
              <Link href={`/projects/${projectId}/manage-estimation`}>
                <Button size="sm" className="gap-2">
                  {estimation ? <Edit className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {estimation ? 'Edit Estimation' : 'Create Estimation'}
                </Button>
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {estimation ? (
            <div className="space-y-4">
              <div className="grid md:grid-cols-4 gap-4">
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">{UIFriendly(ESTIMATION_CATEGORY.WOODWORK)}</p>
                  <p className="text-xl font-bold">{formatCurrency(estimation.woodwork_value)}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">{UIFriendly(ESTIMATION_CATEGORY.MISC_INTERNAL)}</p>
                  <p className="text-xl font-bold">{formatCurrency(estimation.misc_internal_value)}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">{UIFriendly(ESTIMATION_CATEGORY.MISC_EXTERNAL)}</p>
                  <p className="text-xl font-bold">{formatCurrency(estimation.misc_external_value)}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">{UIFriendly(ESTIMATION_CATEGORY.SHOPPING_SERVICE)}</p>
                  <p className="text-xl font-bold">{formatCurrency(estimation.shopping_service_value)}</p>
                </div>
              </div>

              <div className="grid md:grid-cols-4 gap-4">
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <p className="text-sm text-green-700 mb-1">Service Charge</p>
                  <p className="text-xl font-bold text-green-700">+{formatCurrency(estimation.service_charge || 0)}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <p className="text-sm text-red-700 mb-1">Discount</p>
                  <p className="text-xl font-bold text-red-700">
                    {formatCurrency(estimation.discount > 0 ? -estimation.discount : 0)}
                  </p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-700 mb-1">GST</p>
                  <p className="text-xl font-bold text-blue-700">
                    +{formatCurrency(estimation.gst_amount || 0)}</p>
                </div>
                <div className="bg-primary/10 p-4 rounded-lg border border-primary">
                  <p className="text-sm text-primary mb-1">Final Total (with GST)</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(parseFloat(estimation.final_value || 0))}</p>
                </div>
              </div>

              {estimation.requires_approval && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                  <p className="text-sm font-medium text-amber-800">⚠️ This estimation requires approval</p>
                  <p className="text-xs text-amber-700 mt-1">Discount exceeds maximum allowed percentage</p>
                </div>
              )}

              {estimationItems.length > 0 && (
                <div className="space-y-4">
                  {/* Export Button */}
                  <div className="flex justify-end">
                    <Button 
                      onClick={onExportCSV} 
                      variant="outline" 
                      size="sm"
                      className="gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Export to CSV
                    </Button>
                  </div>

                  {/* AG-Grid */}
                  <div className="ag-theme-alpine" style={{ height: 600, width: '100%' }}>
                    <AgGridReact
                      ref={gridRef}
                      rowData={estimationItems}
                      columnDefs={columnDefs}
                      defaultColDef={defaultColDef}
                      autoGroupColumnDef={autoGroupColumnDef}
                      groupDefaultExpanded={1}
                      animateRows={true}
                      enableRangeSelection={true}
                      suppressAggFuncInHeader={true}
                      grandTotalRow="bottom"
                    />
                  </div>

                  {/* Grand Totals Summary */}
                  <div className="border rounded-lg overflow-hidden bg-slate-50 p-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Subtotal</p>
                        <p className="text-lg font-bold">
                          {formatCurrency(
                            parseFloat(estimation.woodwork_value || 0) + 
                            parseFloat(estimation.misc_internal_value || 0) + 
                            parseFloat(estimation.misc_external_value || 0) + 
                            parseFloat(estimation.shopping_service_value || 0)
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Service Charges</p>
                        <p className="text-lg font-bold text-green-600">
                          {formatCurrency(parseFloat(estimation.service_charge || 0))}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Discounts</p>
                        <p className="text-lg font-bold text-red-600">
                          {formatCurrency(parseFloat(estimation.discount || 0))}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Grand Total</p>
                        <p className="text-xl font-bold text-green-700">
                          {formatCurrency(estimation.final_value)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No estimation created yet</p>
              <Link href={`/projects/${projectId}/manage-estimation`}>
                <Button>Create Estimation</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>


      {/* Cancel Estimation Confirmation Modal */}
      <Dialog open={showCancelConfirmModal} onOpenChange={setShowCancelConfirmModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-orange-900">Cancel Estimation & Revert?</DialogTitle>
            <DialogDescription>
              This action cannot be undone
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 py-4">
            <div className="space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-sm text-orange-900 font-medium mb-2">You are about to:</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-orange-800 ml-2">
                  <li>Delete estimation version {estimation?.version}</li>
                  <li>Revert to version {(estimation?.version || 1) - 1}</li>
                  <li>Remove all items from the cancelled version</li>
                </ul>
              </div>
              <p className="text-sm text-muted-foreground">
                This will restore the previous estimation as active.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCancelConfirmModal(false)}
            >
              Keep Current Version
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={async () => {
                try {
                  const res = await fetch(`/api/projects/${projectId}/estimations/${estimation.id}/rollback`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                  });
                  if (res.ok) {
                    toast.success('Estimation cancelled and reverted to previous version.');
                    setShowCancelConfirmModal(false);
                    fetchProjectData();
                  } else {
                    const data = await res.json();
                    toast.error(data.error || 'Failed to cancel estimation');
                  }
                } catch (error) {
                  console.error('Error:', error);
                  toast.error('An error occurred');
                }
              }}
            >
              Yes, Cancel & Revert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}