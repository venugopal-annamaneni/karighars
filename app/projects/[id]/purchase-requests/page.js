'use client';

import { useParams } from 'next/navigation';

export default function PurchaseRequestsPage() {
  const params = useParams();
  const projectId = params.id;

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-2xl mx-auto text-center">
        <h1 className="text-3xl font-bold mb-4">Purchase Requests</h1>
        <p className="text-muted-foreground mb-8">
          Purchase Request feature is being rebuilt.
        </p>
        <div className="bg-card border border-border rounded-lg p-8">
          <p className="text-sm text-muted-foreground">
            Project ID: {projectId}
          </p>
          <p className="mt-4 text-sm">
            This page will contain the new Purchase Request interface.
          </p>
        </div>
      </div>
    </div>
  );
}
