import { useParams, useNavigate } from "react-router-dom";
import { subscribeDealerConfig, type DealerConfig } from "@/lib/firebase";
import { useMemo, useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { subscribeToSchedule } from "@/lib/firebase";
import type { ScheduleItem } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Settings } from "lucide-react";

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

export default function DealerDashboard() {
  const { dealerSlug: rawDealerSlug } = useParams<{ dealerSlug: string }>();
  const dealerSlug = useMemo(() => normalizeDealerSlug(rawDealerSlug), [rawDealerSlug]);

  const [allOrders, setAllOrders] = useState<ScheduleItem[]>([]);
  const [powerbiUrl, setPowerbiUrl] = useState("");

  // 订阅订单数据
  useEffect(() => {
    const unsubSchedule = subscribeToSchedule((data) => {
      setAllOrders(data || []);
    });
    return () => {
      unsubSchedule?.();
    };
  }, []);

  // 过滤当前dealer的订单
  const orders = useMemo(() => {
    if (!dealerSlug) return [];
    return (allOrders || []).filter(
      (o) => slugifyDealerName(o.Dealer) === dealerSlug
    );
  }, [allOrders, dealerSlug]);

  // 获取dealer显示名称
  const dealerDisplayName = useMemo(() => {
    const fromOrder = orders[0]?.Dealer;
    return fromOrder && fromOrder.trim().length > 0
      ? fromOrder
      : prettifyDealerName(dealerSlug);
  }, [orders, dealerSlug]);

  // 从 Firebase 订阅 dealer 配置并设置 PowerBI URL
  const navigate = useNavigate();
  const [cfg, setCfg] = useState<DealerConfig | null>(null);
  useEffect(() => {
    if (!dealerSlug) return;
    const off = subscribeDealerConfig(dealerSlug, (c) => setCfg(c));
    return () => off?.();
  }, [dealerSlug]);

  useEffect(() => {
    if (!cfg) return;
    if (cfg.powerbi_url) setPowerbiUrl(cfg.powerbi_url);
    // 访问控制：access + code
    if (cfg.access === false) { navigate("/access-restricted"); return; }
    const m = (rawDealerSlug||"").match(/^(.*?)-([a-z0-9]{6})$/);
    const urlCode = m ? m[2] : "";
    if ((cfg.code||"").length === 6 && urlCode !== cfg.code) {
      navigate("/access-restricted");
      return;
    }
  }, [cfg, rawDealerSlug, navigate]);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        orders={orders}
        selectedDealer="locked"
        onDealerSelect={() => {}}
        hideOtherDealers={true}
        currentDealerName={dealerDisplayName}
        showStats={false}
      />
      
      <main className="flex-1 flex flex-col bg-slate-50">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                {dealerDisplayName} Dashboard
              </h1>
              <p className="text-slate-600 mt-1">
                Business Intelligence & Analytics
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {powerbiUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                >
                  <a
                    href={powerbiUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open in New Tab
                  </a>
                </Button>
              )}
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 p-6">
          {powerbiUrl ? (
            <Card className="h-full">
              <CardContent className="p-0 h-full">
                <iframe
                  src={powerbiUrl}
                  className="w-full h-full min-h-[600px] border-0 rounded-lg"
                  title={`${dealerDisplayName} PowerBI Dashboard`}
                  allowFullScreen
                  style={{
                    border: 'none',
                    borderRadius: '8px'
                  }}
                />
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full flex items-center justify-center">
              <CardContent className="text-center py-16">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Settings className="w-8 h-8 text-slate-400" />
                </div>
                <CardTitle className="text-xl text-slate-700 mb-2">
                  PowerBI Dashboard Not Configured
                </CardTitle>
                <p className="text-slate-500 mb-6 max-w-md">
                  The PowerBI dashboard for {dealerDisplayName} has not been configured yet. 
                  Please contact the administrator to set up your dashboard.
                </p>
                <p className="text-sm text-slate-400">
                  Dashboard configuration is managed through the Admin panel.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
