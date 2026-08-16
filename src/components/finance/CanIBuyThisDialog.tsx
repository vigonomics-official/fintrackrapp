import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ShoppingBag } from "lucide-react";
import { PurchaseCheckPanel } from "@/components/finance/PurchaseCheckPanel";

export function CanIBuyThisDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <ShoppingBag className="h-5 w-5 text-primary" /> Can I buy this?
          </DialogTitle>
          <DialogDescription>A quick, data-backed check before you spend.</DialogDescription>
        </DialogHeader>
        <PurchaseCheckPanel compact />
      </DialogContent>
    </Dialog>
  );
}
