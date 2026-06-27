import { cn } from "@/lib/utils";

/**
 * Shared layout primitives that every route should use to guarantee
 * consistent responsive behaviour across the app.
 *
 * PageShell  – outermost wrapper. Forces width:100%, min-width:0 and
 *              overflow-x:hidden so no descendant can push the viewport.
 * PageContainer – inner content container. Centers content, caps width,
 *              and applies uniform horizontal padding on every breakpoint.
 *
 * Rules (do not override per-page):
 *   - width: 100%
 *   - max-width: 100%  (PageShell) / max-w-3xl (PageContainer)
 *   - min-width: 0     (lets flex/grid children shrink instead of overflow)
 *   - overflow-x: hidden
 *   - box-sizing: border-box  (inherited from globals)
 *   - padding-inline: 20px mobile / 24px tablet / 40px desktop
 */
export function PageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("w-full min-w-0 max-w-full overflow-x-hidden", className)}>
      {children}
    </div>
  );
}

export function PageContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full min-w-0 max-w-3xl px-5 py-5 sm:px-6 md:px-10",
        className,
      )}
    >
      {children}
    </div>
  );
}
