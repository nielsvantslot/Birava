import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  emoji?: string;
  highlight?: boolean;
  sub?: string;
}

export function StatCard({ label, value, emoji, highlight, sub }: StatCardProps) {
  return (
    <Card className={cn(highlight && "border-[var(--primary)] bg-[var(--primary)]/5")}>
      <CardContent className="pt-4 pb-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
            {label}
          </span>
          <div className="flex items-baseline gap-1">
            {emoji && <span className="text-2xl">{emoji}</span>}
            <span
              className={cn(
                "text-3xl font-black",
                highlight ? "text-[var(--primary)]" : "text-[var(--foreground)]"
              )}
            >
              {value}
            </span>
          </div>
          {sub && (
            <span className="text-xs text-[var(--muted-foreground)]">{sub}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
