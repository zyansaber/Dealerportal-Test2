// src/pages/DealerPortal.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Sidebar from "@/components/Sidebar";
import OrderList from "@/components/OrderList";
import {
  subscribeToSchedule,
  subscribeToSpecPlan,
  subscribeToDateTrack,
} from "@/lib/firebase";
import type { ScheduleItem, SpecPlan, DateTrack } from "@/types";
import * as XLSX from "xlsx";

/** 将 URL 中的 dealerId 还原为真实的 slug（去掉随机后缀 -xxxxxx） */
function normalizeDealerSlug(raw?: string): string {
  const slug = (raw || "").toLowerCase();
  const m = slug.match(/^(.*?)-([a-z0-9]{6})$/); // 末尾一段随机码
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

export default function DealerPortal() {
  const { dealerSlug: rawDealerSlug } = useParams<{ dealerSlug: string }>();
  const dealerSlug = useMemo(() => normalizeDealerSlug(rawDealerSlug), [rawDealerSlug]);

  const [allOrders, setAllOrders] = useState<ScheduleItem[]>([]);
  const [specPlans, setSpecPlans] = useState<SpecPlan>({});
  const [dateTracks, setDateTracks] = useState<DateTrack>({});
  const [loading, setLoading] = useState(true);
  
  // 新增过滤状态
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  // 订阅全量数据（与首页一致），本页再按 dealer 过滤
  useEffect(() => {
    const unsubSchedule = subscribeToSchedule((data) => {
      setAllOrders(data || []);
      setLoading(false);
    });
    const unsubSpecPlan = subscribeToSpecPlan((data) => setSpecPlans(data || {}));
    const unsubDateTrack = subscribeToDateTrack((data) => setDateTracks(data || {}));
    return () => {
      unsubSchedule?.();
      unsubSpecPlan?.();
      unsubDateTrack?.();
    };
  }, []);

  // 只展示当前 dealer 的订单
  const dealerOrders = useMemo(() => {
    if (!dealerSlug) return [];
    return (allOrders || []).filter(
      (o) => slugifyDealerName(o.Dealer) === dealerSlug
    );
  }, [allOrders, dealerSlug]);

  // 过滤订单
  const filteredOrders = useMemo(() => {
    return dealerOrders.filter(order => {
      // Model 过滤
      if (selectedModel !== "all" && order.Model !== selectedModel) return false;
      
      // Status 过滤
      if (selectedStatus !== "all" && order["Regent Production"] !== selectedStatus) return false;
      
      // 搜索过滤
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          (order.Chassis || "").toLowerCase().includes(searchLower) ||
          (order.Customer || "").toLowerCase().includes(searchLower) ||
          (order.Model || "").toLowerCase().includes(searchLower) ||
          (order["Regent Production"] || "").toLowerCase().includes(searchLower)
        );
      }
      
      return true;
    });
  }, [dealerOrders, selectedModel, selectedStatus, searchTerm]);

  // 展示用的 Dealer 名称：优先来自订单里的原始 Dealer 文本，否则用 slug 美化
  const dealerDisplayName = useMemo(() => {
    const fromOrder = dealerOrders[0]?.Dealer;
    return fromOrder && fromOrder.trim().length > 0
      ? fromOrder
      : prettifyDealerName(dealerSlug);
  }, [dealerOrders, dealerSlug]);

  // 获取所有可选项
  const filterOptions = useMemo(() => {
    const models = [...new Set(dealerOrders.map(o => o.Model).filter(Boolean))].sort();
    const statuses = [...new Set(dealerOrders.map(o => o["Regent Production"]).filter(Boolean))].sort();
    
    return { models, statuses };
  }, [dealerOrders]);

  const exportToExcel = () => {
    if (filteredOrders.length === 0) return;

    const excelData = filteredOrders.map((order) => {
      // 以 Chassis 为 key 直取；若结构是按"Chassis Number"存的，再兜底找一次
      const dateTrack =
        (dateTracks as any)[order.Chassis] ||
        (Object.values(dateTracks) as any[]).find(
          (dt: any) => dt?.["Chassis Number"] === order.Chassis
        );

      return {
        Chassis: order.Chassis,
        Customer: order.Customer,
        Model: order.Model,
        "Model Year": order["Model Year"],
        Dealer: order.Dealer,
        "Forecast Production Date": order["Forecast Production Date"],
        "Order Received Date": order["Order Received Date"] || "",
        "Signed Plans Received": order["Signed Plans Received"] || "",
        "Purchase Order Sent": order["Purchase Order Sent"] || "",
        "Price Date": order["Price Date"] || "",
        "Request Delivery Date": order["Request Delivery Date"] || "",
        "Regent Production": order["Regent Production"] || "",
        Shipment: (order as any).Shipment || "",
        "Left Port": (dateTrack || {})["Left Port"] || "",
        "Received in Melbourne": (dateTrack || {})["Received in Melbourne"] || "",
        "Dispatched from Factory": (dateTrack || {})["Dispatched from Factory"] || "",
      };
    });

    try {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // 粗略的列宽（可根据最长标题适配）
      const colWidths = Object.keys(excelData[0] || {}).map((key) => ({
        wch: Math.max(key.length, 15),
      }));
      (ws as any)["!cols"] = colWidths;

      const date = new Date().toISOString().split("T")[0];
      const filename = `${dealerDisplayName}_Orders_${date}.xlsx`;

      XLSX.utils.book_append_sheet(wb, ws, "Orders");
      XLSX.writeFile(wb, filename);
    } catch (err) {
      console.error("Export excel failed:", err);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* 只给 Sidebar 当前经销商的订单，禁用切换 */}
      <Sidebar
        orders={filteredOrders}
        selectedDealer={dealerDisplayName}
        onDealerSelect={() => {}}
      />
      <main className="flex-1 p-6 space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Dealer Portal — {dealerDisplayName}</h1>
            <p className="text-muted-foreground mt-1">
              Order Tracking ({filteredOrders.length} of {dealerOrders.length} orders)
            </p>
          </div>

          <Button
            onClick={exportToExcel}
            disabled={filteredOrders.length === 0}
            className="bg-green-600 hover:bg-green-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
        </header>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <Input
            placeholder="Search chassis, customer, model, status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64"
          />
          
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Models" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Models</SelectItem>
              {filterOptions.models.map(model => (
                <SelectItem key={model} value={model}>{model}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {filterOptions.statuses.map(status => (
                <SelectItem key={status} value={status}>{status}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-muted-foreground">Loading…</div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-muted-foreground">
            {dealerOrders.length === 0 ? (
              <>No orders found for <span className="font-medium">{dealerDisplayName}</span>.</>
            ) : (
              <>No orders match your current filters.</>
            )}
          </div>
        ) : (
          <OrderList orders={filteredOrders} specPlans={specPlans} dateTracks={dateTracks} />
        )}
      </main>
    </div>
  );
}