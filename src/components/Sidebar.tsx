import { useMemo } from "react";
import { Package, Users, TrendingUp, Calendar, BarChart3, Factory, FileX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NavLink, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { ScheduleItem } from "@/types";

interface SidebarProps {
  orders: ScheduleItem[];
  selectedDealer: string;
  onDealerSelect: (dealer: string) => void;
  hideOtherDealers?: boolean; // 新增：是否隐藏其他dealer信息
  currentDealerName?: string; // 新增：当前dealer显示名称
  showStats?: boolean; // 是否显示统计数据（在DealerPortal页面不显示）
}

export default function Sidebar({ 
  orders, 
  selectedDealer, 
  onDealerSelect,
  hideOtherDealers = false,
  currentDealerName,
  showStats = true
}: SidebarProps) {
  const { dealerSlug } = useParams<{ dealerSlug: string }>();

  // 获取所有dealer列表
  const dealers = useMemo(() => {
    const dealerSet = new Set<string>();
    orders.forEach((order) => {
      if (order.Dealer) {
        dealerSet.add(order.Dealer);
      }
    });
    return Array.from(dealerSet).sort();
  }, [orders]);

  // 根据选中的dealer过滤订单
  const filteredOrders = useMemo(() => {
    if (hideOtherDealers) {
      // 在库存页面，只显示当前dealer的统计信息
      return orders;
    }
    if (selectedDealer === "all") {
      return orders;
    }
    return orders.filter(order => order.Dealer === selectedDealer);
  }, [orders, selectedDealer, hideOtherDealers]);

  // 计算统计数据
  const stats = useMemo(() => {
    const total = filteredOrders.length;
    const stockVehicles = filteredOrders.filter(order => 
      order.Customer.toLowerCase().endsWith('stock')
    ).length;
    const customerVehicles = total - stockVehicles;
    
    // 按状态分组
    const statusCounts = filteredOrders.reduce((acc, order) => {
      const status = order["Regent Production"] || "Not Started";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // 按型号分组
    const modelCounts = filteredOrders.reduce((acc, order) => {
      const model = order.Model || "Unknown";
      acc[model] = (acc[model] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      stockVehicles,
      customerVehicles,
      statusCounts,
      modelCounts
    };
  }, [filteredOrders]);

  // 获取显示的dealer名称
  const displayDealerName = useMemo(() => {
    if (hideOtherDealers && currentDealerName) {
      return currentDealerName;
    }
    if (selectedDealer === "all") {
      return "All Dealers";
    }
    return selectedDealer;
  }, [selectedDealer, hideOtherDealers, currentDealerName]);

  // 导航路径
  const basePath = dealerSlug ? `/dealer/${dealerSlug}` : '/';
  const navigationItems = [
    {
      path: basePath,
      label: "Dealer Orders",
      icon: BarChart3,
      end: true
    },
    {
      path: `${basePath}/inventorystock`,
      label: "Factory Inventory",
      icon: Factory,
      end: true
    },
    {
      path: `${basePath}/unsigned`,
      label: "Unsigned & Empty Slots",
      icon: FileX,
      end: true
    },
    {
      path: `${basePath}/dashboard`,
      label: "Dashboard",
      icon: Package,
      end: true
    }
  ];

  return (
    <aside className="w-80 bg-white border-r border-slate-200 flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <Package className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              {hideOtherDealers ? displayDealerName : "Dealer Portal"}
            </h1>
            <p className="text-sm text-slate-500">Order Management System</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      {dealerSlug && (
        <div className="p-4 border-b border-slate-200">
          <nav className="space-y-1">
            {navigationItems.map((item) => (
              <NavLink key={item.path} to={item.path} end={item.end}>
                {({ isActive }) => (
                  <Button 
                    variant={isActive ? "default" : "ghost"} 
                    className="w-full justify-start"
                  >
                    <item.icon className="w-4 h-4 mr-3" />
                    {item.label}
                  </Button>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      )}

      {/* Dealer Selection - 只在非隐藏模式下显示 */}
      {!hideOtherDealers && (
        <div className="p-4 border-b border-slate-200">
          <h3 className="text-sm font-medium text-slate-700 mb-3">Select Dealer</h3>
          <Select value={selectedDealer} onValueChange={onDealerSelect}>
            <SelectTrigger>
              <SelectValue placeholder="Select a dealer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Dealers</SelectItem>
              {dealers.map(dealer => (
                <SelectItem key={dealer} value={dealer}>
                  {dealer}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Current Context Display - 在隐藏模式下显示当前dealer */}
      {hideOtherDealers && (
        <div className="p-4 border-b border-slate-200">
          <h3 className="text-sm font-medium text-slate-700 mb-3">Current Dealer</h3>
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="font-medium text-blue-900">{displayDealerName}</div>
            <div className="text-sm text-blue-700">Dealer Portal</div>
          </div>
        </div>
      )}

      {/* Overview Stats - 只在showStats为true时显示 */}
      {showStats && (
        <div className="p-4 space-y-4">
          <h3 className="text-sm font-medium text-slate-700">
            {hideOtherDealers ? `${displayDealerName} Overview` : `${displayDealerName} Overview`}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-slate-600 flex items-center">
                  <Package className="w-3 h-3 mr-1" />
                  Total Orders
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-slate-600 flex items-center">
                  <Users className="w-3 h-3 mr-1" />
                  Customer
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xl font-bold">{stats.customerVehicles}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-slate-600 flex items-center">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Stock
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xl font-bold">{stats.stockVehicles}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-slate-600 flex items-center">
                  <Calendar className="w-3 h-3 mr-1" />
                  Models
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xl font-bold">{Object.keys(stats.modelCounts).length}</div>
              </CardContent>
            </Card>
          </div>

          {/* Production Status Breakdown */}
          <div>
            <h4 className="text-sm font-medium text-slate-700 mb-3">Production Status</h4>
            <div className="space-y-2">
              {Object.entries(stats.statusCounts)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5)
                .map(([status, count]) => (
                  <div key={status} className="flex justify-between items-center py-2 px-3 bg-slate-50 rounded">
                    <span className="text-sm text-slate-700 truncate">{status}</span>
                    <span className="text-sm font-medium text-slate-900">{count}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Model Breakdown */}
          <div>
            <h4 className="text-sm font-medium text-slate-700 mb-3">Models</h4>
            <div className="space-y-2">
              {Object.entries(stats.modelCounts)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5)
                .map(([model, count]) => (
                  <div key={model} className="flex justify-between items-center py-2 px-3 bg-slate-50 rounded">
                    <span className="text-sm text-slate-700 truncate">{model}</span>
                    <span className="text-sm font-medium text-slate-900">{count}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}