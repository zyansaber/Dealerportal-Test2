// src/pages/Admin.tsx
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Settings, ExternalLink, Save, Trash2, Copy, Link } from "lucide-react";
import { subscribeAllDealerConfigs, setDealerConfig, type DealerConfig } from "@/lib/firebase";

function generateRandomCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}
function dealerNameToSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function Admin() {
  const [dealerConfigs, setDealerConfigs] = useState<Record<string, DealerConfig>>({});
  const [newDealer, setNewDealer] = useState("");
  const [selectedDealer, setSelectedDealer] = useState("");
  const [powerbiUrl, setPowerbiUrl] = useState("");

  useEffect(() => {
    const off = subscribeAllDealerConfigs((all) => setDealerConfigs(all));
    return () => off?.();
  }, []);

  const addDealer = async () => {
    if (!newDealer.trim()) {
      toast.error("Please enter a dealer name");
      return;
    }
    const slug = dealerNameToSlug(newDealer);
    const code = generateRandomCode();
    await setDealerConfig(slug, { access: true, code });
    setNewDealer("");
    toast.success(`Dealer "${newDealer}" added with code: ${code}`);
  };

  const removeDealer = async (slug: string) => {
    await setDealerConfig(slug, null);
    toast.success("Dealer removed");
  };

  const toggleAccess = async (slug: string, v: boolean) => {
    await setDealerConfig(slug, { access: v });
    toast.success("Dealer access updated");
  };

  const savePowerbiConfig = async () => {
    if (!selectedDealer) { toast.error("Please select a dealer"); return; }
    if (!powerbiUrl.trim()) { toast.error("Please enter a PowerBI URL"); return; }
    await setDealerConfig(selectedDealer, { powerbi_url: powerbiUrl.trim() });
    toast.success("PowerBI configuration saved");
    setPowerbiUrl("");
    setSelectedDealer("");
  };

  const removePowerbiConfig = async (dealer: string) => {
    await setDealerConfig(dealer, { powerbi_url: "" });
    toast.success("PowerBI configuration removed");
  };

  const copyDealerUrl = (dealer: string) => {
    const code = dealerConfigs[dealer]?.code || "";
    const url = code && code.length === 6
      ? `${window.location.origin}/dealer/${dealer}-${code}`
      : `${window.location.origin}/dealer/${dealer}`;
    navigator.clipboard.writeText(url)
      .then(() => toast.success("Dealer URL copied to clipboard"))
      .catch(() => toast.error("Failed to copy URL"));
  };

  const dealers = Object.keys(dealerConfigs).sort();

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Admin Panel</h1>
            <p className="text-slate-600 mt-1">Manage dealer access and PowerBI configurations</p>
          </div>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-500" />
          </div>
        </div>

        <Tabs defaultValue="manage" className="w-full">
          <TabsList>
            <TabsTrigger value="manage">Dealer Access</TabsTrigger>
            <TabsTrigger value="powerbi">PowerBI</TabsTrigger>
          </TabsList>

          <TabsContent value="manage" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Add Dealer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <Label>Dealer Name</Label>
                    <Input
                      placeholder="e.g. Frankston"
                      value={newDealer}
                      onChange={(e) => setNewDealer(e.target.value)}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={addDealer} className="w-full">Add</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Dealers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {dealers.length === 0 ? (
                  <p className="text-slate-500">No dealers yet.</p>
                ) : (
                  <div className="space-y-3">
                    {dealers.map((dealer) => {
                      const cfg = dealerConfigs[dealer] || {};
                      return (
                        <div key={dealer} className="flex items-center justify-between border rounded-lg p-3">
                          <div className="flex items-center gap-3">
                            <Badge variant={cfg.access ? "default" : "secondary"}>
                              {cfg.access ? "Enabled" : "Disabled"}
                            </Badge>
                            <div>
                              <div className="font-medium">{dealer}</div>
                              <div className="text-xs text-slate-500">
                                Code: {cfg.code || "no-code"}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => toggleAccess(dealer, !cfg.access)}>
                              {cfg.access ? "Disable" : "Enable"}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => copyDealerUrl(dealer)}>
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => removeDealer(dealer)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="powerbi" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Configure PowerBI Dashboard</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                  <div className="md:col-span-2">
                    <Label>Select Dealer</Label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white text-sm"
                      value={selectedDealer}
                      onChange={(e) => setSelectedDealer(e.target.value)}
                    >
                      <option value="">-- Select --</option>
                      {dealers.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <Label>PowerBI URL</Label>
                    <Input
                      placeholder="https://app.powerbi.com/..."
                      value={powerbiUrl}
                      onChange={(e) => setPowerbiUrl(e.target.value)}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={savePowerbiConfig} className="flex items-center gap-2 w-full">
                      <Save className="w-4 h-4" />
                      Save
                    </Button>
                  </div>
                </div>
            </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Current PowerBI Configurations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dealers.length === 0 ? (
                    <p className="text-slate-500">No data.</p>
                  ) : (
                    dealers.map((dealer) => {
                      const url = dealerConfigs[dealer]?.powerbi_url || "";
                      return (
                        <div key={dealer} className="flex items-center justify-between border rounded-lg p-3">
                          <div className="min-w-0">
                            <div className="font-medium">{dealer}</div>
                            <div className="text-xs text-slate-500 truncate max-w-[520px]">{url || "—"}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <a
                              href={url || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1"
                              onClick={(e) => { if (!url) e.preventDefault(); }}
                            >
                              <ExternalLink className="w-3 h-3" />
                              Test
                            </a>
                            <Button variant="outline" size="sm" onClick={() => removePowerbiConfig(dealer)} className="text-red-600 hover:text-red-700">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
