// LOCATION: src/lib/hooks/index.js
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import toast from "react-hot-toast";

// ─── useDebounce ──────────────────────────────────────────────────────────────
export function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── useTableData ─────────────────────────────────────────────────────────────
// Single stable instance per (table+options) — does NOT re-fetch on every render
export function useTableData(table, options = {}) {
  const {
    columns = "*",
    filters = {},
    search = "",
    searchColumns = [],
    orderBy = "created_at",
    orderAsc = false,
    pageSize = 25,
    joins = "",
    softDelete = true,
  } = options;

  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pgSize, setPgSize] = useState(pageSize);

  const debouncedSearch = useDebounce(search, 400);
  const filtersKey = JSON.stringify(filters);
  const searchKey = searchColumns.join(",");

  // Abort controller ref — cancel stale requests
  const abortRef = useRef(null);

  const fetchData = useCallback(
    async (pg, size) => {
      // Cancel any in-flight request for this table
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      try {
        const sel = joins ? `${columns}, ${joins}` : columns;
        let q = supabase.from(table).select(sel, { count: "exact" });

        if (softDelete) q = q.is("deleted_at", null);

        const parsedFilters = JSON.parse(filtersKey);
        Object.entries(parsedFilters).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== "") q = q.eq(k, v);
        });

        if (debouncedSearch && searchKey) {
          const cols = searchKey.split(",").filter(Boolean);
          if (cols.length)
            q = q.or(
              cols.map((c) => `${c}.ilike.%${debouncedSearch}%`).join(","),
            );
        }

        const from = (pg - 1) * size;
        q = q
          .order(orderBy, { ascending: orderAsc })
          .range(from, from + size - 1);

        const { data: rows, count, error } = await q;
        if (controller.signal.aborted) return;
        if (error) toast.error(error.message);
        else {
          setData(rows || []);
          setTotal(count || 0);
        }
      } catch (err) {
        if (!controller.signal.aborted) toast.error("Error loading data");
      }
      setLoading(false);
    },
    [
      table,
      columns,
      joins,
      filtersKey,
      debouncedSearch,
      searchKey,
      orderBy,
      orderAsc,
      softDelete,
    ],
  );

  // Re-fetch when search/filters change — reset to page 1
  const prevSearch = useRef(debouncedSearch);
  const prevFilters = useRef(filtersKey);
  useEffect(() => {
    const searchChanged = prevSearch.current !== debouncedSearch;
    const filtersChanged = prevFilters.current !== filtersKey;
    prevSearch.current = debouncedSearch;
    prevFilters.current = filtersKey;
    if (searchChanged || filtersChanged) {
      setPage(1);
      fetchData(1, pgSize);
    } else {
      fetchData(page, pgSize);
    }
  }, [debouncedSearch, filtersKey, page, pgSize, fetchData]);

  const refresh = useCallback(
    () => fetchData(page, pgSize),
    [fetchData, page, pgSize],
  );

  return {
    data,
    total,
    page,
    pageSize: pgSize,
    loading,
    totalPages: Math.max(1, Math.ceil(total / pgSize)),
    setPage,
    setPageSize: (n) => {
      setPgSize(n);
      setPage(1);
    },
    refresh,
  };
}

// ─── MODULE-LEVEL LOOKUP CACHE ────────────────────────────────────────────────
// Persists for the lifetime of the browser session.
// Multiple components calling useLookup with the same key share one fetch.
const _lookupCache = {}; // key → data[]
const _lookupWaiters = {}; // key → [setState callbacks]
const _lookupFetching = {}; // key → boolean

