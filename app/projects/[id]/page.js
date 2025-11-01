"use client";

import { useProjectData } from '@/app/context/ProjectDataContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PROJECT_STAGES, USER_ROLE } from '@/app/constants';
import { formatCurrency, getCategoryIcon } from '@/lib/utils';
import {
  Edit,
  FileText,
  Plus,
  StepBackIcon,
  Download,
  ChevronDown,
  ChevronRight,
  Upload,
  History
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import {
  useReactTable,
  getCoreRowModel,
  getExpandedRowModel,
  getGroupedRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table';
import { mkConfig, generateCsv, download } from 'export-to-csv';

// Helper to get grid columns based on category count
const getCategoryGridCols = (count) => {
  if (count <= 3) return 'md:grid-cols-3';
  if (count === 4) return 'md:grid-cols-4';
  if (count === 5 || count === 6) return 'md:grid-cols-3';
  return 'md:grid-cols-4'; // 4xN grid for 7+
};

export default function ProjectEstimationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id;
  const [estimationItems, setEstimationItems] = useState([]);
  const [estimationLoading, setEstimationLoading] = useState(true);
  const [projectBaseRates, setProjectBaseRates] = useState(null);

  //const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);
  const { project, estimation, loading } = useProjectData();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router, projectId]);

  useEffect(() => {
    if (project && project.id)
      fetchEstimationDetails();
  }, [loading])

  useEffect(() => {
    if (projectId) {
      fetchProjectAuxData();
      //fetchVersions();
    }
  }, [projectId]);

  // const fetchVersions = async () => {
  //   try {
  //     setVersionsLoading(true);
  //     const res = await fetch(`/api/projects/${projectId}/estimations/versions`);
  //     if (res.ok) {
  //       const data = await res.json();
  //       debugger;
  //       setVersions(data.versions || []);
  //       if (data.latest_version) {
  //         setLatestVersion(data.latest_version.toString());
  //         setSelectedVersion(data.latest_version.toString());
  //       }
  //     }
  //   } catch (error) {
  //     console.error('Error fetching versions:', error);
  //   } finally {
  //     setVersionsLoading(false);
  //   }
  // };

  // const handleVersionChange = async (versionNum) => {
  //   setSelectedVersion(versionNum);
  //   // Fetch version details and items
  //   try {
  //     setEstimationLoading(true);
  //     const res = await fetch(`/api/projects/${projectId}/estimations/versions/${versionNum}`);
  //     if (res.ok) {
  //       const data = await res.json();
  //       // Update estimation items
  //       setEstimationItems(data.items || []);
  //     } else {
  //       toast.error('Failed to load version details');
  //     }
  //   } catch (error) {
  //     console.error('Error loading version:', error);
  //     toast.error('Failed to load version details');
  //   } finally {
  //     setEstimationLoading(false);
  //   }
  // };

  const handleDownloadCSV = () => {
    const csvConfig = mkConfig({
      filename: `${project?.name || 'Project'}_Estimation_v${estimation?.version || 1}_${new Date().toISOString().split('T')[0]}`,
      useKeysAsHeaders: true,
      fieldSeparator: ',',
    });

    let csvData = [];
    if (estimationItems.length > 0) {
      csvData = estimationItems.map(item => ({
        room_name: item.room_name,
        category: item.category,
        item_name: item.item_name,
        unit: item.unit,
        width: item.width || '-',
        height: item.height || '-',
        quantity: item.quantity,
        unit_price: `${parseFloat(item.unit_price || 0).toLocaleString('en-IN')}`,
        subtotal: `${parseFloat(item.subtotal || 0).toLocaleString('en-IN')}`,
        karighar_charges_amount: `${parseFloat(item.karighar_charges_amount || 0).toLocaleString('en-IN')}`,
        discount_amount: `${parseFloat(item.discount_amount || 0).toLocaleString('en-IN')}`,
        gst_percentage: item.gst_percentage,
        item_total: `${parseFloat(item.item_total || 0).toLocaleString('en-IN')}`,
      }));
    } else {
      csvData = [{
        room_name: "",
        category: "",
        item_name: "",
        unit: "",
        width: "",
        height: "",
        quantity: "",
        unit_price: "",
        subtotal: "",
        karighar_charges_amount: "",
        discount_amount: "",
        gst_percentage: "",
        item_total: "",
      }]
    }

    const csv = generateCsv(csvConfig)(csvData);
    download(csvConfig)(csv);
    toast.success('CSV exported successfully!');
  };

  const fetchProjectAuxData = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/base-rates/active`);
      if (res.ok) {
        const data = await res.json();
        setProjectBaseRates(data.activeRate);
      }
    } catch (error) {
      console.error('Error fetching project base rates:', error);
    }
  };

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



  if (status === 'loading' || loading || estimationLoading ) {
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
    <div>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div>
                <CardTitle>Project Estimation</CardTitle>
                <CardDescription>
                  {estimation ? `Version ${estimation.version}`  : 'No estimation created yet'}
                </CardDescription>
              </div>

              {/* Version Selector */}
              {/* {versions.length > 0 && (
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <Select value={selectedVersion} onValueChange={handleVersionChange}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select version" />
                    </SelectTrigger>
                    <SelectContent>
                      {versions.map((v) => {
                        return <SelectItem key={v.version} value={v.version.toString()}>
                          Version {v.version} ({v.created_by})) {v.version === parseInt(latestVersion) && '(Latest)'}
                        </SelectItem>
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )} */}
            </div>

            <div className="flex gap-2">
              {/* Download CSV Button */}
              <Button
                onClick={() => handleDownloadCSV()}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Download CSV
              </Button>

              {/* Upload CSV or Edit Estimation Button */}
              <Link href={`/projects/upload/${projectId}`}>
                <Button size="sm" variant="outline" className="gap-2">
                  <Upload className="h-4 w-4" />
                  Upload CSV
                </Button>
              </Link>
              {estimation && (
                <Link href={`/projects/${projectId}/manage-estimation`}>
                  <Button size="sm" className="gap-2">
                    <Edit className="h-4 w-4" />
                    Edit Estimation
                  </Button>
                </Link>
              )}


            </div>
          </div>
          {/* {selectedVersion !== latestVersion && (
            <div className='w-full bg-red-100 text-red-700 font-semibold p-4 rounded-lg'>
              Caution: You are viewing old version of the estimation. Estimation is in "ReadOnly" mode.
            </div>
          )} */}
        </CardHeader>
        <CardContent>
          {estimation ? (
            <div className="space-y-4">
              {/* Dynamic Category Cards */}
              {projectBaseRates && projectBaseRates.category_rates && (
                <div className={`grid gap-4 ${getCategoryGridCols(projectBaseRates.category_rates.categories?.length || 4)}`}>
                  {projectBaseRates.category_rates.categories
                    ?.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                    .map(category => {
                      const categoryData = estimation.category_breakdown?.[category.id] || {};
                      return (
                        <div key={category.id} className="bg-slate-50 p-4 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <span>{getCategoryIcon(category.id)}</span>
                            <p className="text-sm text-muted-foreground">{category.category_name}</p>
                          </div>
                          {category.pay_to_vendor_directly && (
                            <div>
                              <p className={`text-xl font-bold line-through text-muted-foreground`}>
                                {formatCurrency(categoryData?.subtotal || 0)}
                              </p>
                              <span className='text-xs text-blue-500'>Paid to Vendors Directly</span>
                            </div>
                          )}
                          {!category.pay_to_vendor_directly && (
                            <p className={`text-xl font-bold`}>
                              {formatCurrency(categoryData?.subtotal || 0)}
                            </p>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}

              <div className="grid md:grid-cols-4 gap-4">
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <p className="text-sm text-green-700 mb-1">Service Charge</p>
                  <p className="text-xl font-bold text-green-700">+{formatCurrency(estimation.kg_charges || 0)}</p>
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


              <div className="space-y-8">
                {/* TanStack Table */}
                {projectBaseRates?.category_rates?.categories?.map((category) => {
                  const thisCategoryItems = estimationItems.filter((item) => item.category === category.id);
                  return (
                    <EstimationItemsTable key={category.id} category={category} project={project} estimation={estimation} projectBaseRates={projectBaseRates} estimationItems={thisCategoryItems} />
                  )
                })}


              </div>

            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No estimation created yet</p>
              <div className="flex gap-3 justify-center">
                <Link href={`/projects/upload/${projectId}`}>
                  <Button className="gap-2">
                    <Upload className="h-4 w-4" />
                    Upload CSV
                  </Button>
                </Link>
                <Link href={`/projects/${projectId}/manage-estimation`}>
                  <Button variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create Manually
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>


      {/* Cancel Estimation Confirmation Modal */}
      {/* <Dialog open={showCancelConfirmModal} onOpenChange={setShowCancelConfirmModal}>
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
      </Dialog> */}
    </div>
  );
}



const EstimationItemsTable = ({ category, project, estimation, projectBaseRates, estimationItems }) => {
  const [grouping, setGrouping] = useState([]);
  const [expanded, setExpanded] = useState({});
  const totals = useMemo(() => {
    const fields = [
      'subtotal',
      'item_discount_amount',
      'karighar_charges_amount',
      'discount_kg_charges_amount',
      'gst_amount',
      'item_total',
    ];

    const sums = {};
    fields.forEach(field => {
      sums[field] = estimationItems.reduce((sum, item) => sum + (parseFloat(item[field]) || 0), 0);
    });
    return sums;
  }, [estimationItems]);

  // TanStack Table Column Definitions
  const columns = useMemo(() => [
    {
      accessorKey: 'room_name',
      header: 'Room/Section',
      enableGrouping: true,
      cell: ({ getValue }) => getValue(),
    },
    {
      accessorKey: 'category',
      header: 'Category',
      enableGrouping: true,
      cell: ({ getValue }) => {
        // const value = getValue();
        // // Get category name from projectBaseRates
        // const category = projectBaseRates?.category_rates?.categories?.find(c => c.id === value);
        // return category?.category_name || value?.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
        return category.category_name;
      },
      // sortingFn: (rowA, rowB) => {
      //   const categories = projectBaseRates?.category_rates?.categories || [];

      //   // Build sort order map from category_rates
      //   const categoryOrder = {};
      //   categories.forEach(cat => {
      //     categoryOrder[cat.id] = cat.sort_order || 999;
      //   });

      //   const a = categoryOrder[rowA.original.category] || 999;
      //   const b = categoryOrder[rowB.original.category] || 999;
      //   return a - b;
      // },
    },
    {
      accessorKey: 'item_name',
      header: 'Item',
      enableGrouping: false,
      cell: ({ getValue }) => <div className="min-w-[100px]">{getValue()}</div>,
    },
    {
      accessorKey: 'unit',
      header: 'Unit',
      enableGrouping: false,
      cell: ({ getValue }) => <span className="capitalize">{getValue()}</span>,
    },
    {
      accessorKey: 'width',
      header: 'Width',
      enableGrouping: false,
      cell: ({ row }) => {
        if (row.original.unit === 'sqft' && row.original.width) {
          return parseFloat(row.original.width).toFixed(2);
        }
        return '-';
      },
    },
    {
      accessorKey: 'height',
      header: 'Height',
      enableGrouping: false,
      cell: ({ row }) => {
        if (row.original.unit === 'sqft' && row.original.height) {
          return parseFloat(row.original.height).toFixed(2);
        }
        return '-';
      },
    },
    {
      accessorKey: 'quantity',
      header: 'Quantity',
      enableGrouping: false,
      cell: ({ row }) => {
        const qty = parseFloat(row.original.quantity).toFixed(2);
        if (row.original.unit === 'sqft' && row.original.width && row.original.height) {
          return (
            <div className='min-w-[100px] w-full text-right block'>
              <div className="font-medium">{qty}</div>
              <div className="text-xs text-blue-600">
                ({row.original.width} × {row.original.height})
              </div>
            </div>
          );
        }
        return <span className='w-full text-right block'>{qty}</span>;
      },
      aggregationFn: 'sum',
      aggregatedCell: ({ getValue }) => {
        return <div className="font-bold w-full text-right block">{parseFloat(getValue()).toFixed(2)}</div>;
      },
    },
    {
      accessorKey: 'unit_price',
      header: 'Unit Price',
      enableGrouping: false,
      cell: ({ getValue }) => <span className='w-full text-right block'>{formatCurrency(getValue() || 0)}</span>,
    },
    {
      accessorKey: 'subtotal',
      header: 'Subtotal',
      enableGrouping: false,
      cell: ({ getValue }) => <span className="font-medium w-full text-right block">{formatCurrency(getValue() || 0)}</span>,
      aggregationFn: 'sum',
      aggregatedCell: ({ getValue }) => {
        return <span className="font-bold w-full text-right block">{formatCurrency(getValue() || 0)}</span>;
      },
    },
    {
      accessorKey: 'item_discount_amount',
      header: 'Discount',
      enableGrouping: false,
      cell: ({ row }) => (
        <div>
          <div className='w-full text-right block'>{formatCurrency(row.original.item_discount_amount || 0)}</div>
          <div className="text-xs text-red-500 w-full text-right block">({row.original.item_discount_percentage}%)</div>
        </div>
      ),
      aggregationFn: 'sum',
      aggregatedCell: ({ getValue }) => {
        return <span className="font-bold">{formatCurrency(getValue() || 0)}</span>;
      },
    },
    {
      accessorKey: 'karighar_charges_amount',
      header: 'KG Charges',
      enableGrouping: false,
      cell: ({ row }) => (
        <div>
          <div className='w-full text-right block'>{formatCurrency(row.original.karighar_charges_amount || 0)}</div>
          <div className="text-xs text-red-500 w-full text-right block">({row.original.karighar_charges_percentage}%)</div>
        </div>
      ),
      aggregationFn: 'sum',
      aggregatedCell: ({ getValue }) => {
        return <span className="font-bold">{formatCurrency(getValue() || 0)}</span>;
      },
    },
    {
      accessorKey: 'discount_kg_charges_amount',
      header: 'Discount on KG Charges',
      enableGrouping: false,
      cell: ({ row }) => (
        <div>
          <div className='w-full text-right block'>{formatCurrency(row.original.discount_kg_charges_amount || 0)}</div>
          <div className="text-xs text-red-500 w-full text-right block">({row.original.discount_kg_charges_percentage}%)</div>
        </div>
      ),
      aggregationFn: 'sum',
      aggregatedCell: ({ getValue }) => {
        return <span className="font-bold w-full text-right block">{formatCurrency(getValue() || 0)}</span>;
      },
    },
    {
      accessorKey: 'gst_percentage',
      header: 'GST%',
      enableGrouping: false,
      //cell: ({ getValue }) => <span className='w-full text-right block'>{getValue()}%</span>,
      cell: ({ row }) => (
        <div>
          <div className='w-full text-right block'>{formatCurrency(row.original.gst_amount || 0)}</div>
          <div className="text-xs text-red-500 w-full text-right block">({row.original.gst_percentage}%)</div>
        </div>
      ),
    },
    {
      accessorKey: 'item_total',
      header: 'Item Total',
      enableGrouping: false,
      cell: ({ getValue }) => (
        <span className="font-bold text-green-700 w-full text-right block">{formatCurrency(getValue() || 0)}</span>
      ),
      aggregationFn: 'sum',
      aggregatedCell: ({ getValue }) => {
        return <span className="font-bold text-green-700 w-full text-right block">{formatCurrency(getValue() || 0)}</span>;
      },
    },
  ], []);

  // TanStack Table Instance
  const table = useReactTable({
    data: estimationItems,
    columns,
    state: {
      grouping,
      expanded,
    },
    onGroupingChange: setGrouping,
    onExpandedChange: setExpanded,
    getExpandedRowModel: getExpandedRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    aggregationFns: {
      sum: (columnId, leafRows) => {
        return leafRows.reduce((sum, row) => {
          const value = row.getValue(columnId);
          return sum + (parseFloat(value) || 0);
        }, 0);
      },
    },
  });

  // CSV Export Function
  const onExportCSV = () => {
    const csvConfig = mkConfig({
      filename: `${project?.name || 'Project'}_${category.category_name}_Estimation_v${estimation?.version || 1}_${new Date().toISOString().split('T')[0]}`,
      useKeysAsHeaders: true,
      fieldSeparator: ',',
    });

    let csvData = [];
    if (estimationItems.length > 0) {
      csvData = estimationItems.map(item => ({
        room_name: item.room_name,
        category: item.category,
        item_name: item.item_name,
        unit: item.unit,
        width: item.width || '-',
        height: item.height || '-',
        quantity: item.quantity,
        unit_price: `${parseFloat(item.unit_price || 0).toLocaleString('en-IN')}`,
        subtotal: `${parseFloat(item.subtotal || 0).toLocaleString('en-IN')}`,
        karighar_charges_amount: `${parseFloat(item.karighar_charges_amount || 0).toLocaleString('en-IN')}`,
        discount_amount: `${parseFloat(item.discount_amount || 0).toLocaleString('en-IN')}`,
        gst_percentage: item.gst_percentage,
        item_total: `${parseFloat(item.item_total || 0).toLocaleString('en-IN')}`,
      }));
    } else {
      csvData = [{
        room_name: "",
        category: "",
        item_name: "",
        unit: "",
        width: "",
        height: "",
        quantity: "",
        unit_price: "",
        subtotal: "",
        karighar_charges_amount: "",
        discount_amount: "",
        gst_percentage: "",
        item_total: "",
      }]
    }

    const csv = generateCsv(csvConfig)(csvData);
    download(csvConfig)(csv);
    toast.success('CSV exported successfully!');
  };
  return (
    <div className='space-y-4'>
      {/* Export Button */}
      <div className="flex justify-between items-center">
        <div className='font-semibold leading-none tracking-tight'>{category.category_name}</div>
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
      <div className="border rounded-lg overflow-auto" style={{ maxHeight: '600px' }}>
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-slate-100 z-10">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    className="p-3 text-left font-semibold border-b-2 border-slate-300"
                    style={{ minWidth: header.column.id === 'item_name' ? '200px' : '100px' }}
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        className={header.column.getCanSort() ? 'cursor-pointer select-none' : ''}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {{
                          asc: ' 🔼',
                          desc: ' 🔽',
                        }[header.column.getIsSorted()] ?? null}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length == 0 && (
              <tr className="border-b hover:bg-slate-50">
                <td colSpan={14} className='h-14 p-2 border-r border-slate-200 bg-slate-200 text-center'>No items found</td>
              </tr>
            )}
            {table.getRowModel().rows.map(row => {
              // Determine row styling based on grouping level
              let rowClassName = '';
              let isGroupRow = row.getIsGrouped();

              if (isGroupRow) {
                const depth = row.depth;
                if (depth === 0) {
                  // Room level
                  rowClassName = 'bg-blue-100 font-bold text-blue-900';
                } else if (depth === 1) {
                  // Category level
                  rowClassName = 'bg-slate-100 font-semibold text-slate-700';
                }
              }

              return (
                <tr key={row.id} className={`border-b hover:bg-slate-50 ${rowClassName}`}>
                  {row.getVisibleCells().map((cell, cellIndex) => {
                    const isFirstCell = cellIndex === 0;
                    const paddingLeft = `${row.depth * 20 + 12}px`;

                    return (
                      <td
                        key={cell.id}
                        className="p-3 align-top"
                        style={isFirstCell ? { paddingLeft } : {}}
                      >
                        {isFirstCell && row.getCanExpand() && (
                          <button
                            onClick={row.getToggleExpandedHandler()}
                            className="inline-flex items-center mr-2"
                          >
                            {row.getIsExpanded() ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        )}
                        {cell.getIsGrouped() ? (
                          // Render group cell
                          <>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}{' '}
                            <span className="text-xs text-muted-foreground">
                              ({row.subRows.length})
                            </span>
                          </>
                        ) : cell.getIsAggregated() ? (
                          // Render aggregated cell
                          flexRender(
                            cell.column.columnDef.aggregatedCell ?? cell.column.columnDef.cell,
                            cell.getContext()
                          )
                        ) : cell.getIsPlaceholder() ? null : (
                          // Render regular cell
                          flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          {estimationItems.length > 0 && (
            <tfoot className="bg-slate-100 font-semibold border-t-2 border-slate-300">
              <tr>
                <td colSpan={8} className="text-right p-3">&nbsp;</td>
                <td className="text-right p-3">
                  {category.pay_to_vendor_directly && (
                    <span className='line-through text-muted-foreground'>{formatCurrency(totals.subtotal)}</span>
                  )}
                  {!category.pay_to_vendor_directly && (
                    <span>{formatCurrency(totals.subtotal)}</span>
                  )}
                </td>
                <td className="text-right p-3 text-red-600">{formatCurrency(totals.item_discount_amount)}</td>
                <td className="text-right p-3">{formatCurrency(totals.karighar_charges_amount)}</td>
                <td className="text-right p-3 text-red-600">{formatCurrency(totals.discount_kg_charges_amount)}</td>
                <td className="text-right p-3">{formatCurrency(totals.gst_amount)}</td>
                <td className="text-right p-3 text-green-700 font-bold">{formatCurrency(totals.item_total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}