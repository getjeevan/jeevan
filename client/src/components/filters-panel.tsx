import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X, Filter } from "lucide-react";
import type { Firewall, TunnelState } from "@shared/schema";

interface FiltersPanelProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedFirewall: string;
  onFirewallChange: (value: string) => void;
  selectedStatus: string;
  onStatusChange: (value: string) => void;
  firewalls: Firewall[];
  activeFiltersCount: number;
  onClearFilters: () => void;
}

const statusOptions = [
  { value: "all", label: "All Status" },
  { value: "up", label: "Up" },
  { value: "down", label: "Down" },
  { value: "flapping", label: "Flapping" },
];

export function FiltersPanel({
  searchQuery,
  onSearchChange,
  selectedFirewall,
  onFirewallChange,
  selectedStatus,
  onStatusChange,
  firewalls,
  activeFiltersCount,
  onClearFilters,
}: FiltersPanelProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search tunnels..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
          data-testid="input-search-tunnels"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => onSearchChange("")}
            data-testid="button-clear-search"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <Select value={selectedFirewall} onValueChange={onFirewallChange}>
        <SelectTrigger className="w-[180px]" data-testid="select-firewall">
          <SelectValue placeholder="All Firewalls" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Firewalls</SelectItem>
          {firewalls.map((fw) => (
            <SelectItem key={fw.id} value={fw.id}>
              {fw.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={selectedStatus} onValueChange={onStatusChange}>
        <SelectTrigger className="w-[140px]" data-testid="select-status">
          <SelectValue placeholder="All Status" />
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {activeFiltersCount > 0 && (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onClearFilters}
          className="text-muted-foreground"
          data-testid="button-clear-filters"
        >
          <X className="h-3.5 w-3.5 mr-1.5" />
          Clear filters
          <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 px-1.5">
            {activeFiltersCount}
          </Badge>
        </Button>
      )}
    </div>
  );
}
