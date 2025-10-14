// src/pages/Admin.tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Settings, ExternalLink, Save, Trash2, Copy, Link } from "lucide-react";
import { subscribeAllDealerConfigs, setDealerConfig } from "@/lib/firebase";

// 生成随机6位字符串
function generateRandomCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 将dealer名称转换为slug
function dealerNameToSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function Admin() {
  const [dealerConfigs, setDealerConfigs] = useState<Record<string, { access?: boolean; code?: string; powerbi_url?: string }>>({});
  const [dealerCodes, setDealerCodes] = useState<Record<string, string>>({});
  const [newDealer, setNewDealer] = useState("");
  const [powerbiConfigs, setPowerbiConfigs] = useState<Record<string, string>>({});
  const [selectedDealer, setSelectedDealer] = useState("");
  const [powerbiUrl, setPowerbiUrl] = useState("");

  // Load data from localStorage
  useEffect(() => {
    // Load dealer access
    const savedAccess = localStorage.getItem("dealer-access");
    if (savedAccess) {
      try {
        setDealerAccess(JSON.parse(savedAccess));
      } catch (e) {
        console.error("Failed to parse dealer access:", e);
      }
    }

    // Load dealer codes
    const savedCodes = localStorage.getItem("dealer-codes");
    if (savedCodes) {
      try {
        setDealerCodes(JSON.parse(savedCodes));
      } catch (e) {
        console.error("Failed to parse dealer codes:", e);
      }
    }

    // Load PowerBI configs
    const configs: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("powerbi-url-")) {
        const dealerSlug = key.replace("powerbi-url-", "");
        configs[dealerSlug] = localStorage.getItem(key) || "";
      }
    }
    setPowerbiConfigs(configs);
  }, []);

  const saveDealerAccess = () => {
    localStorage.setItem("dealer-access", JSON.stringify(dealerAccess));
    localStorage.setItem("dealer-codes", JSON.stringify(dealerCodes));
    toast.success("Dealer access settings saved");
  };

  const addDealer = async () => {
    if (!newDealer.trim()) { toast.error("Please enter a dealer name"); return; }
    const slug = dealerNameToSlug(newDealer);
    const code = generateRandomCode();
    await setDealerConfig(slug, { access: true, code });
    setNewDealer("");
    toast.success(`Dealer "${newDealer}" added with code: ${code}`);
  };

  const toggleDealerAccess = (dealer: string) => {
    setDealerAccess(prev => ({ ...prev, [dealer]: !prev[dealer] }));
  };

  const regenerateCode = (dealer: string) => {
    const newCode = generateRandomCode();
    setDealerCodes(prev => ({ ...prev, [dealer]: newCode }));
    toast.success(`New code generated for ${dealer}: ${newCode}`);
  };

  const removeDealer = (dealer: string) => {
    setDealerAccess(prev => {
      const newAccess = { ...prev };
      delete newAccess[dealer];
      return newAccess;
    });
    
    setDealerCodes(prev => {
      const newCodes = { ...prev };
      delete newCodes[dealer];
      return newCodes;
    });
    
    // Also remove PowerBI config
    localStorage.removeItem(`powerbi-url-${dealer}`);
    setPowerbiConfigs(prev => {
      const newConfigs = { ...prev };
      delete newConfigs[dealer];
      return newConfigs;
    });
    
    toast.success("Dealer removed");
  };

  const copyDealerUrl = (dealer: string) => {
    const code = dealerCodes[dealer];
    if (!code) {
      toast.error("No code found for this dealer");
      return;
    }
    
    const url = `${window.location.origin}/dealer/${dealer}-${code}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Dealer URL copied to clipboard");
    }).catch(() => {
      toast.error("Failed to copy URL");
    });
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
      delete newConfigs[dealer];
      return newConfigs;
    });
    toast.success("PowerBI configuration removed");
  };

  const toggleAccess = async (slug: string, v: boolean) => { await setDealerConfig(slug, { access: v }); toast.success('Dealer access updated'); };

  const removeDealer = async (slug: string) => { await setDealerConfig(slug, null); toast.success('Dealer removed'); };

  const dealers = Object.keys(dealerConfigs);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Admin Panel</h1>
            <p className="text-slate-600 mt-1">Manage dealer access and PowerBI configurations</p>
          </div>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-500" />
            <span className="text-sm text-slate-500">System Administration</span>
          </div>
        </div>

        <Tabs defaultValue="dealers" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="dealers">Dealer Management</TabsTrigger>
            <TabsTrigger value="powerbi">PowerBI Configuration</TabsTrigger>
          </TabsList>

          {/* Dealer Management Tab */}
          <TabsContent value="dealers" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Add New Dealer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <Input
                    placeholder="Enter dealer name (e.g., Snowy Stock)"
                    value={newDealer}
                    onChange={(e) => setNewDealer(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && addDealer()}
                    className="flex-1"
                  />
                  <Button onClick={addDealer}>Add Dealer</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Dealer Access Control & URLs</CardTitle>
                  <Button onClick={saveDealerAccess} className="flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    Save Changes
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dealers.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">No dealers configured</p>
                  ) : (
                    dealers.map((dealer) => {
                      const code = dealerConfigs[dealer]?.code || "no-code";
                      const fullUrl = `${window.location.origin}/dealer/${dealer}-${code}`;
                      
                      return (
                        <div key={dealer} className="p-4 bg-slate-50 rounded-lg space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="font-medium text-lg">{dealer}</span>
                              <Badge variant={!!dealerConfigs[dealer]?.access ? "default" : "secondary"}>
                                {!!dealerConfigs[dealer]?.access ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => toggleDealerAccess(dealer)}
                              >
                                {!!dealerConfigs[dealer]?.access ? "Deactivate" : "Activate"}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => removeDealer(dealer)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Label className="text-sm font-medium">Access Code:</Label>
                              <code className="bg-white px-2 py-1 rounded text-sm font-mono">{code}</code>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => regenerateCode(dealer)}
                                className="text-xs"
                              >
                                Regenerate
                              </Button>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Label className="text-sm font-medium">Dealer URL:</Label>
                              <div className="flex-1 flex items-center gap-2">
                                <code className="bg-white px-2 py-1 rounded text-xs font-mono flex-1 truncate">
                                  {fullUrl}
                                </code>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => copyDealerUrl(dealer)}
                                  className="flex items-center gap-1"
                                >
                                  <Copy className="w-3 h-3" />
                                  Copy
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  asChild
                                >
                                  <a
                                    href={fullUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1"
                                  >
                                    <Link className="w-3 h-3" />
                                    Test
                                  </a>
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PowerBI Configuration Tab */}
          <TabsContent value="powerbi" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Configure PowerBI Dashboard</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="dealer-select">Select Dealer</Label>
                    <select
                      id="dealer-select"
                      className="w-full mt-1 p-2 border border-slate-300 rounded-md"
                      value={selectedDealer}
                      onChange={(e) => setSelectedDealer(e.target.value)}
                    >
                      <option value="">Choose a dealer...</option>
                      {dealers.filter(d => dealerAccess[d]).map((dealer) => (
                        <option key={dealer} value={dealer}>{dealer}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="powerbi-url">PowerBI Embed URL</Label>
                  <Textarea
                    id="powerbi-url"
                    placeholder="Enter PowerBI embed URL (e.g., https://app.powerbi.com/view?r=...)"
                    value={powerbiUrl}
                    onChange={(e) => setPowerbiUrl(e.target.value)}
                    className="mt-1"
                    rows={3}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Tip: Use PowerBI's "Embed" feature to get the correct URL. Make sure the dashboard is publicly accessible.
                  </p>
                </div>

                <Button onClick={savePowerbiConfig} className="flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  Save PowerBI Configuration
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Current PowerBI Configurations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.keys(powerbiConfigs).length === 0 ? (
                    <p className="text-slate-500 text-center py-8">No PowerBI configurations found</p>
                  ) : (
                    Object.entries(powerbiConfigs).map(([dealer, url]) => (
                      <div key={dealer} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{dealer}</div>
                          <div className="text-sm text-slate-500 truncate">{url}</div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                          >
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Test
                            </a>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removePowerbiConfig(dealer)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))
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
