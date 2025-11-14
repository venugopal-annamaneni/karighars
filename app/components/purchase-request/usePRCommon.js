"use client";

import { set } from "date-fns";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export function usePRCommon(projectId) {
  const [loading, setLoading] = useState(true);

  const [vendors, setVendors] = useState([]);
  const [draftPRs, setDraftPRs] = useState([]);

  const [groupedItems, setGroupedItems] = useState({});
  const [allItems, setAllItems] = useState([]);
  const [estimationId, setEstimationId] = useState(null);
  const [baseRates, setBaseRates] = useState(null);

  // -------------------------------
  // Fetch Vendors
  // -------------------------------
  const fetchVendors = async () => {
    try {
      const res = await fetch(`/api/vendors`);
      if (!res.ok) throw new Error("Failed to fetch vendors");
      const data = await res.json();
      setVendors(data.vendors || []);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load vendors");
    }
  };

  const fetchBaseRates = async () => {
    try {
      const baseRateRes = await fetch(`/api/projects/${projectId}/base-rates/active`);
      if (!baseRateRes.ok) {
        throw new Error('Failed to fetch active base rates');
      }
      const baseRateData = await baseRateRes.json();
      setBaseRates(baseRateData.activeRate);
    } catch (error) {
      console.error('Error fetching base rates:', error);
    }
  };


  // -------------------------------
  // Fetch Estimation Items (available for PR)
  // -------------------------------
  const fetchAvailableItems = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/projects/${projectId}/purchase-requests/available-items`
      );

      if (!res.ok) throw new Error("Failed to fetch items");

      const data = await res.json();
      setGroupedItems(data.grouped_by_category || {});
      setAllItems(data.items || []);
      setEstimationId(data.estimation_id || null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load estimation items");
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------
  // Fetch Draft PRs for a Vendor
  // -------------------------------
  const fetchDraftPRs = async (vendorId) => {
    if (!vendorId) return;

    try {
      const res = await fetch(
        `/api/projects/${projectId}/purchase-requests?status=draft&vendor_id=${vendorId}`
      );
      if (!res.ok) throw new Error("Failed to fetch draft PRs");

      const data = await res.json();
      setDraftPRs(data.purchase_requests || []);
      return data.purchase_requests || [];
    } catch (err) {
      console.error(err);
      toast.error("Failed to load draft PRs");
    }
  };

  // -------------------------------
  // Initial Load
  // -------------------------------
  useEffect(() => {
    if (!projectId) return;
    fetchVendors();
    fetchAvailableItems();
    fetchBaseRates();
  }, [projectId]);

  // -------------------------------
  // Export everything
  // -------------------------------
  return {
    loading,
    setLoading,
    vendors,
    draftPRs,
    groupedItems,
    allItems,
    estimationId,
    baseRates,
    fetchVendors,
    fetchAvailableItems,
    fetchDraftPRs,
    fetchBaseRates,
  };
}
