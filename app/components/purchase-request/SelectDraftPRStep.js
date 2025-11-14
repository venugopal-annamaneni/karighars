"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";


export default function SelectDraftPRStep({
  draftPRs,
  value,
  onChange,
  notes,
  setNotes,
  deliveryDate,
  setDeliveryDate,
  showDetails = false,
}) {
  return (
    <div className="space-y-4">

      <RadioGroup value={value} onValueChange={onChange}>
        {/* Existing Draft PRs */}
        {draftPRs.length > 0 && (
          <div className="space-y-2">
            {draftPRs.map((pr) => (
              <div
                key={pr.id}
                className="flex items-center space-x-2 p-3 border rounded-lg"
              >
                <RadioGroupItem value={pr.id.toString()} id={`pr-${pr.id}`} />

                <Label
                  htmlFor={`pr-${pr.id}`}
                  className="cursor-pointer flex-1"
                >
                  <div>
                    <p className="font-medium">{pr.pr_number}</p>
                    <p className="text-sm text-muted-foreground">
                      Draft, {pr.items_count} items
                    </p>
                  </div>
                </Label>
              </div>
            ))}
          </div>
        )}

        {/* New PR Option */}
        <div className="flex items-center space-x-2 p-3 border rounded-lg mt-2">
          <RadioGroupItem value="new" id="pr-new" />
          <Label htmlFor="pr-new" className="cursor-pointer">
            <p className="font-medium">Create New Draft PR</p>
          </Label>
        </div>
      </RadioGroup>

      {/* If "Create New" → Show Notes + Delivery Date */}
      {showDetails && value === "new" && (
        <div className="space-y-4 pt-4 border-t">
          {setDeliveryDate && (
            <div>
              <Label>Expected Delivery Date</Label>
              <Input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />
            </div>
          )}

          {setNotes && (
            <div>
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
