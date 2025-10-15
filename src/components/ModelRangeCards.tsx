import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, Package, Users } from "lucide-react";
import type { ScheduleItem } from "@/types";

interface ModelRangeCardsProps {
  orders: ScheduleItem[];
  onFilterChange: (filters: { modelRange?: string; customerType?: string }) => void;
}

export default function ModelRangeCards({ orders, onFilterChange }: ModelRangeCardsProps) {
  const [selectedRange, setSelectedRange] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  // 计算模型范围统计（基于chassis前三位）
  const modelRanges = useMemo(() => {
    const rangeMap = new Map<string, { total: number; stock: number; customer: number; orders: ScheduleItem[] }>();
    
    orders.forEach(order => {
      if (!order.Chassis) return;
      
      const prefix = order.Chassis.substring(0, 3).toUpperCase();
      const isStock = order.Customer.toLowerCase().endsWith('stock');
      
      if (!rangeMap.has(prefix)) {
        rangeMap.set(prefix, { total: 0, stock: 0, customer: 0, orders: [] });
      }
      
      const range = rangeMap.get(prefix)!;
      range.total++;
      range.orders.push(order);
      
      if (isStock) {
        range.stock++;
      } else {
        range.customer++;
      }
    });
    
    return Array.from(rangeMap.entries())
      .map(([prefix, data]) => ({ prefix, ...data }))
      .sort((a, b) => b.total - a.total);
  }, [orders]);

  const handleRangeClick = (prefix: string) => {
    if (selectedRange === prefix) {
      // 取消选择
      setSelectedRange(null);
      setSelectedType(null);
      onFilterChange({});
    } else {
      // 选择新的范围
      setSelectedRange(prefix);
      setSelectedType(null);
      onFilterChange({ modelRange: prefix });
    }
  };

  const handleTypeClick = (type: 'stock' | 'customer') => {
    if (!selectedRange) return;
    
    if (selectedType === type) {
      // 取消类型选择，但保持范围选择
      setSelectedType(null);
      onFilterChange({ modelRange: selectedRange });
    } else {
      // 选择新类型
      setSelectedType(type);
      onFilterChange({ modelRange: selectedRange, customerType: type });
    }
  };

  // 获取当前选中范围的详细信息
  const selectedRangeData = selectedRange ? modelRanges.find(r => r.prefix === selectedRange) : null;

  return (
    <div className="space-y-4">
      {/* Model Range Cards */}
      <div>
        <h3 className="text-sm font-medium text-slate-700 mb-3">Model Ranges (by Chassis Prefix)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {modelRanges.map(({ prefix, total, stock, customer }) => (
            <Card 
              key={prefix}
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedRange === prefix ? 'ring-2 ring-blue-500 bg-blue-50' : ''
              }`}
              onClick={() => handleRangeClick(prefix)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  {prefix}
                  {selectedRange === prefix && <ChevronRight className="w-4 h-4" />}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-lg font-bold text-blue-600">{total}</div>
                <div className="text-xs text-slate-500 mt-1">
                  <div>Stock: {stock}</div>
                  <div>Customer: {customer}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Second Level - Stock/Customer Breakdown */}
      {selectedRange && selectedRangeData && (
        <div>
          <h3 className="text-sm font-medium text-slate-700 mb-3">
            {selectedRange} Breakdown
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Card 
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedType === 'stock' ? 'ring-2 ring-green-500 bg-green-50' : ''
              }`}
              onClick={() => handleTypeClick('stock')}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center">
                  <Package className="w-4 h-4 mr-2" />
                  Stock Orders
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xl font-bold text-green-600">{selectedRangeData.stock}</div>
                <Badge variant="outline" className="mt-1">
                  {((selectedRangeData.stock / selectedRangeData.total) * 100).toFixed(1)}%
                </Badge>
              </CardContent>
            </Card>

            <Card 
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedType === 'customer' ? 'ring-2 ring-purple-500 bg-purple-50' : ''
              }`}
              onClick={() => handleTypeClick('customer')}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center">
                  <Users className="w-4 h-4 mr-2" />
                  Customer Orders
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xl font-bold text-purple-600">{selectedRangeData.customer}</div>
                <Badge variant="outline" className="mt-1">
                  {((selectedRangeData.customer / selectedRangeData.total) * 100).toFixed(1)}%
                </Badge>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Clear Filters */}
      {(selectedRange || selectedType) && (
        <div className="flex justify-end">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              setSelectedRange(null);
              setSelectedType(null);
              onFilterChange({});
            }}
          >
            Clear Filters
          </Button>
        </div>
      )}
    </div>
  );
}