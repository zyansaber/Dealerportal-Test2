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

/** 将 URL 中的 dealerId 还原为真实的 slug（去掉随机后缀 -xxxxxx） */
function normalizeDealerSlug(raw?: string): string {
  const slug = (raw || "").toLowerCase();
  const m = slug.match(/^(.*?)-([a-z0-9]{6})$/);
  return m ? m[1] : slug;
}

/** 和首页一致的 slug 规则（把 Dealer 文本转为 slug，用于比较） */
function slugifyDealerName(name?: string): string {
  return (name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** 将 slug 转成人看得懂的 Dealer 名称（基础美化） */
function prettifyDealerName(slug: string): string {
  const s = slug.replace(/-/g, " ").trim();
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** 计算Days Escaped（今天减去Order Received Date）- 支持dd/mm/yyyy格式 */
function calculateDaysEscaped(orderReceivedDate?: string): number | string {
  if (!orderReceivedDate || orderReceivedDate.trim() === "") return "-";
  
  try {
    // 解析dd/mm/yyyy格式
    const parts = orderReceivedDate.split('/');
    if (parts.length !== 3) return "-";
    
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // JavaScript月份从0开始
    const year = parseInt(parts[2], 10);
    
    if (isNaN(day) || isNaN(month) || isNaN(year)) return "-";
    
    const orderDate = new Date(year, month, day);
    const today = new Date();
    
    // 重置时间部分，只比较日期
    orderDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    const diffTime = today.getTime() - orderDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays >= 0 ? diffDays : 0;
  } catch (error) {
    console.error("Error calculating days escaped:", error);
    return "-";
  }
}

export default function UnsignedEmptySlots() {
  const { dealerSlug: rawDealerSlug } = useParams<{ dealerSlug: string }>();
  const dealerSlug = useMemo(() => normalizeDealerSlug(rawDealerSlug), [rawDealerSlug]);

  const [allOrders, setAllOrders] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("unsigned");

  // 订阅全量数据
  useEffect(() => {
    const unsubSchedule = subscribeToSchedule((data) => {
      console.log("All schedule data:", data); // 调试用
      setAllOrders(data || []);
      setLoading(false);
    });
    return () => {
      unsubSchedule?.();
    };
  }, []);

  // 过滤当前dealer的订单
  const dealerOrders = useMemo(() => {
    if (!dealerSlug) return [];
    return (allOrders || []).filter((order) => {
      return slugifyDealerName(order.Dealer) === dealerSlug;
    });
  }, [allOrders, dealerSlug]);

  // Unsigned订单：Signed Plans Received 是 No 或者空
  const unsignedOrders = useMemo(() => {
    return dealerOrders.filter((order) => {
      const signedPlans = order["Signed Plans Received"];
      return !signedPlans || signedPlans.toLowerCase() === "no" || signedPlans.trim() === "";
    });
  }, [dealerOrders]);

  // Empty订单：有dealer但是没有chassis字段的（完全没有这个字段，不是空值）
  const emptyOrders = useMemo(() => {
    console.log("Checking empty orders for dealer:", dealerSlug);
    const filtered = dealerOrders.filter((order) => {
      // 必须有dealer
      const hasDealer = order.Dealer && order.Dealer.trim() !== "";
      // 完全没有chassis字段（不是空值，是没有这个属性）
      const hasNoChassis = !order.hasOwnProperty('Chassis') || order.Chassis === undefined || order.Chassis === null;
      
      console.log("Order:", order, "hasDealer:", hasDealer, "hasNoChassis:", hasNoChassis);
      return hasDealer && hasNoChassis;
    });
    
    console.log("Empty orders found:", filtered);
    return filtered;
  }, [dealerOrders, dealerSlug]);

  // 当前显示的订单
  const currentOrders = activeTab === "unsigned" ? unsignedOrders : emptyOrders;

  // 搜索过滤
  const searchFilteredOrders = useMemo(() => {
    if (!searchTerm) return currentOrders;
    
    return currentOrders.filter(order => {
      const searchLower = searchTerm.toLowerCase();
      return (
        (order.Chassis || "").toLowerCase().includes(searchLower) ||
        (order.Customer || "").toLowerCase().includes(searchLower) ||
        (order.Model || "").toLowerCase().includes(searchLower) ||
        (order["Forecast Production Date"] || "").toLowerCase().includes(searchLower) ||
        (order.Dealer || "").toLowerCase().includes(searchLower)
      );
    });
  }, [currentOrders, searchTerm]);

  // 获取dealer显示名称
  const dealerDisplayName = useMemo(() => {
    const fromOrder = dealerOrders[0]?.Dealer;
    return fromOrder && fromOrder.trim().length > 0
      ? fromOrder
      : prettifyDealerName(dealerSlug);
  }, [dealerOrders, dealerSlug]);

  // 导出Excel
  const exportToExcel = () => {
    if (searchFilteredOrders.length === 0) return;

    const excelData = searchFilteredOrders.map((order) => {
      const baseData = {
        "Forecast Production Date": order["Forecast Production Date"] || "",
        Dealer: order.Dealer || "",
      };

      if (activeTab === "unsigned") {
        return {
          ...baseData,
          Chassis: order.Chassis || "",
          Customer: order.Customer || "",
          Model: order.Model || "",
          "Model Year": order["Model Year"] || "",
          "Signed Plans Received": order["Signed Plans Received"] || "",
          "Order Received Date": order["Order Received Date"] || "",
          "Days Escaped": calculateDaysEscaped(order["Order Received Date"]),
        };
      } else {
        return baseData;
      }
    });

    try {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      const colWidths = Object.keys(excelData[0] || {}).map((key) => ({
        wch: Math.max(key.length, 15),
      }));
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
        orders={dealerOrders}
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
                  : `Orders with dealer but no chassis field (${searchFilteredOrders.length} records)`
                }
              </p>
            </div>

            <Button
              onClick={exportToExcel}
              disabled={searchFilteredOrders.length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Excel
            </Button>
          </div>
        </header>

        {/* Tabs */}
        <div className="bg-slate-50 border-b border-slate-200 p-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="unsigned">Unsigned ({unsignedOrders.length})</TabsTrigger>
              <TabsTrigger value="empty">Empty Slots ({emptyOrders.length})</TabsTrigger>
            </TabsList>

            {/* Search */}
            <Input
              placeholder="Search by chassis, customer, model, production date, or dealer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />

            <TabsContent value="unsigned" className="mt-0">
              <div className="text-sm text-slate-600">
                Showing orders where "Signed Plans Received" is No or empty
              </div>
            </TabsContent>

            <TabsContent value="empty" className="mt-0">
              <div className="text-sm text-slate-600">
                Showing orders with dealer assigned but completely missing chassis field (not just empty value)
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Debug Info */}
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
                  {searchFilteredOrders.map((order, index) => (
                    <TableRow key={`${order.Chassis || 'empty'}-${index}`}>
                      <TableCell className="font-medium">
                        {order["Forecast Production Date"] || "-"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {order.Dealer || "-"}
                      </TableCell>
                      {activeTab === "unsigned" && (
                        <>
                          <TableCell>
                            {order.Chassis || <span className="text-red-500 italic">Empty</span>}
                          </TableCell>
                          <TableCell>{order.Customer || "-"}</TableCell>
                          <TableCell>{order.Model || "-"}</TableCell>
                          <TableCell>{order["Model Year"] || "-"}</TableCell>
                          <TableCell>
                            <span className={
                              !order["Signed Plans Received"] || 
                              order["Signed Plans Received"].toLowerCase() === "no" ||
                              order["Signed Plans Received"].trim() === ""
                                ? "text-red-600 font-medium" 
                                : ""
                            }>
                              {order["Signed Plans Received"] || "No"}
                            </span>
                          </TableCell>
                          <TableCell>{order["Order Received Date"] || "-"}</TableCell>
                          <TableCell>
                            <span className="font-medium">
                              {calculateDaysEscaped(order["Order Received Date"])}
                              {typeof calculateDaysEscaped(order["Order Received Date"]) === "number" ? " days" : ""}
                            </span>
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