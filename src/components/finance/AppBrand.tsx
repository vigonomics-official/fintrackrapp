import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/app-info";

type BrandSize = "sm" | "md" | "lg";

const markSizes: Record<BrandSize, string> = {
  sm: "h-9 w-9 rounded-xl text-lg",
  md: "h-11 w-11 rounded-xl text-xl",
  lg: "h-14 w-14 rounded-2xl text-2xl",
};

const nameSizes: Record<BrandSize, string> = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
};

export function AppMark({
  size = "sm",
  className,
}: {
  size?: BrandSize;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center bg-gradient-primary font-display font-extrabold text-primary-foreground shadow-soft",
        markSizes[size],
        className,
      )}
    >
      ₹
    </span>
  );
}

export function AppBrand({
  size = "sm",
  className,
}: {
  size?: BrandSize;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-display font-bold", nameSizes[size], className)}>
      <AppMark size={size} />
      <span>{APP_NAME}</span>
    </span>
  );
}