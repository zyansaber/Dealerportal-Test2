// src/pages/UnsignedEmptySlots.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Sidebar from "@/components/Sidebar";
import { subscribeToSchedule } from "@/lib/firebase";
import type { ScheduleItem } from "@/types";
import * as XLSX from "xlsx";

/** ---- 安全工具函数 ---- */
const toStr = (v: any) => String(v ?? "");
const lower = (v: any) => toStr(v).toLowerCase();
const hasKey = (obj: any, key: string) => Object.prototype.hasOwnProperty.call(obj ?? {}, key);

/** URL slug 处理 */
function normalizeDealerSlug(raw?: string): string {
  const slug = lower(raw);
  const m = slug.match(/^(.*?)-([a-z0-9]{6})$/);
  return m ? m[1] : slug;
}
function slugifyDealerName(name?: string): string {
  return toStr(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function prettifyDealerName(slug: string): string {
  const s = slug.replace(/-/g, " ").trim();
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** 计算 Days Escaped（dd/mm/yyyy） */
function calculateDaysEscaped(orderReceivedDate?: string): number | string {
  const raw = toStr(orderReceivedDate).trim();
  if (!raw) return "-";
  try {
    const parts = raw.split("/");
    if (parts.length !== 3) return "-";
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-based
    const year = parseInt(parts[2], 10);
    if (isNaN(day) || isNaN(month) || isNaN(year)) return "-";
    const orderDate = new Date(year, month, day);
    const today = new Date();
    orderDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - orderDate.getTime();
    const diffDays = Math.floor(diffTime / 86400000);
    return diffDays >= 0 ? diffDays : 0;
  } catch {
    return "-";
  }
}

export default function UnsignedEmptySlots() {
  const { dealerSlug: rawDealerSlug } = useParams<{ dealerSlug: string }>();
  const dealerSlug = useMemo(() => normalizeDealerSlug(rawDealerSlug), [rawDealerSlug]);

  const [allOrders, setAllOrders] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"unsigned" | "empty">("unsigned");

  /** 仅此页面放开过滤（允许 无Chassis / 无Customer / 包含 Finished） */
  useEffect(() => {
    const unsubSchedule = subscribeToSchedule(
      (data) => {
        const arr = Array.isArray(data) ? data.filter(Boolean) : Object.values(data || {}).filter(Boolean);
        setAllOrders(arr as ScheduleItem[]);
        setLoading(false);
      },
      { includeNoChassis: true, includeNoCustomer: true, includeFinished: true }
    );
    return () => { unsubSchedule?.(); };
  }, []);

  /** 只取当前 dealer 的订单（安全 slug 化） */
  const dealerOrders = useMemo(() => {
    if (!dealerSlug) return [];
    return (allOrders || []).filter((order) => slugifyDealerName(order?.Dealer) === dealerSlug);
  }, [allOrders, dealerSlug]);

  /** 给 Sidebar 的“安全版本”订单（全部关键字符串字段都强制转为字符串，防止 Sidebar 内部 .toLowerCase() 报错） */
  const sanitizedDealerOrders = useMemo(() => {
    return dealerOrders.map((o) => ({
      ...o,
      Dealer: toStr(o?.Dealer),
      Customer: toStr(o?.Customer),
      Model: toStr(o?.Model),
      // 这里特意把 Chassis 也转成字符串 —— 只影响 Sidebar 的展示/统计，不影响本页 Empty 的“缺键”判断
      Chassis: hasKey(o, "Chassis") ? toStr(o?.Chassis) : undefined,
      "Forecast Production Date": toStr(o?.["Forecast Production Date"]),
      "Signed Plans Received": toStr(o?.["Signed Plans Received"]),
      "Order Received Date": toStr(o?.["Order Received Date"]),
      "Model Year": toStr(o?.["Model Year"]),
    }));
  }, [dealerOrders]);

  /** Unsigned：必须存在 Chassis 字段且非空；“Signed Plans Received”为 No 或空 */
  const unsignedOrders = useMemo(() => {
    return dealerOrders.filter((order) => {
      const hasChassisField = hasKey(order, "Chassis");
      const chassisVal = toStr(order?.Chassis);
      const hasChassis = hasChassisField && chassisVal !== "";
      const signedPlans = lower(order?.["Signed Plans Received"]);
      const isUnsigned = !signedPlans || signedPlans === "no";
      return hasChassis && isUnsigned;
    });
  }, [dealerOrders]);

  /** Empty：有 Dealer，但完全没有 Chassis 这个 key（严格缺键） */
  const emptyOrders = useMemo(() => {
    return dealerOrders.filter((order) => {
      const hasDealer = toStr(order?.Dealer).trim() !== "";
      const noChassisField = !hasKey(order, "Chassis");
      return hasDealer && noChassisField;
    });
  }, [dealerOrders]);

  /** 当前 tab 数据 */
  const currentOrders = activeTab === "unsigned" ? unsignedOrders : emptyOrders;

  /** 搜索（字段全部低风险转换） */
  const searchFilteredOrders = useMemo(() => {
    if (!searchTerm) return currentOrders;
    const s = lower(searchTerm);
    return currentOrders.filter((order) =>
      lower(order?.Chassis).includes(s) ||
      lower(order?.Customer).includes(s) ||
      lower(order?.Model).includes(s) ||
      lower(order?.["Forecast Production Date"]).includes(s) ||
      lower(order?.Dealer).includes(s)
    );
  }, [currentOrders, searchTerm]);

  /** 页面抬头展示的 dealer 名 */
  const dealerDisplayName = useMemo(() => {
    const fromOrder = toStr(dealerOrders[0]?.Dealer);
    return fromOrder.trim().length > 0 ? fromOrder : prettifyDealerName(dealerSlug);
  }, [dealerOrders, dealerSlug]);

  /** 导出 Excel */
  const exportToExcel = () => {
    if (searchFilteredOrders.length === 0) return;
    const excelData = searchFilteredOrders.map((order) => {
      const baseData = {
        "Forecast Production Date": toStr(order?.["Forecast Production Date"]),
        Dealer: toStr(order?.Dealer),
      };
      if (activeTab === "unsigned") {
        return {
          ...baseData,
          Chassis: toStr(order?.Chassis),
          Customer: toStr(order?.Customer),
          Model: toStr(order?.Model),
          "Model Year": toStr(order?.["Model Year"]),
          "Signed Plans Received": toStr(order?.["Signed Plans Received"]),
          "Order Received Date": toStr(order?.["Order Received Date"]),
          "Days Escaped": calculateDaysEscaped(order?.["Order Received Date"]),
        };
      }
      return baseData;
    });

    try {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);
      const colWidths = Object.keys(excelData[0] || {}).map((key) => ({ wch: Math.max(key.length, 15) }));
      (ws as any)["!cols"] = colWidths;
      const date = new Date().toISOString().split("T")[0];
      const tabName = activeTab === "unsigned" ? "Unsigned" : "Empty_Slots";
      const filename = `${dealerDisplayName}_${tabName}_${date}.xlsx`;
      XLSX.utils.book_append_sheet(wb, ws, tabName);
      XLSX.writeFile(wb, filename);
    } catch (err) {
      console.error("Export excel failed:", err);
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar
        orders={sanitizedDealerOrders}  // ← 这里换成“安全版本”传给 Sidebar
        selectedDealer="locked"
        onDealerSelect={() => {}}
        hideOtherDealers
        currentDealerName={dealerDisplayName}
        showStats={false}
      />

      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                Unsigned & Empty Slots — {dealerDisplayName}
              </h1>
              <p className="text-slate-600 mt-1">
                {activeTab === "unsigned"
                  ? `Orders with no signed plans (${searchFilteredOrders.length} records)`
                  : `Orders with dealer but no chassis field (${searchFilteredOrders.length} records)`}
              </p>
            </div>
            <Button onClick={exportToExcel} disabled={searchFilteredOrders.length === 0} className="bg-green-600 hover:bg-green-700">
              <Download className="w-4 h-4 mr-2" />
              Export Excel
            </Button>
          </div>
        </header>

        {/* Tabs + Search */}
        <div className="bg-slate-50 border-b border-slate-200 p-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab((v as "unsigned" | "empty") ?? "unsigned")} className="space-y-4">
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="unsigned">Unsigned ({unsignedOrders.length})</TabsTrigger>
              <TabsTrigger value="empty">Empty Slots ({emptyOrders.length})</TabsTrigger>
            </TabsList>

            <Input
              placeholder="Search by chassis, customer, model, production date, or dealer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />

            <TabsContent value="unsigned" className="mt-0">
              <div className="text-sm text-slate-600">Showing orders where "Signed Plans Received" is No or empty</div>
            </TabsContent>
            <TabsContent value="empty" className="mt-0">
              <div className="text-sm text-slate-600">Showing orders with dealer assigned but completely missing chassis field (not just empty value)</div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Debug Info（可删） */}
        <div className="p-4 bg-yellow-50 border-b border-yellow-200">
          <div className="text-sm text-yellow-800">
            Debug: Total dealer orders: {dealerOrders.length}, Empty orders: {emptyOrders.length}, Unsigned orders: {unsignedOrders.length}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6">
          {loading ? (
            <div className="text-muted-foreground">Loading…</div>
          ) : searchFilteredOrders.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              {currentOrders.length === 0 ? (
                <>No {activeTab === "unsigned" ? "unsigned orders" : "empty slots"} found for <span className="font-medium">{dealerDisplayName}</span>.</>
              ) : (
                <>No records match your search criteria.</>
              )}
            </div>
          ) : (
            <div className="rounded-xl border bg-white overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold">Forecast Production Date</TableHead>
                    <TableHead className="font-semibold">Dealer</TableHead>
                    {activeTab === "unsigned" && (
                      <>
                        <TableHead className="font-semibold">Chassis</TableHead>
                        <TableHead className="font-semibold">Customer</TableHead>
                        <TableHead className="font-semibold">Model</TableHead>
                        <TableHead className="font-semibold">Model Year</TableHead>
                        <TableHead className="font-semibold">Signed Plans Received</TableHead>
                        <TableHead className="font-semibold">Order Received Date</TableHead>
                        <TableHead className="font-semibold">Days Escaped</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchFilteredOrders.map((order, idx) => {
                    const key = `${toStr(order?.Chassis) || "empty"}-${idx}`;
                    const spr = lower(order?.["Signed Plans Received"]);
                    const orderReceived = toStr(order?.["Order Received Date"]);
                    const daysEscaped = calculateDaysEscaped(orderReceived);
                    return (
                      <TableRow key={key}>
                        <TableCell className="font-medium">{toStr(order?.["Forecast Production Date"]) || "-"}</TableCell>
                        <TableCell className="font-medium">{toStr(order?.Dealer) || "-"}</TableCell>
                        {activeTab === "unsigned" && (
                          <>
                            <TableCell>{toStr(order?.Chassis) || <span className="text-red-500 italic">Empty</span>}</TableCell>
                            <TableCell>{toStr(order?.Customer) || "-"}</TableCell>
                            <TableCell>{toStr(order?.Model) || "-"}</TableCell>
                            <TableCell>{toStr(order?.["Model Year"]) || "-"}</TableCell>
                            <TableCell>
                              <span className={!spr || spr === "no" ? "text-red-600 font-medium" : ""}>
                                {toStr(order?.["Signed Plans Received"]) || "No"}
                              </span>
                            </TableCell>
                            <TableCell>{orderReceived || "-"}</TableCell>
                            <TableCell>
                              <span className="font-medium">
                                {daysEscaped}
                                {typeof daysEscaped === "number" ? " days" : ""}
                              </span>
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