export function useLookup(table, selectCols = "id, name", where = null) {
  const cacheKey = `${table}||${selectCols}||${where || ""}`;
  const [data, setData] = useState(_lookupCache[cacheKey] || []);
  const [loading, setLoading] = useState(!_lookupCache[cacheKey]);

  useEffect(() => {
    // Already cached → serve immediately, no network
    if (_lookupCache[cacheKey]) {
      setData(_lookupCache[cacheKey]);
      setLoading(false);
      return;
    }

    // Register callback to be called when the data arrives
    if (!_lookupWaiters[cacheKey]) _lookupWaiters[cacheKey] = [];
    _lookupWaiters[cacheKey].push((rows) => {
      setData(rows);
      setLoading(false);
    });

    // Only one fetch per key even if multiple components mount simultaneously
    if (_lookupFetching[cacheKey]) return;
    _lookupFetching[cacheKey] = true;

    let q = supabase
      .from(table)
      .select(selectCols)
      .order("name", { ascending: true });
    // Apply soft-delete filter for tables that support it
    const noDeleteTables = ["product_categories", "roles", "permissions"];
    if (!noDeleteTables.includes(table)) q = q.is("deleted_at", null);
    if (where) q = q.or(where);

    q.then(({ data: rows }) => {
      const result = rows || [];
      _lookupCache[cacheKey] = result;
      (_lookupWaiters[cacheKey] || []).forEach((cb) => cb(result));
      delete _lookupWaiters[cacheKey];
      delete _lookupFetching[cacheKey];
    });
  }, [cacheKey]);

  return { data, loading };
}

// Call this after creating/deleting a lookup item to bust the cache
export function bustLookupCache(table) {
  Object.keys(_lookupCache).forEach((k) => {
    if (k.startsWith(table + "||")) delete _lookupCache[k];
  });
}

// ─── useCompanySettings ───────────────────────────────────────────────────────
let _settings = null;
const _settingsCbs = [];
let _settingsFetch = false;

export function useCompanySettings() {
  const [settings, setSettings] = useState(_settings);
  const [loading, setLoading] = useState(!_settings);

  useEffect(() => {
    if (_settings) {
      setSettings(_settings);
      setLoading(false);
      return;
    }
    _settingsCbs.push((s) => {
      setSettings(s);
      setLoading(false);
    });
    if (_settingsFetch) return;
    _settingsFetch = true;
    supabase
      .from("company_settings")
      .select("*")
      .single()
      .then(({ data }) => {
        _settings = data;
        _settingsCbs.forEach((cb) => cb(data));
        _settingsCbs.length = 0;
      });
  }, []);

  return { settings, loading };
}

// ─── useDashboardStats ────────────────────────────────────────────────────────
export function useDashboardStats() {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    const monthStart = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    )
      .toISOString()
      .split("T")[0];

    Promise.all([
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null),
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null),
      supabase
        .from("suppliers")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null),
      supabase
        .from("invoices")
        .select("total_amount")
        .gte("invoice_date", today)
        .is("deleted_at", null),
      supabase
        .from("invoices")
        .select("total_amount")
        .gte("invoice_date", monthStart)
        .is("deleted_at", null),
      supabase
        .from("vehicles")
        .select("id, vehicle_status")
        .is("deleted_at", null),
      supabase
        .from("invoices")
        .select("pending_amount")
        .in("status", ["pending", "partial"])
        .is("deleted_at", null),
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .in("stock_status", ["low_stock", "out_of_stock"])
        .is("deleted_at", null),
    ]).then(
      ([cust, prod, supp, todayInv, monthInv, vehs, pendInv, lowStock]) => {
        setStats({
          totalCustomers: cust.count ?? 0,
          totalProducts: prod.count ?? 0,
          totalSuppliers: supp.count ?? 0,
          lowStockCount: lowStock.count ?? 0,
          todaySales: (todayInv.data || []).reduce(
            (s, r) => s + Number(r.total_amount),
            0,
          ),
          monthlySales: (monthInv.data || []).reduce(
            (s, r) => s + Number(r.total_amount),
            0,
          ),
          pendingCredits: (pendInv.data || []).reduce(
            (s, r) => s + Number(r.pending_amount),
            0,
          ),
          totalVehicles: vehs.count ?? 0,
          availableVehicles: (vehs.data || []).filter(
            (v) => v.vehicle_status === "available",
          ).length,
        });
        setLoading(false);
      },
    );
  }, []);

  return { stats, loading };
}

// ─── logActivity (fire-and-forget) ───────────────────────────────────────────
export function logActivity(userId, action, module, recordId = null) {
  supabase
    .from("activity_logs")
    .insert({ user_id: userId, action, module, record_id: recordId })
    .then(() => {});
}
