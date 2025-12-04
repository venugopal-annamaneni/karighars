'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Download, Upload, FileSpreadsheet, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import Papa from 'papaparse';

const CSV_HEADERS = [
  'PR Item Stable ID',
  'Estimation Item ID (Stable)',
  'Category',
  'Room',
  'Item Name',
  'Unit',
  'Width',
  'Height',
  'Qty',
  'Est. Price',
  'purchase_request_item_name',
  'category_pr',
  'room_name_pr',
  'is_direct_purchase',
  'unit_pr',
  'width_pr',
  'height_pr',
  'quantity_pr',
  'unit_price',
  'subtotal',
  'gst_percentage',
  'gst_amount',
  'amount_before_gst',
  'item_total',
  'status',
  'lifecycle_status',
  'notes',
  'linked_qty',
  'unit_purchase_request_item_weightage'
];

export default function PurchaseRequestUploadPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id;

  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [parsedData, setParsedData] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [estimationItems, setEstimationItems] = useState([]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (projectId) {
      loadReferenceData();
    }
  }, [projectId]);

  const loadReferenceData = async () => {
    try {
      // Load vendors and estimation items for validation
      const [vendorsRes, prDataRes] = await Promise.all([
        fetch('/api/vendors'),
        fetch(`/api/projects/${projectId}/purchase-requests/manage-purchase`)
      ]);

      if (vendorsRes.ok) {
        const vendorsData = await vendorsRes.json();
        setVendors(vendorsData.vendors || []);
      }

      if (prDataRes.ok) {
        const prData = await prDataRes.json();
        setEstimationItems(prData.estimation_items || []);
      }
    } catch (error) {
      console.error('Error loading reference data:', error);
    }
  };

  const handleDownloadTemplate = () => {
    const exampleRows = [
      [
        '', // PR Item Stable ID - empty for new
        'est-uuid-example',
        'Woodwork',
        'Living Room',
        'TV Unit',
        'sqft',
        '8',
        '5',
        '40',
        '15000',
        'TV Unit Fabrication',
        'Woodwork',
        'Living Room',
        'false',
        'sqft',
        '8',
        '5',
        '40',
        '12000',
        '480000',
        '18',
        '86400',
        '480000',
        '566400',
        'draft',
        'pending',
        '',
        '40',
        '1.0'
      ],
      [
        '', // Empty for new component
        'est-uuid-example-2',
        'Woodwork',
        'Bedroom',
        'Wardrobe',
        'sqft',
        '10',
        '8',
        '80',
        '50000',
        'Plywood Sheets',
        'Woodwork',
        'Bedroom',
        'false',
        'sheet',
        '',
        '',
        '50',
        '100',
        '5000',
        '18',
        '900',
        '5000',
        '5900',
        'draft',
        'pending',
        '',
        '50',
        '0.5'
      ],
      [
        '', // Empty for new component
        'est-uuid-example-2',
        'Woodwork',
        'Bedroom',
        'Wardrobe',
        'sqft',
        '10',
        '8',
        '80',
        '50000',
        'MDF Sheets',
        'Woodwork',
        'Bedroom',
        'false',
        'sheet',
        '',
        '',
        '30',
        '150',
        '4500',
        '18',
        '810',
        '4500',
        '5310',
        'draft',
        'pending',
        '',
        '30',
        '0.5'
      ],
      [
        '', // Empty for direct purchase
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'Extra Hinges',
        'Hardware',
        'Storage',
        'true',
        'pcs',
        '',
        '',
        '20',
        '50',
        '1000',
        '18',
        '180',
        '1000',
        '1180',
        'draft',
        'pending',
        'Emergency purchase',
        '',
        ''
      ]
    ];

    const csv = Papa.unparse({
      fields: CSV_HEADERS,
      data: exampleRows
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pr_upload_template_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Template downloaded');
  };

  const handleDownloadCurrentData = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/purchase-requests/manage-purchase`);
      if (!res.ok) {
        toast.error('Failed to load current data');
        return;
      }

      const data = await res.json();
      const rows = [];

      // Full items
      data.estimation_items.forEach(item => {
        if (item.fulfillmentMode === 'full' && item.prItems?.[0]) {
          const prItem = item.prItems[0];
          rows.push([
            prItem.stable_item_id || '',
            item.stable_estimation_item_id,
            item.category,
            item.room_name,
            item.item_name,
            item.unit,
            item.width || '',
            item.height || '',
            item.quantity,
            item.estimation_item_total,
            prItem.purchase_request_item_name || prItem.component_name,
            prItem.category || item.category,
            prItem.room_name || item.room_name,
            'false',
            prItem.unit,
            prItem.width || '',
            prItem.height || '',
            prItem.quantity,
            prItem.unit_price,
            prItem.subtotal,
            prItem.gst_percentage,
            prItem.gst_amount,
            prItem.amount_before_gst || prItem.subtotal,
            prItem.item_total,
            prItem.status || 'draft',
            prItem.lifecycle_status || 'pending',
            prItem.notes || '',
            prItem.quantity,
            prItem.weightage || 1.0
          ]);
        }

        // Component items
        if (item.fulfillmentMode === 'component' && item.prItems) {
          item.prItems.forEach(prItem => {
            rows.push([
              prItem.stable_item_id || '',
              item.stable_estimation_item_id,
              item.category,
              item.room_name,
              item.item_name,
              item.unit,
              item.width || '',
              item.height || '',
              item.quantity,
              item.estimation_item_total,
              prItem.component_name || prItem.purchase_request_item_name,
              prItem.category || item.category,
              prItem.room_name || item.room_name,
              'false',
              prItem.unit,
              prItem.width || '',
              prItem.height || '',
              prItem.quantity,
              prItem.unit_price,
              prItem.subtotal,
              prItem.gst_percentage,
              prItem.gst_amount,
              prItem.amount_before_gst || prItem.subtotal,
              prItem.item_total,
              prItem.status || 'draft',
              prItem.lifecycle_status || 'pending',
              prItem.notes || '',
              prItem.quantity,
              prItem.weightage
            ]);
          });
        }
      });

      // Direct purchases
      data.additional_purchases.forEach(item => {
        rows.push([
          item.stable_item_id || '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          item.name,
          item.category || '',
          item.room_name || '',
          'true',
          item.unit,
          item.width || '',
          item.height || '',
          item.quantity,
          item.unit_price,
          item.subtotal,
          item.gst_percentage,
          item.gst_amount,
          item.amount_before_gst || item.subtotal,
          item.item_total,
          item.status || 'draft',
          item.lifecycle_status || 'pending',
          item.notes || '',
          '',
          ''
        ]);
      });

      const csv = Papa.unparse({
        fields: CSV_HEADERS,
        data: rows
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `pr_items_${projectId}_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Current data downloaded');
    } catch (error) {
      console.error('Error downloading current data:', error);
      toast.error('Error downloading data');
    }
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        toast.error('Please select a CSV file');
        return;
      }
      setFile(selectedFile);
      setParsedData(null);
      setValidationErrors([]);
      setShowPreview(false);
    }
  };

  const parseCSV = (file) => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data;
          
          const grouped = {
            fullItems: [],
            componentGroups: {},
            directPurchases: []
          };
          
          rows.forEach((row, index) => {
            const estId = row['Estimation Item ID (Stable)']?.trim();
            const weightage = parseFloat(row['unit_purchase_request_item_weightage'] || 1.0);
            const isDirect = row['is_direct_purchase']?.toLowerCase() === 'true';
            
            const prItemData = {
              rowIndex: index + 2,
              stable_item_id: row['PR Item Stable ID']?.trim() || null,
              purchase_request_item_name: row['purchase_request_item_name']?.trim(),
              category: row['category_pr']?.trim(),
              room_name: row['room_name_pr']?.trim(),
              unit: row['unit_pr']?.trim(),
              width: parseFloat(row['width_pr']) || null,
              height: parseFloat(row['height_pr']) || null,
              quantity: parseFloat(row['quantity_pr']) || 0,
              unit_price: parseFloat(row['unit_price']) || 0,
              gst_percentage: parseFloat(row['gst_percentage']) || 18,
              linked_qty: parseFloat(row['linked_qty']) || 0,
              weightage: weightage,
              notes: row['notes']?.trim() || null
            };
            
            if (isDirect) {
              grouped.directPurchases.push(prItemData);
            } else if (weightage === 1.0) {
              grouped.fullItems.push({
                ...prItemData,
                stable_estimation_item_id: estId,
                item_name: row['Item Name']?.trim(),
                category_est: row['Category']?.trim(),
                room_name_est: row['Room']?.trim(),
                unit_est: row['Unit']?.trim(),
                width_est: parseFloat(row['Width']) || null,
                height_est: parseFloat(row['Height']) || null,
                quantity_est: parseFloat(row['Qty']) || 0,
                estimation_item_total: parseFloat(row['Est. Price']) || 0
              });
            } else {
              if (!grouped.componentGroups[estId]) {
                grouped.componentGroups[estId] = {
                  estimationData: {
                    stable_estimation_item_id: estId,
                    item_name: row['Item Name']?.trim(),
                    category: row['Category']?.trim(),
                    room_name: row['Room']?.trim(),
                    unit: row['Unit']?.trim(),
                    width: parseFloat(row['Width']) || null,
                    height: parseFloat(row['Height']) || null,
                    quantity: parseFloat(row['Qty']) || 0,
                    estimation_item_total: parseFloat(row['Est. Price']) || 0
                  },
                  components: []
                };
              }
              grouped.componentGroups[estId].components.push(prItemData);
            }
          });
          
          resolve(grouped);
        },
        error: (error) => reject(error)
      });
    });
  };

  const validateParsedData = (grouped) => {
    const errors = [];
    
    // Validate full items
    grouped.fullItems.forEach(item => {
      if (!item.stable_estimation_item_id) {
        errors.push(`Row ${item.rowIndex}: Missing Estimation Item ID for full item`);
      }
      if (!item.purchase_request_item_name) {
        errors.push(`Row ${item.rowIndex}: Missing PR item name`);
      }
      if (item.quantity <= 0) {
        errors.push(`Row ${item.rowIndex}: Quantity must be greater than 0`);
      }
      if (item.unit_price < 0) {
        errors.push(`Row ${item.rowIndex}: Unit price cannot be negative`);
      }
    });
    
    // Validate component groups
    Object.entries(grouped.componentGroups).forEach(([estId, group]) => {
      if (!estId) {
        errors.push(`Component group missing Estimation Item ID`);
        return;
      }
      
      const totalWeightage = group.components.reduce((sum, c) => sum + c.weightage, 0);
      if (Math.abs(totalWeightage - 1.0) > 0.001) {
        const rowNumbers = group.components.map(c => c.rowIndex).join(', ');
        errors.push(
          `Rows ${rowNumbers}: Component weightage must sum to 100% (currently ${(totalWeightage * 100).toFixed(1)}%)`
        );
      }
      
      group.components.forEach(comp => {
        if (!comp.purchase_request_item_name) {
          errors.push(`Row ${comp.rowIndex}: Missing component name`);
        }
        if (comp.quantity <= 0) {
          errors.push(`Row ${comp.rowIndex}: Component quantity must be greater than 0`);
        }
        if (comp.unit_price < 0) {
          errors.push(`Row ${comp.rowIndex}: Component unit price cannot be negative`);
        }
        if (comp.weightage <= 0 || comp.weightage > 1) {
          errors.push(`Row ${comp.rowIndex}: Weightage must be between 0 and 1`);
        }
      });
    });
    
    // Validate direct purchases
    grouped.directPurchases.forEach(item => {
      if (!item.purchase_request_item_name) {
        errors.push(`Row ${item.rowIndex}: Missing item name for direct purchase`);
      }
      if (item.quantity <= 0) {
        errors.push(`Row ${item.rowIndex}: Quantity must be greater than 0`);
      }
      if (item.unit_price < 0) {
        errors.push(`Row ${item.rowIndex}: Unit price cannot be negative`);
      }
    });
    
    return errors;
  };

  const handleValidate = async () => {
    if (!file) {
      toast.error('Please select a file first');
      return;
    }

    try {
      setValidating(true);
      setValidationErrors([]);
      
      const grouped = await parseCSV(file);
      const errors = validateParsedData(grouped);
      
      if (errors.length > 0) {
        setValidationErrors(errors);
        setShowPreview(false);
        toast.error(`Found ${errors.length} validation error(s)`);
      } else {
        setParsedData(grouped);
        setShowPreview(true);
        toast.success('Validation successful! Review preview and upload.');
      }
    } catch (error) {
      console.error('Parse error:', error);
      toast.error('Error parsing CSV file');
    } finally {
      setValidating(false);
    }
  };

  const handleUpload = async () => {
    if (!parsedData) return;

    try {
      setUploading(true);

      // Transform to API format
      const payload = {
        estimation_id: null, // Will be set by backend based on project
        items: [],
        additional_purchases: []
      };

      // Add full items
      parsedData.fullItems.forEach(item => {
        payload.items.push({
          stable_item_id: item.stable_item_id || undefined,
          stable_estimation_item_id: item.stable_estimation_item_id,
          item_name: item.item_name,
          category: item.category_est,
          room_name: item.room_name_est,
          unit: item.unit,
          width: item.width,
          height: item.height,
          quantity: item.quantity,
          fulfillmentMode: 'full',
          vendor_id: null, // Backend will need to handle vendor lookup
          unit_price: item.unit_price,
          gst_percentage: item.gst_percentage
        });
      });

      // Add component groups
      Object.entries(parsedData.componentGroups).forEach(([estId, group]) => {
        payload.items.push({
          stable_estimation_item_id: estId,
          item_name: group.estimationData.item_name,
          category: group.estimationData.category,
          room_name: group.estimationData.room_name,
          unit: group.estimationData.unit,
          width: group.estimationData.width,
          height: group.estimationData.height,
          quantity: group.estimationData.quantity,
          fulfillmentMode: 'component',
          components: group.components.map(comp => ({
            stable_item_id: comp.stable_item_id || undefined,
            name: comp.purchase_request_item_name,
            unit: comp.unit,
            width: comp.width,
            height: comp.height,
            quantity: comp.quantity,
            weightage: comp.weightage,
            vendor_id: null,
            unit_price: comp.unit_price,
            gst_percentage: comp.gst_percentage
          }))
        });
      });

      // Add direct purchases
      parsedData.directPurchases.forEach(item => {
        payload.additional_purchases.push({
          stable_item_id: item.stable_item_id || undefined,
          name: item.purchase_request_item_name,
          unit: item.unit,
          width: item.width,
          height: item.height,
          quantity: item.quantity,
          vendor_id: null,
          unit_price: item.unit_price,
          gst_percentage: item.gst_percentage
        });
      });

      const res = await fetch(`/api/projects/${projectId}/purchase-requests/manage-purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await res.json();

      if (!res.ok) {
        if (result.details && Array.isArray(result.details)) {
          result.details.forEach(detail => {
            toast.error(detail, { duration: 6000 });
          });
        } else {
          toast.error(result.error || 'Failed to upload');
        }
        return;
      }

      toast.success(result.message || 'Upload successful!');
      router.push(`/projects/${projectId}/purchase-requests`);
      
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Error uploading data');
    } finally {
      setUploading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Purchase Request Items</CardTitle>
          <CardDescription>
            Upload CSV file to create or update purchase requests in bulk. All existing draft PRs will be replaced.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Download Options */}
      <Card>
        <CardHeader>
          <CardTitle>Step 1: Download Template or Current Data</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Button onClick={handleDownloadTemplate} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Download Blank Template
          </Button>
          <Button onClick={handleDownloadCurrentData} variant="outline" className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Download Current Data
          </Button>
        </CardContent>
      </Card>

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle>Step 2: Upload CSV File</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="max-w-md"
          />
          {file && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4" />
              <span>{file.name} ({(file.size / 1024).toFixed(2)} KB)</span>
            </div>
          )}
          <Button
            onClick={handleValidate}
            disabled={!file || validating}
            className="gap-2"
          >
            {validating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Validating...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Validate & Preview
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Validation Errors ({validationErrors.length})</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside mt-2 space-y-1">
              {validationErrors.slice(0, 10).map((error, idx) => (
                <li key={idx} className="text-sm">{error}</li>
              ))}
              {validationErrors.length > 10 && (
                <li className="text-sm font-semibold">
                  ... and {validationErrors.length - 10} more errors
                </li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Preview */}
      {showPreview && parsedData && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Preview & Confirm</CardTitle>
            <CardDescription>
              Review the parsed data before uploading
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Badge variant="outline">
                {parsedData.fullItems.length} Full Items
              </Badge>
              <Badge variant="outline">
                {Object.keys(parsedData.componentGroups).length} Component Groups
              </Badge>
              <Badge variant="outline">
                {parsedData.directPurchases.length} Direct Purchases
              </Badge>
            </div>

            <div className="border rounded-lg p-4 bg-muted/30">
              <h4 className="font-semibold mb-2">Summary:</h4>
              <ul className="space-y-1 text-sm">
                <li>• Total items to process: {
                  parsedData.fullItems.length + 
                  Object.keys(parsedData.componentGroups).length + 
                  parsedData.directPurchases.length
                }</li>
                <li>• This will replace all existing draft PRs</li>
                <li>• Old data will be moved to history tables</li>
              </ul>
            </div>

            <Button
              onClick={handleUpload}
              disabled={uploading}
              className="gap-2"
              size="lg"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Confirm & Upload
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
