"use client";

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ESTIMATION_CATEGORY, ESTIMATION_STATUS } from '@/app/constants';
import { AlertTriangle, Plus, Save, Trash2, Copy } from 'lucide-react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useProjectData } from "@/app/context/ProjectDataContext";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';



export default function ProjectEstimationPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id;


  const [itemsLoading, setItemsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showOverpaymentModal, setShowOverpaymentModal] = useState(false);
  const [overpaymentData, setOverpaymentData] = useState(null);
  const [pendingSubmitData, setPendingSubmitData] = useState(null);
  const [data, setData] = useState([
    {
      id: Date.now(),
      room_name: '',
      category: '',
      item_name: '',
      unit: 'sqft',
      width: '',
      height: '',
      quantity: 1,
      unit_price: 0,
      karighar_charges_percentage: 0,
      discount_percentage: 0,
      gst_percentage: 0,
      vendor_type: ''
    }
  ]);
  const [bizModel, setBizModel] = useState({
    gst_percentage: ''
  });

  const [formData, setFormData] = useState({
    remarks: '',
    status: ESTIMATION_STATUS.DRAFT,
  });

  const { fetchProjectData, project, estimation, loading } = useProjectData();
  const tableContainerRef = useRef(null);

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

      // Load biz model details
      const bizModelRes = await fetch(`/api/biz-models/${project.biz_model_id}`);
      let bizModelData = null;
      if (bizModelRes.ok) {
        bizModelData = await bizModelRes.json();
        setBizModel(bizModelData.model);
      } else {
        throw new Error('Failed to fetch business model');
      }

      // Load existing estimation if available
      if (estimation && estimation.id) {
        setFormData({
          remarks: estimation.remarks || '',
          status: estimation.status,
        });

        const itemsRes = await fetch(`/api/projects/${projectId}/estimations/${estimation.id}/items`);
        if (itemsRes.ok) {
          const itemsData = await itemsRes.json();
          if (itemsData.items.length > 0) {
            setData(itemsData.items.map(item => ({
              id: item.id || Date.now() + Math.random(),
              room_name: item.room_name || '',
              category: item.category,
              item_name: item.item_name,
              unit: item.unit || 'sqft',
              width: item.width || '',
              height: item.height || '',
              quantity: parseFloat(item.quantity),
              unit_price: parseFloat(item.unit_price),
              karighar_charges_percentage: parseFloat(item.karighar_charges_percentage),
              discount_percentage: parseFloat(item.discount_percentage),
              gst_percentage: parseFloat(item.gst_percentage),
              vendor_type: item.vendor_type
            })));
          }
        }
      }

    } catch (error) {
      console.error('Error fetching project estimation items:', error);
      toast.error('Failed to load project estimation items');
    } finally {
      setItemsLoading(false);
    }
  };

  const addItem = () => {
    setData([...data, {
      id: Date.now(),
      room_name: '',
      category: '',
      item_name: '',
      unit: 'sqft',
      width: '',
      height: '',
      quantity: 1,
      unit_price: 0,
      karighar_charges_percentage: 0,
      discount_percentage: 0,
      gst_percentage: bizModel.gst_percentage,
      vendor_type: ''
    }]);
  };

  const removeItem = (index) => {
    const newData = data.filter((_, i) => i !== index);
    setData(newData);
  };

  const updateItem = (index, field, value) => {
    const newData = [...data];
    newData[index][field] = value;

    // Auto-calculate quantity for sqft unit
    if (field === 'width' || field === 'height' || field === 'unit') {
      const item = newData[index];
      if (item.unit === 'sqft' && item.width && item.height) {
        item.quantity = parseFloat(item.width) * parseFloat(item.height);
      }
    }

    if (field === "category") {
      newData[index]["karighar_charges_percentage"] = getDefaultCharges(value)
      newData[index]["gst_percentage"] = newData[index]["gst_percentage"].length > 0 ? newData[index]["gst_percentage"] : bizModel.gst_percentage;
    }
    setData(newData);
  };

  const duplicateItem = (index) => {
    const itemToDuplicate = { ...data[index], id: Date.now() };
    const newData = [
      ...data.slice(0, index + 1),
      itemToDuplicate,
      ...data.slice(index + 1)
    ];
    setData(newData);
    toast.success('Item duplicated');
  };

  function registerCellRef(table, rowIndex, columnId, ref) {
    const key = `${rowIndex}-${columnId}`;
    table.options.meta.cellRefs[key] = ref;
  }

  function focusCell(table, rowIndex, columnId, retries = 5) {
    const key = `${rowIndex}-${columnId}`;
    const ref = table.options.meta.cellRefs[key];

    if (ref?.current) {
      // ✅ Focus immediately
      ref.current.focus();
      ref.current.select?.();
      ref.current.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    } else if (retries > 0) {
      // ⏳ The next cell may not exist yet — try again shortly
      queueMicrotask(() => focusCell(table, rowIndex, columnId, retries - 1));
    }
  }



  // Editable Cell Components
  const EditableTextCell = ({ getValue, row, column, table, type = "text", readOnly = false }) => {
    const initialValue = getValue();
    const [value, setValue] = useState(initialValue ?? "");
    const inputRef = useRef(null);

    // register ref immediately
    registerCellRef(table, row.index, column.id, inputRef);

    useEffect(() => {
      setValue(initialValue ?? "");
    }, [initialValue]);

    const onBlur = () => {
      table.options.meta?.updateData(row.index, column.id, value);
    };

    const onKeyDown = (e) => {
      const visibleCols = table.getVisibleLeafColumns();
      const currentColIndex = visibleCols.findIndex(c => c.id === column.id);

      if (e.key === "Enter") {
        e.preventDefault();
        onBlur();
        setTimeout(() => focusCell(table, row.index + 1, column.id), 0);
      } else if (e.key === "Tab") {
        debugger;
        e.preventDefault();
        onBlur();
        const nextCol = visibleCols[currentColIndex + (e.shiftKey ? -1 : 1)];
        if (nextCol) setTimeout(focusCell(table, row.index, nextCol.id), 0);
        else focusCell(table, row.index + 1, visibleCols[0].id);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setTimeout(focusCell(table, row.index + 1, column.id), 0);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setTimeout(focusCell(table, row.index - 1, column.id), 0);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const nextCol = visibleCols[currentColIndex + 1];
        if (nextCol) setTimeout(focusCell(table, row.index, nextCol.id), 0);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const prevCol = visibleCols[currentColIndex - 1];
        if (prevCol) setTimeout(focusCell(table, row.index, prevCol.id), 0);
      } else if (e.key === "Escape") {
        setValue(initialValue ?? "");
        inputRef.current?.blur();
      }
    };

    return (
      <Input
        readOnly={readOnly}
        ref={inputRef}
        type={type}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        className={`h-8 text-sm ${readOnly ? "border border-gray-300 text-gray-400" : ""}`}
        data-row={row.index}
        data-col={column.id}
      />
    );
  };


  const EditableNumberCell = ({ readOnly = false, ...props }) => {
    return <EditableTextCell {...props} type="number" readOnly={readOnly} />;
  };

  const EditableSelectCell = ({ getValue, row, column, table, options }) => {
    const initialValue = getValue();
    const selectRef = useRef(null);

    // ✅ Register ref immediately during render
    registerCellRef(table, row.index, column.id, selectRef);

    const onChange = (value) => {
      table.options.meta?.updateData(row.index, column.id, value);
    };

    return (
      <Select
        value={initialValue}
        onValueChange={onChange}
      >
        <SelectTrigger ref={selectRef} className="h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };


  // Column Definitions
  const columns = useMemo(() => [
    {
      accessorKey: 'room_name',
      header: 'Room/Section',
      size: 150,
      cell: EditableTextCell,
    },
    {
      accessorKey: 'category',
      header: 'Category',
      size: 130,
      cell: ({ getValue, row, column, table }) => (
        <EditableSelectCell
          getValue={getValue}
          row={row}
          column={column}
          table={table}
          options={Object.entries(ESTIMATION_CATEGORY).map(([key, value]) => ({
            value: value,
            label: value.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())
          }))}
        />
      ),
    },
    {
      accessorKey: 'item_name',
      header: 'Description',
      size: 180,
      cell: EditableTextCell,
    },
    {
      accessorKey: 'unit',
      header: 'Unit',
      size: 100,
      cell: ({ getValue, row, column, table }) => (
        <EditableSelectCell
          getValue={getValue}
          row={row}
          column={column}
          table={table}
          options={[
            { value: 'sqft', label: 'Sq.ft' },
            { value: 'no', label: 'No' },
            { value: 'lumpsum', label: 'Lumpsum' }
          ]}
        />
      ),
    },
    {
      accessorKey: 'width',
      header: 'Width',
      size: 90,
      cell: ({ row, ...props }) => {
        // if (row.original.unit === 'sqft') {
        //   return <EditableNumberCell row={row} {...props} />;
        // }
        // return <EditableNumberCell row={row} {...props} />;
        return <EditableNumberCell
          row={row}
          {...props}
          readOnly={row.original.unit !== 'sqft'}
        />
      },
    },
    {
      accessorKey: 'height',
      header: 'Height',
      size: 90,
      cell: ({ row, ...props }) => {
        // if (row.original.unit === 'sqft') {
        //   return <EditableNumberCell row={row} {...props} />;
        // }
        // return <EditableNumberCell row={row} {...props} readOnly="true" />;
        return <EditableNumberCell
          row={row}
          {...props}
          readOnly={row.original.unit !== 'sqft'}
        />
      },
    },
    {
      accessorKey: 'quantity',
      header: 'Quantity',
      size: 100,
      cell: ({ row, getValue, ...props }) => {
        // if (row.original.unit === 'sqft') {
        //   const qty = getValue();
        //   const { width, height } = row.original;
        //   return (
        //     <div className="text-sm">
        //       <EditableNumberCell row={row} getValue={getValue} {...props} readOnly="true" />
        //     </div>
        //   );
        // }
        return <EditableNumberCell row={row} getValue={getValue} {...props} readOnly={row.original.unit === 'sqft'} />;
      },
    },
    {
      accessorKey: 'unit_price',
      header: 'Unit Price (₹)',
      size: 120,
      cell: EditableNumberCell,
    },
    {
      accessorKey: 'karighar_charges_percentage',
      header: 'KG Charges (%)',
      size: 120,
      cell: EditableNumberCell,
    },
    {
      accessorKey: 'discount_percentage',
      header: 'Discount (%)',
      size: 110,
      cell: EditableNumberCell,
    },
    {
      accessorKey: 'gst_percentage',
      header: 'GST (%)',
      size: 90,
      cell: EditableNumberCell,
    },
    {
      accessorKey: 'vendor_type',
      header: 'Vendor',
      size: 100,
      cell: ({ getValue, row, column, table }) => (
        <EditableSelectCell
          getValue={getValue}
          row={row}
          column={column}
          table={table}
          options={[
            { value: 'PI', label: 'PI' },
            { value: 'Aristo', label: 'Aristo' },
            { value: 'Other', label: 'Other' }
          ]}
        />
      ),
    },
    {
      id: 'item_total',
      header: 'Item Total',
      size: 120,
      cell: ({ row }) => {
        const total = calculateItemTotal(row.original).item_total;
        return (
          <div className="font-medium text-green-700 text-sm">
            {formatCurrency(total)}
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      size: 100,
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => duplicateItem(row.index)}
            className="h-7 w-7 p-0"
            title="Duplicate"
          >
            <Copy className="h-3 w-3" />
          </Button>
          {data.length > 1 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => removeItem(row.index)}
              className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
              title="Delete"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      ),
    },
  ], [data, bizModel]);

  const cellRefs = useRef({});

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    meta: {
      updateData: (rowIndex, columnId, value) => {
        updateItem(rowIndex, columnId, value);
      },
      cellRefs: cellRefs.current, // <--- store refs
    },
  });

  const calculateItemTotal = (item) => {
    const quantity = parseFloat(item.quantity) || 0;
    const unitPrice = parseFloat(item.unit_price) || 0;
    const karigharChargesPerc = parseFloat(item.karighar_charges_percentage) || 0;
    const discountPerc = parseFloat(item.discount_percentage) || 0;
    const gstPerc = parseFloat(item.gst_percentage) || 0;

    // Step 1: Calculate subtotal
    let subtotal = 0;
    if (item.category === 'shopping_service')
      subtotal = quantity * unitPrice;
    else
      subtotal = quantity * unitPrice;

    // Step 2: Calculate karighar charges
    let karigharChargesAmount = 0;
    if (item.category === 'shopping_service')
      karigharChargesAmount = (subtotal * karigharChargesPerc) / 100;
    else
      karigharChargesAmount = subtotal * karigharChargesPerc / 100;

    // Step 3: Calculate discount
    let discountAmount = 0;
    if (item.category === 'shopping_service') {
      //discountAmount = (karigharChargesAmount * discountPerc) / 100;
      discountAmount = (subtotal * discountPerc) / 100;
    } else {
      //discountAmount = ((subtotal + karigharChargesAmount) * discountPerc) / 100;
      discountAmount = (subtotal * discountPerc) / 100;
    }

    // Step 4: Calculate amount before GST
    let amountBeforeGst = 0;
    if (item.category === 'shopping_service') {
      amountBeforeGst = karigharChargesAmount - discountAmount;
    } else {
      amountBeforeGst = subtotal + karigharChargesAmount - discountAmount;
    }

    // Step 5: Calculate GST
    const gstAmount = (amountBeforeGst * gstPerc) / 100;

    // Step 6: Final item total
    const itemTotal = amountBeforeGst + gstAmount;

    return {
      subtotal,
      karighar_charges_amount: karigharChargesAmount,
      discount_amount: discountAmount,
      amount_before_gst: amountBeforeGst,
      gst_amount: gstAmount,
      item_total: itemTotal
    };
  };

  const calculateTotals = () => {
    let woodworkSubtotal = 0;
    let woodworkTotal = 0;
    let woodworkKGCharges = 0;
    let woodworkDiscounts = 0;

    let miscInternalSubtotal = 0;
    let miscInternalTotal = 0;
    let miscInternalKGCharges = 0;
    let miscInternalDiscounts = 0;

    let miscExternalSubtotal = 0;
    let miscExternalTotal = 0;
    let miscExternalKGCharges = 0;
    let miscExternalDiscounts = 0;

    let shoppingServiceSubtotal = 0;
    let shoppingServiceTotal = 0;
    let shoppingKGCharges = 0;
    let shoppingDiscounts = 0;

    let totalGst = 0;

    data.forEach(item => {
      const itemCalc = calculateItemTotal(item);

      if (item.category === ESTIMATION_CATEGORY.WOODWORK) {
        woodworkSubtotal += itemCalc.subtotal;
        woodworkKGCharges += itemCalc.karighar_charges_amount;
        woodworkDiscounts += itemCalc.discount_amount;
        woodworkTotal += itemCalc.item_total;
      } else if (item.category === ESTIMATION_CATEGORY.MISC_INTERNAL) {
        miscInternalSubtotal += itemCalc.subtotal;
        miscInternalKGCharges += itemCalc.karighar_charges_amount;
        miscInternalDiscounts += itemCalc.discount_amount;
        miscInternalTotal += itemCalc.item_total;
      } else if (item.category === ESTIMATION_CATEGORY.MISC_EXTERNAL) {
        miscExternalSubtotal += itemCalc.subtotal;
        miscExternalKGCharges += itemCalc.karighar_charges_amount;
        miscExternalDiscounts += itemCalc.discount_amount;
        miscExternalTotal += itemCalc.item_total;
      } else if (item.category === ESTIMATION_CATEGORY.SHOPPING_SERVICE) {
        // For shopping, the subTotal is paid to vendor's directly
        shoppingServiceSubtotal = itemCalc.subtotal;
        shoppingKGCharges += itemCalc.karighar_charges_amount;
        shoppingDiscounts += itemCalc.discount_amount;
        shoppingServiceTotal += itemCalc.item_total;
      }

      totalGst += itemCalc.gst_amount;
    });



    const serviceCharge = woodworkKGCharges + miscInternalKGCharges + miscExternalKGCharges + shoppingKGCharges;
    const discount = woodworkDiscounts + miscInternalDiscounts + miscExternalDiscounts + shoppingDiscounts;
    const grandTotal = woodworkTotal + miscInternalTotal + miscExternalTotal + shoppingServiceTotal;

    return {
      woodwork_value: woodworkSubtotal,
      misc_internal_value: miscInternalSubtotal,
      misc_external_value: miscExternalSubtotal,
      shopping_service_value: shoppingServiceSubtotal,
      service_charge: serviceCharge,
      discount: discount,
      gst_amount: totalGst,
      final_value: grandTotal
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const totals = calculateTotals();

      // First, check for overpayment before creating
      const checkRes = await fetch(`/api/projects/${projectId}/check-overpayment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          final_value: totals.final_value
        })
      });


      if (checkRes.ok) {
        const checkData = await checkRes.json();

        if (checkData.has_overpayment) {
          // Show modal and wait for user decision
          setOverpaymentData(checkData);

          // Prepare items with calculated values
          const itemsWithCalcs = data
            .filter(item => item.item_name.trim() !== '')
            .map(item => {
              const calc = calculateItemTotal(item);
              return {
                ...item,
                item_name: item.item_name,
                subtotal: calc.subtotal,
                karighar_charges_amount: calc.karighar_charges_amount,
                discount_amount: calc.discount_amount,
                amount_before_gst: calc.amount_before_gst,
                gst_amount: calc.gst_amount,
                item_total: calc.item_total
              };
            });

          setPendingSubmitData({
            project_id: projectId,
            ...totals,
            remarks: formData.remarks,
            status: formData.status,
            items: itemsWithCalcs
          });
          setShowOverpaymentModal(true);
          setSaving(false);
          return; // Stop here and wait for user action
        }
      }

      // No overpayment, proceed normally
      const itemsWithCalcs = data
        .filter(item => item.item_name.trim() !== '')
        .map(item => {
          const calc = calculateItemTotal(item);
          return {
            ...item,
            item_name: item.item_name,
            subtotal: calc.subtotal,
            karighar_charges_amount: calc.karighar_charges_amount,
            discount_amount: calc.discount_amount,
            amount_before_gst: calc.amount_before_gst,
            gst_amount: calc.gst_amount,
            item_total: calc.item_total
          };
        });

      await saveEstimation({
        project_id: projectId,
        ...totals,
        remarks: formData.remarks,
        status: formData.status,
        items: itemsWithCalcs
      });

    } catch (error) {
      console.error('Error:', error);
      toast.error('An error occurred #123');
      setSaving(false);
    }
  };

  const saveEstimation = async (data) => {
    try {
      const res = await fetch(`/api/projects/${data.project_id}/estimations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        const responseData = await res.json();

        // // Check if overpayment was detected (shouldn't happen now, but keep for safety)
        // if (responseData.warning === 'overpayment_detected' && responseData.overpayment) {
        //   toast.warning(
        //     `⚠️ OVERPAYMENT DETECTED: ₹${responseData.overpayment.amount.toLocaleString('en-IN')}. Admin approval required.`,
        //     { duration: 8000 }
        //   );
        // } else {
        //   toast.success('Estimation saved successfully!');
        // }
        await fetchProjectData();
        router.push(`/projects/${projectId}`);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to save estimation');
      }
    } catch (error) {
      console.error('Error saving estimation:', error);
      toast.error('An error occurred #321');
    } finally {
      setSaving(false);
    }
  };

  const totals = calculateTotals();

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const getDefaultCharges = (itemCategory) => {
    switch (itemCategory) {
      case ESTIMATION_CATEGORY.WOODWORK:
        return bizModel.design_charge_percentage;
      case ESTIMATION_CATEGORY.MISC_EXTERNAL:
      case ESTIMATION_CATEGORY.MISC_INTERNAL:
        return bizModel.service_charge_percentage;
      case ESTIMATION_CATEGORY.SHOPPING_SERVICE:
        return bizModel.shopping_charge_percentage;
      default:
        return 0;

    }
  }
  const getMaxDiscount = (index) => {
    const itemCategory = data[index].category;
    switch (itemCategory) {
      case ESTIMATION_CATEGORY.WOODWORK:
        return bizModel.max_design_charge_discount_percentage;
      case ESTIMATION_CATEGORY.MISC_INTERNAL:
      case ESTIMATION_CATEGORY.MISC_EXTERNAL:
        return bizModel.max_service_charge_discount_percentage;
      case ESTIMATION_CATEGORY.SHOPPING_SERVICE:
        return bizModel.max_shopping_charge_discount_percentage;
      default:
        return 0;
    }
  }

  if (status === 'loading' || loading || itemsLoading) {
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
    <div className="min-h-screen bg-slate-50">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Line Items */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Estimation Items</CardTitle>
                <CardDescription>Add all project items with pricing details</CardDescription>
              </div>
              <Button type="button" onClick={addItem} variant="outline" size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Action Buttons */}
            <div className="w-full flex justify-end items-center mb-4">
              
              <div className="text-sm text-muted-foreground">
                Total Items: {data.length}
              </div>
            </div>

            {/* TanStack Table */}
            <div
              ref={tableContainerRef}
              className="border rounded-lg overflow-auto"
              style={{ maxHeight: '600px' }}
            >
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 bg-slate-100 z-10">
                  {table.getHeaderGroups().map(headerGroup => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map(header => (
                        <th
                          key={header.id}
                          className="p-2 text-left font-semibold border-b-2 border-slate-300 whitespace-nowrap"
                          style={{ minWidth: header.column.columnDef.size }}
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
                  {table.getRowModel().rows.map(row => (
                    <tr
                      key={row.id}
                      className="border-b hover:bg-slate-50"
                    >
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} className="p-2">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Keyboard Shortcuts Help */}
            <div className="mt-4 p-3 bg-blue-50 rounded-lg text-xs text-blue-900">
              <strong>⌨️ Keyboard Shortcuts:</strong>
              <span className="ml-2">Tab = Next cell</span>
              <span className="ml-2">•</span>
              <span className="ml-2">Enter = Next row</span>
              <span className="ml-2">•</span>
              <span className="ml-2">Esc = Cancel edit</span>
            </div>

            {/* Totals Summary */}
            <div className="mt-6 p-4 bg-slate-50 rounded-lg">
              <h3 className="font-semibold mb-3">Estimation Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Woodwork Value</p>
                  <p className="font-bold text-lg">
                    {formatCurrency(calculateTotals().woodwork_value)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Woodwork Value</p>
                  <p className="font-bold text-lg">
                    {formatCurrency(calculateTotals().misc_external_value)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Misc Internal Value</p>
                  <p className="font-bold text-lg">
                    {formatCurrency(calculateTotals().misc_internal_value)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Shopping Service Value</p>
                  <p className="font-bold text-lg">
                    {formatCurrency(calculateTotals().shopping_service_value)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Final Value</p>
                  <p className="font-bold text-xl text-green-700">
                    {formatCurrency(calculateTotals().final_value)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ESTIMATION_STATUS).map(([key, value]) => (
                        <SelectItem key={key} value={value}>
                          {value
                            .replace(/\b\w/g, c => c.toUpperCase())}  {/* capitalize words */}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Default GST (%)</Label>

                  <Input
                    readOnly
                    disabled
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="Fetching GST% from Business Model..."
                    value={bizModel.gst_percentage || 0}
                  />


                  <span className='text-xs text-gray-500'>From the Business Model Configuration. Standard GST% added to all items.</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Remarks</Label>
                <Textarea
                  placeholder="Add any notes about this estimation..."
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Link href={`/projects/${projectId}`}>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={saving} className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Estimation'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Overpayment Warning Modal */}
      <Dialog open={showOverpaymentModal} onOpenChange={setShowOverpaymentModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-red-100 p-3 rounded-full">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <DialogTitle className="text-xl text-red-900">
                ⚠️ Overpayment Detected
              </DialogTitle>
            </div>
            <DialogDescription className="text-base">
              This estimation revision will create an overpayment situation
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 py-4">
            {overpaymentData && (
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-700 font-medium mb-1">Total Collected (Approved)</p>
                    <p className="text-2xl font-bold text-red-900">
                      ₹{overpaymentData.total_collected?.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-700 font-medium mb-1">New Estimation Total</p>
                    <p className="text-2xl font-bold text-blue-900">
                      ₹{overpaymentData.new_estimation_total?.toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>

                <div className="bg-red-100 border-2 border-red-300 rounded-lg p-4">
                  <p className="text-sm font-semibold text-red-900 mb-1">Overpayment Amount:</p>
                  <p className="text-3xl font-bold text-red-600">
                    ₹{overpaymentData.overpayment_amount?.toLocaleString('en-IN')}
                  </p>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="font-semibold text-amber-900 mb-2">⚠️ What happens if you proceed:</p>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-amber-900 ml-2">
                    <li>A new estimation version (v{overpaymentData.next_version}) will be created</li>
                    {/* <li>Status will be set to <strong>Pending Admin Approval</strong></li>
                      <li>Admin must review and approve the overpayment</li> */}
                    <li>This project will be flagged in management dashboard under <strong>OverPayment Alerts</strong></li>
                    <li>System will create a credit reversal entry in payments</li>
                    <li>Finance team will upload credit note document</li>
                    <li>Ledger will reflect the adjustment</li>
                  </ol>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="font-semibold text-blue-900 mb-2">💡 Alternative Options:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-blue-900 ml-2">
                    <li>Cancel and revise the estimation amounts</li>
                    <li>Coordinate with Finance team before proceeding</li>
                    <li>You can cancel this version later before admin approval</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowOverpaymentModal(false);
                setOverpaymentData(null);
                setPendingSubmitData(null);
                setSaving(false);
              }}
            >
              Cancel - Don't Save
            </Button>
            <Button
              type="button"
              className="bg-red-600 hover:bg-red-700"
              onClick={async () => {
                setShowOverpaymentModal(false);
                setSaving(true);
                await saveEstimation(pendingSubmitData);
              }}
            >
              Proceed with Overpayment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}