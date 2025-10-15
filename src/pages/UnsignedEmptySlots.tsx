// src/pages/UnsignedEmptySlots.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Sidebar from "@/components/Sidebar";
import type { ScheduleItem } from "@/types";
import * as XLSX from "xlsx";

// 直接订阅 schedule 原始数据（绕开任何封装过滤）
import { database } from "@/lib/firebase";
import { ref as dbRef, onValue, off as offListener } from "firebase/database";

/* ---------------- utils（安全与格式） ---------------- */
const lower = (v: any) => String(v ?? "").toLowerCase();
const hasKey = (obj: any, key: string) => Object.prototype.hasOwnProperty.call(obj ?? {}, key);
const isRec = (x: any): x is Record<string, any> => !!x && typeof x === "object" && !Array.isArray(x);

/** URL 中的 dealerId 去掉末尾随机码 -xxxxxx */
function normalizeDealerSlug(raw?: string): string {
  const slug = lower(raw);
  const m = slug.match(/^(.*?)-([a-z0-9]{6})$/);
  return m ? m[1] : slug;
}

/** 把 Dealer 文本变为 slug（用于比较） */
function slugifyDealerName(name?: any): string {
  return String(name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** 将 slug 转成人类可读名称 */
function prettifyDealerName(slug: string): string {
  const s = slug.replace(/-/g, " ").trim();
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** 计算 Days Escaped（今天减 Order Received Date，dd/mm/yyyy） */
function calculateDaysEscaped(input?: any): number | string {
  const str = String(input ?? "").trim();
  if (!str) return "-";
  try {
    const parts = str.split("/");
    if (parts.length !== 3) return "-";
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-based
    const year = parseInt(parts[2], 10);
    if (isNaN(day) || isNaN(month) || isNaN(year)) return "-";
    const d = new Date(year, month, day);
    const t = new Date();
    d.setHours(0, 0, 0, 0);
    t.setHours(0, 0, 0, 0);
    const diff = Math.floor((t.getTime() - d.getTime()) / 86400000);
    return diff >= 0 ? diff : 0;
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

  /* -------- 直接订阅 Firebase/schedule 原始数据 -------- */
  useEffect(() => {
    const r = dbRef(database, "schedule");
    const unsub = onValue(
      r,
      (snap) => {
        const raw = snap.val();
        const list: ScheduleItem[] = raw
          ? Array.isArray(raw)
            ? (raw as any[]).filter(isRec)
            : (Object.values(raw) as any[]).filter(isRec)
          : [];
        setAllOrders(list);
        setLoading(false);

        // 调试：看看当前 dealer 下“缺 Chassis 键”的数量
        const dealerList = list.filter((o: any) => isRec(o) && slugifyDealerName(o.Dealer) === dealerSlug);
        const missingKey = dealerList.filter((o: any) => !hasKey(o, "Chassis"));
        console.debug(
          "[UnsignedEmptySlots] total:", list.length,
          "dealer:", dealerList.length,
          'missing "Chassis" key:', missingKey.length
        );
      },
      (err) => {
        console.error("subscribe schedule error:", err);
        setLoading(false);
      }
    );
    return () => {
      try { offListener(r); } catch {}
      try { unsub(); } catch {}
    };
  }, [dealerSlug]);

  /* -------- 过滤成当前 dealer 的记录 -------- */
  const dealerOrders = useMemo(() => {
    if (!dealerSlug) return [];
    return (allOrders || []).filter(
      (o: any) => isRec(o) && slugifyDealerName(o.Dealer) === dealerSlug
    );
  }, [allOrders, dealerSlug]);

  /* -------- Unsigned：有 Chassis 且不为空，且 Signed Plans Received 为空或 "No" -------- */
  const unsignedOrders = useMemo(() => {
    return dealerOrders.filter((order: any) => {
      if (!isRec(order)) return false;
      const hasChassis = hasKey(order, "Chassis") && String(order.Chassis ?? "") !== "";
      const v = lower(order["Signed Plans Received"]);
      const isUnsigned = v === "" || v === "no";
      return hasChassis && isUnsigned;
    });
  }, [dealerOrders]);

  /* -------- Empty Slots：严格“缺少 Chassis 这个字段（key 不存在）” -------- */
  const emptyOrders = useMemo(() => {
    return dealerOrders.filter((order: any) => {
      if (!isRec(order)) return false;
      const dealerOk =
        String(order.Dealer ?? "").trim() !== "" &&
        slugifyDealerName(order.Dealer) === dealerSlug;

      const noChassisField = !hasKey(order, "Chassis"); // 严格缺键
      return dealerOk && noChassisField;
    });

    // 如果你希望把 Chassis 为 ""/null 也视为 empty，把上面 return 替换为如下：
    // return dealerOrders.filter((order: any) => {
    //   if (!isRec(order)) return false;
    //   const dealerOk =
    //     String(order.Dealer ?? "").trim() !== "" &&
    //     slugifyDealerName(order.Dealer) === dealerSlug;
    //   const trulyMissing = !hasKey(order, "Chassis");
    //   const emptyValue = hasKey(order, "Chassis") && (order.Chassis == null || String(order.Chassis) === "");
    //   return dealerOk && (trulyMissing || emptyValue);
    // });
  }, [dealerOrders, dealerSlug]);

  /* -------- 当前显示的数据源 -------- */
  const currentOrders = activeTab === "unsigned" ? unsignedOrders : emptyOrders;

  /* -------- 搜索过滤（所有字段先 String 再 lower） -------- */
  const searchFilteredOrders = useMemo(() => {
    if (!searchTerm) return currentOrders;
    const s = lower(searchTerm);
    return currentOrders.filter((o: any) => {
      if (!isRec(o)) return false;
      return (
        lower(o.Chassis).includes(s) ||
        lower(o.Customer).includes(s) ||
        lower(o.Model).includes(s) ||
        lower(o["Forecast Production Date"]).includes(s) ||
        lower(o.Dealer).includes(s)
      );
    });
  }, [currentOrders, searchTerm]);

  /* -------- dealer 显示名 -------- */
  const dealerDisplayName = useMemo(() => {
    const fromOrder = isRec(dealerOrders[0]) ? dealerOrders[0].Dealer : undefined;
    return String(fromOrder ?? "").trim().length > 0
      ? String(fromOrder)
      : prettifyDealerName(dealerSlug);
  }, [dealerOrders, dealerSlug]);

  /* -------- 导出 Excel -------- */
  const exportToExcel = () => {
    if (searchFilteredOrders.length === 0) return;

    const excelData = searchFilteredOrders.map((order: any) => {
      const base = {
        "Forecast Production Date": String(order?.["Forecast Production Date"] ?? ""),
        Dealer: String(order?.Dealer ?? ""),
      };
      if (activeTab === "unsigned") {
        return {
          ...base,
          Chassis: String(order?.Chassis ?? ""),
          Customer: String(order?.Customer ?? ""),
          Model: String(order?.Model ?? ""),
          "Model Year": String(order?.["Model Year"] ?? ""),
          "Signed Plans Received": String(order?.["Signed Plans Received"] ?? ""),
          "Order Received Date": String(order?.["Order Received Date"] ?? ""),
          "Days Escaped": calculateDaysEscaped(order?.["Order Received Date"]),
        };
      }
      return base; // Empty 仅导出基础列，避免误导
    });

    try {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);
      (ws as any)["!cols"] = Object.keys(excelData[0] || {}).map((key) => ({ wch: Math.max(key.length, 15) }));
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
        orders={dealerOrders as any}
        selectedDealer="locked"
        onDealerSelect={() => {}}
        hideOtherDealers={true}
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
                  : `Orders with dealer but missing the "Chassis" field (${searchFilteredOrders.length} records)`}
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
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "unsigned" | "empty")} className="space-y-4">
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
              <div className="text-sm text-slate-600">
                Showing orders where "<strong>Signed Plans Received</strong>" is <strong>No</strong> or empty.
              </div>
            </TabsContent>

            <TabsContent value="empty" className="mt-0">
              <div className="text-sm text-slate-600">
                Showing orders for this dealer that <strong>do not have the "Chassis" field</strong> (missing key).
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Content */}
        <div className="flex-1 p-6">
          {loading ? (
            <div className="text-muted-foreground">Loading…</div>
          ) : searchFilteredOrders.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              {currentOrders.length === 0 ? (
                <>
                  No {activeTab === "unsigned" ? "unsigned orders" : "empty slots"} found for{" "}
                  <span className="font-medium">{dealerDisplayName}</span>.
                </>
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
                  {searchFilteredOrders.map((order: any, idx: number) => (
                    <TableRow key={`${String(order?.Chassis ?? "empty")}-${idx}`}>
                      <TableCell className="font-medium">{String(order?.["Forecast Production Date"] ?? "-")}</TableCell>
                      <TableCell className="font-medium">{String(order?.Dealer ?? "-")}</TableCell>

                      {activeTab === "unsigned" && (
                        <>
                          <TableCell>{String(order?.Chassis ?? "") || <span className="text-red-500 italic">Empty</span>}</TableCell>
                          <TableCell>{String(order?.Customer ?? "-")}</TableCell>
                          <TableCell>{String(order?.Model ?? "-")}</TableCell>
                          <TableCell>{String(order?.["Model Year"] ?? "-")}</TableCell>
                          <TableCell>
                            {(() => {
                              const v = lower(order?.["Signed Plans Received"]);
                              const danger = v === "" || v === "no";
                              return <span className={danger ? "text-red-600 font-medium" : ""}>{String(order?.["Signed Plans Received"] ?? "No")}</span>;
                            })()}
                          </TableCell>
                          <TableCell>{String(order?.["Order Received Date"] ?? "-")}</TableCell>
                          <TableCell>
                            {(() => {
                              const v = calculateDaysEscaped(order?.["Order Received Date"]);
                              return <span className="font-medium">{v}{typeof v === "number" ? " days" : ""}</span>;
                            })()}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
