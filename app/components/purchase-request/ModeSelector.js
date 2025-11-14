"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, Layers, ShoppingCart } from "lucide-react";

export default function ModeSelector({ projectId, onSelect }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href={`/projects/${projectId}/purchase-requests`}>
          <Button variant="ghost" size="sm" className="gap-2 mb-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Purchase Requests
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Create Purchase Request</h1>
        <p className="text-muted-foreground">Choose how you want to fulfill items</p>
      </div>

      {/* Options */}
      <div className="grid md:grid-cols-3 gap-6 max-w-6xl">
        
        {/* Full Unit */}
        <Card
          className="cursor-pointer hover:border-primary transition-all"
          onClick={() => onSelect("full_unit")}
        >
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <CardTitle>Full Unit Fulfillment</CardTitle>
                <CardDescription className="mt-2">
                  Order the exact estimated items from one vendor
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>✓ Same vendor for entire unit</li>
              <li>✓ Simple & fast</li>
              <li>✓ Great for bulk ordering</li>
              <li>✓ Most common (95% of PRs)</li>
            </ul>
          </CardContent>
        </Card>

        {/* Component */}
        <Card
          className="cursor-pointer hover:border-primary transition-all"
          onClick={() => onSelect("component")}
        >
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-orange-100">
                <Layers className="h-6 w-6 text-orange-600" />
              </div>
              <div className="flex-1">
                <CardTitle>Component-wise Breakdown</CardTitle>
                <CardDescription className="mt-2">
                  Break an item into multiple material components
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>✓ Different vendor per component</li>
              <li>✓ Percentage-based breakdown</li>
              <li>✓ Ideal for plywood / laminate / hardware splits</li>
            </ul>
          </CardContent>
        </Card>

        {/* Direct Purchase */}
        <Card
          className="cursor-pointer hover:border-primary transition-all"
          onClick={() => onSelect("direct")}
        >
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <ShoppingCart className="h-6 w-6 text-green-600" />
              </div>
              <div className="flex-1">
                <CardTitle>Direct Purchase</CardTitle>
                <CardDescription className="mt-2">
                  Ad-hoc items not listed in estimation
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>✓ Not linked to estimation</li>
              <li>✓ Emergency purchases</li>
              <li>✓ Custom materials or tools</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
