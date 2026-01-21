import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ConnectionStatus } from "@/components/status-badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { insertFirewallSchema, type Firewall, type InsertFirewall } from "@shared/schema";
import { Plus, Trash2, Server, Edit2, Eye, EyeOff, Clock } from "lucide-react";

interface FirewallSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  firewalls: Firewall[];
  onAddFirewall: (firewall: InsertFirewall) => Promise<void>;
  onUpdateFirewall: (id: string, firewall: Partial<InsertFirewall>) => Promise<void>;
  onDeleteFirewall: (id: string) => Promise<void>;
  isLoading?: boolean;
}

export function FirewallSettings({
  open,
  onOpenChange,
  firewalls,
  onAddFirewall,
  onUpdateFirewall,
  onDeleteFirewall,
  isLoading,
}: FirewallSettingsProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingFirewall, setEditingFirewall] = useState<Firewall | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAddFirewall = async (data: InsertFirewall) => {
    await onAddFirewall(data);
    setIsAddDialogOpen(false);
  };

  const handleUpdateFirewall = async (data: InsertFirewall) => {
    if (editingFirewall) {
      await onUpdateFirewall(editingFirewall.id, data);
      setEditingFirewall(null);
    }
  };

  const handleDeleteFirewall = async (id: string) => {
    setDeletingId(id);
    await onDeleteFirewall(id);
    setDeletingId(null);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Firewall Configuration
            </SheetTitle>
            <SheetDescription>
              Manage your Palo Alto firewall connections. Add API keys to start monitoring VPN tunnels.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Configured Firewalls</h3>
              <Button size="sm" onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-firewall">
                <Plus className="h-4 w-4 mr-1.5" />
                Add Firewall
              </Button>
            </div>

            {firewalls.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center">
                  <Server className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No firewalls configured yet. Add your first firewall to start monitoring VPN tunnels.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {firewalls.map((fw) => (
                  <Card key={fw.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium truncate">{fw.name}</h4>
                            <ConnectionStatus isConnected={fw.isConnected} />
                          </div>
                          <div className="text-sm text-muted-foreground space-y-0.5">
                            <p className="flex items-center gap-1.5">
                              <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                                {fw.mgmtIp}
                              </span>
                            </p>
                            <p className="flex items-center gap-1.5 text-xs">
                              <Badge variant="outline" className="text-[10px]">
                                PAN-OS {fw.panosVersion}
                              </Badge>
                              <Badge variant="outline" className="text-[10px] uppercase">
                                {fw.apiType} API
                              </Badge>
                            </p>
                            <p className="flex items-center gap-1 text-xs mt-1">
                              <Clock className="h-3 w-3" />
                              Polling every {fw.pollingInterval}s
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setEditingFirewall(fw)}
                            data-testid={`button-edit-firewall-${fw.id}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleDeleteFirewall(fw.id)}
                            disabled={deletingId === fw.id}
                            data-testid={`button-delete-firewall-${fw.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <FirewallFormDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSubmit={handleAddFirewall}
        title="Add Firewall"
        description="Connect to a new Palo Alto firewall to monitor its VPN tunnels."
      />

      <FirewallFormDialog
        open={!!editingFirewall}
        onOpenChange={(open) => !open && setEditingFirewall(null)}
        onSubmit={handleUpdateFirewall}
        initialData={editingFirewall ?? undefined}
        title="Edit Firewall"
        description="Update the firewall connection settings."
      />
    </>
  );
}

interface FirewallFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: InsertFirewall) => Promise<void>;
  initialData?: Firewall;
  title: string;
  description: string;
}

function FirewallFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  title,
  description,
}: FirewallFormDialogProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<InsertFirewall>({
    resolver: zodResolver(insertFirewallSchema),
    defaultValues: initialData ?? {
      name: "",
      mgmtIp: "",
      apiKey: "",
      panosVersion: "10.1",
      apiType: "xml",
      pollingInterval: 60,
    },
  });

  const handleSubmit = async (data: InsertFirewall) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
      form.reset();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Firewall Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., HQ-FW-01" {...field} data-testid="input-firewall-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="mgmtIp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Management IP / FQDN</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 10.0.0.1 or fw.example.com" {...field} data-testid="input-mgmt-ip" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="apiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Key</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        type={showApiKey ? "text" : "password"}
                        placeholder="Enter API key" 
                        {...field} 
                        data-testid="input-api-key"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </FormControl>
                  <FormDescription className="text-xs">
                    Generate from: Device → Administrators → API Key
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="panosVersion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PAN-OS Version</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 10.1" {...field} data-testid="input-panos-version" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="apiType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-api-type">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="xml">XML API</SelectItem>
                        <SelectItem value="rest">REST API</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="pollingInterval"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Polling Interval (seconds)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min={10} 
                      max={300} 
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 60)}
                      data-testid="input-polling-interval"
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    How often to check VPN status (10-300 seconds)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} data-testid="button-submit-firewall">
                {isSubmitting ? "Saving..." : initialData ? "Save Changes" : "Add Firewall"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
