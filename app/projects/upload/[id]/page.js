"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useCSVReader } from 'react-papaparse';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Upload, Download, CheckCircle2, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';


export default function UploadEstimationPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id;
  const { CSVReader } = useCSVReader();

  const [project, setProject] = useState(null);
  const [baseRates, setBaseRates] = useState(null);
  const [csvFile, setCsvFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [validationResults, setValidationResults] = useState({ valid: [], warnings: [], errors: [] });
  const [isValidating, setIsValidating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchProjectData();
      fetchBaseRates();
    }
  }, [status, projectId]);

  const fetchProjectData = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/route.js`);
      if (res.ok) {
        const data = await res.json();
        setProject(data.project);
      }
    } catch (error) {
      console.error('Error fetching project:', error);
      toast.error('Failed to load project details');
    }
  };

  const fetchBaseRates = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/base-rates/active`);
      if (res.ok) {
        const data = await res.json();
        setBaseRates(data.activeRate);
      }
    } catch (error) {
      console.error('Error fetching base rates:', error);
    }
  };

  const handleCSVUpload = (results, file) => {
    setCsvFile(file);
    setIsValidating(true);
    
    // Parse CSV data
    const rows = results.data.slice(1); // Skip header row
    const headers = results.data[0];
    
    const parsedRows = rows.map((row, index) => {
      const rowData = {};
      headers.forEach((header, i) => {
        rowData[header.toLowerCase().trim()] = row[i];
      });
      return { rowNumber: index + 2, data: rowData }; // +2 because row 1 is header
    });

    setParsedData(parsedRows);
    
    // Validate data
    validateCSVData(parsedRows, headers);
    setIsValidating(false);
  };

  const validateCSVData = (rows, headers) => {
    const valid = [];
    const warnings = [];
    const errors = [];

    // Required columns
    const requiredColumns = ['category', 'room_name', 'item_name', 'quantity', 'unit', 'unit_price'];
    const missingColumns = requiredColumns.filter(col => 
      !headers.some(h => h.toLowerCase().trim() === col)
    );

    if (missingColumns.length > 0) {
      errors.push({
        row: 0,
        field: 'headers',
        message: `Missing required columns: ${missingColumns.join(', ')}`
      });
      setValidationResults({ valid, warnings, errors });
      return;
    }

    // Get valid categories from base rates
    const validCategories = baseRates?.category_rates?.categories?.map(c => c.id.toLowerCase()) || [];

    // Validate each row
    rows.forEach(row => {
      const rowErrors = [];
      const rowWarnings = [];
      const { rowNumber, data } = row;

      // Validate category
      if (!data.category || data.category.trim() === '') {
        rowErrors.push({ row: rowNumber, field: 'category', message: 'Category is required' });
      } else if (!validCategories.includes(data.category.toLowerCase().trim())) {
        rowErrors.push({ 
          row: rowNumber, 
          field: 'category', 
          message: `Invalid category "${data.category}". Valid categories: ${validCategories.join(', ')}` 
        });
      }

      // Validate room_name
      if (!data.room_name || data.room_name.trim() === '') {
        rowErrors.push({ row: rowNumber, field: 'room_name', message: 'Room name is required' });
      }

      // Validate item_name
      if (!data.item_name || data.item_name.trim() === '') {
        rowErrors.push({ row: rowNumber, field: 'item_name', message: 'Item name is required' });
      }

      // Validate quantity
      const quantity = parseFloat(data.quantity);
      if (isNaN(quantity) || quantity <= 0) {
        rowErrors.push({ row: rowNumber, field: 'quantity', message: 'Quantity must be > 0' });
      }

      // Validate unit
      const validUnits = ['sqft', 'no', 'lumpsum'];
      if (!data.unit || !validUnits.includes(data.unit.toLowerCase().trim())) {
        rowErrors.push({ 
          row: rowNumber, 
          field: 'unit', 
          message: `Unit must be one of: ${validUnits.join(', ')}` 
        });
      }

      // Validate unit_price
      const unitPrice = parseFloat(data.unit_price);
      if (isNaN(unitPrice) || unitPrice < 0) {
        rowErrors.push({ row: rowNumber, field: 'unit_price', message: 'Unit Price must be >= 0' });
      }

      // Check width/height for sqft
      if (data.unit?.toLowerCase().trim() === 'sqft') {
        if (!data.width || !data.height) {
          rowWarnings.push({ 
            row: rowNumber, 
            field: 'width/height', 
            message: 'Width and height recommended for sqft unit' 
          });
        }
      }

      // Validate discount percentages
      if (data.item_discount_percentage) {
        const discount = parseFloat(data.item_discount_percentage);
        const category = baseRates?.category_rates?.categories?.find(
          c => c.id.toLowerCase() === data.category.toLowerCase().trim()
        );
        const maxDiscount = category?.max_item_discount_percentage || 0;
        
        if (discount > maxDiscount) {
          rowErrors.push({ 
            row: rowNumber, 
            field: 'item_discount_percentage', 
            message: `Exceeds max ${maxDiscount}% for ${category?.category_name}` 
          });
        }
      }

      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
      } else if (rowWarnings.length > 0) {
        warnings.push(...rowWarnings);
        valid.push(row);
      } else {
        valid.push(row);
      }
    });

    setValidationResults({ valid, warnings, errors });
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/estimations/template`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `estimation_template_project_${projectId}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        toast.success('Template downloaded');
      } else {
        toast.error('Failed to download template');
      }
    } catch (error) {
      console.error('Error downloading template:', error);
      toast.error('Error downloading template');
    }
  };

  const handleConfirmUpload = async () => {
    if (validationResults.errors.length > 0) {
      toast.error('Please fix all errors before uploading');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', csvFile);

      const res = await fetch(`/api/projects/${projectId}/upload`, {
        method: 'POST',
        body: formData
      });

      const result = await res.json();

      if (result.success) {
        toast.success(`Version ${result.version} created successfully with ${result.items_count} items!`);
        router.push(`/projects/${projectId}`);
      } else {
        toast.error(result.error || 'Upload failed');
        if (result.errors) {
          setValidationResults(prev => ({ ...prev, errors: result.errors }));
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload CSV');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleReset = () => {
    setCsvFile(null);
    setParsedData([]);
    setValidationResults({ valid: [], warnings: [], errors: [] });
  };

  if (status === 'loading') {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  const canConfirm = parsedData.length > 0 && validationResults.errors.length === 0 && !isUploading;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/projects/${projectId}`}>
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Project
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Upload Estimation CSV</h1>
              <p className="text-muted-foreground">{project?.name || 'Project'}</p>
            </div>
          </div>
        </div>
        <Toaster richColors position="top-right" />

        {/* Upload Section */}
        {!csvFile && (
          <Card>
            <CardHeader>
              <CardTitle>Step 1: Download Template (Optional)</CardTitle>
              <CardDescription>Download a pre-formatted CSV template with correct columns</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={handleDownloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Download CSV Template
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Step 2: Upload Your CSV</CardTitle>
            <CardDescription>
              Upload a CSV file with estimation items. Required columns: category, room_name, item_name, quantity, unit, unit_price
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!csvFile ? (
              <CSVReader
                onUploadAccepted={handleCSVUpload}
                config={{ header: false }}
              >
                {({ getRootProps, acceptedFile, getRemoveFileProps }) => (
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-12 text-center hover:border-blue-500 transition-colors cursor-pointer">
                    <div {...getRootProps()} className="space-y-4">
                      <Upload className="h-12 w-12 mx-auto text-slate-400" />
                      <div>
                        <p className="text-lg font-medium">Drop CSV file here or click to browse</p>
                        <p className="text-sm text-muted-foreground mt-2">Supports .csv files only (max 10MB)</p>
                      </div>
                    </div>
                  </div>
                )}
              </CSVReader>
            ) : (
              <div className="space-y-4">
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>File Uploaded</AlertTitle>
                  <AlertDescription>
                    {csvFile.name} ({(csvFile.size / 1024).toFixed(2)} KB) - {parsedData.length} rows
                  </AlertDescription>
                </Alert>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleReset}>
                    Reset
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Validation Results */}
        {parsedData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Validation Results</CardTitle>
              <CardDescription>Review validation status before confirming upload</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {validationResults.valid.length} Valid
                </Badge>
                {validationResults.warnings.length > 0 && (
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {validationResults.warnings.length} Warnings
                  </Badge>
                )}
                {validationResults.errors.length > 0 && (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    {validationResults.errors.length} Errors
                  </Badge>
                )}
              </div>

              {/* Errors */}
              {validationResults.errors.length > 0 && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Errors Found (Must Fix)</AlertTitle>
                  <AlertDescription>
                    <div className="mt-2 space-y-1 text-sm max-h-40 overflow-y-auto">
                      {validationResults.errors.slice(0, 10).map((err, idx) => (
                        <div key={idx}>
                          Row {err.row}, {err.field}: {err.message}
                        </div>
                      ))}
                      {validationResults.errors.length > 10 && (
                        <div className="font-semibold">...and {validationResults.errors.length - 10} more errors</div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Warnings */}
              {validationResults.warnings.length > 0 && validationResults.errors.length === 0 && (
                <Alert className="border-yellow-300 bg-yellow-50">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertTitle className="text-yellow-800">Warnings (Can Proceed)</AlertTitle>
                  <AlertDescription className="text-yellow-700">
                    <div className="mt-2 space-y-1 text-sm max-h-40 overflow-y-auto">
                      {validationResults.warnings.slice(0, 10).map((warn, idx) => (
                        <div key={idx}>
                          Row {warn.row}, {warn.field}: {warn.message}
                        </div>
                      ))}
                      {validationResults.warnings.length > 10 && (
                        <div className="font-semibold">...and {validationResults.warnings.length - 10} more warnings</div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Preview Table */}
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-96">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Row</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Category</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Room</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Item</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Unit</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Qty</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Unit Price</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {parsedData.slice(0, 20).map((row, idx) => {
                        const hasError = validationResults.errors.some(e => e.row === row.rowNumber);
                        const hasWarning = validationResults.warnings.some(w => w.row === row.rowNumber);
                        const statusIcon = hasError ? (
                          <XCircle className="h-4 w-4 text-red-600" />
                        ) : hasWarning ? (
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        );

                        return (
                          <tr key={idx} className={hasError ? 'bg-red-50' : hasWarning ? 'bg-yellow-50' : ''}>
                            <td className="px-4 py-3 whitespace-nowrap">{row.rowNumber}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{statusIcon}</td>
                            <td className="px-4 py-3">{row.data.category}</td>
                            <td className="px-4 py-3">{row.data.room_name}</td>
                            <td className="px-4 py-3">{row.data.item_name}</td>
                            <td className="px-4 py-3">{row.data.unit}</td>
                            <td className="px-4 py-3">{row.data.quantity}</td>
                            <td className="px-4 py-3">{row.data.unit_price}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {parsedData.length > 20 && (
                    <div className="p-4 text-center text-sm text-muted-foreground bg-slate-50">
                      Showing first 20 of {parsedData.length} rows
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        {parsedData.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {canConfirm 
                      ? 'Ready to upload. This will create a new estimation version.' 
                      : 'Fix errors before proceeding'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => router.push(`/projects/${projectId}`)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleConfirmUpload} 
                    disabled={!canConfirm}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Confirm Upload
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
