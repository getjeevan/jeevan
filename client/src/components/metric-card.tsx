import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  description?: string;
  variant?: "default" | "success" | "danger" | "warning";
  isLoading?: boolean;
}

const variantStyles = {
  default: {
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
  },
  success: {
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  danger: {
    iconBg: "bg-red-500/10",
    iconColor: "text-red-600 dark:text-red-400",
  },
  warning: {
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
};

export function MetricCard({ title, value, icon: Icon, description, variant = "default", isLoading }: MetricCardProps) {
  const styles = variantStyles[variant];
  const testId = title.toLowerCase().replace(/[^a-z0-9]/g, "-");

  return (
    <Card className="relative overflow-visible" data-testid={`card-metric-${testId}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground mb-1" data-testid={`text-metric-label-${testId}`}>{title}</p>
            {isLoading ? (
              <div className="h-9 w-20 bg-muted animate-pulse rounded" />
            ) : (
              <p className="text-3xl font-semibold font-mono tracking-tight" data-testid={`text-metric-value-${testId}`}>{value}</p>
            )}
            {description && (
              <p className="text-xs text-muted-foreground mt-1" data-testid={`text-metric-desc-${testId}`}>{description}</p>
            )}
          </div>
          <div className={cn("p-3 rounded-md", styles.iconBg)}>
            <Icon className={cn("h-5 w-5", styles.iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function MetricCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="h-4 w-24 bg-muted animate-pulse rounded mb-2" />
            <div className="h-9 w-16 bg-muted animate-pulse rounded" />
          </div>
          <div className="h-11 w-11 bg-muted animate-pulse rounded-md" />
        </div>
      </CardContent>
    </Card>
  );
}
