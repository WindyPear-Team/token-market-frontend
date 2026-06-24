import { useLocation } from "react-router-dom"
import { PageComponentSlots } from "@/components/layout/PageComponentSlots"
import { pageKeyFromPathname } from "@/lib/page-layouts"
import type { PageSlotKey } from "@/lib/page-layouts"

export function PageTitleSlot() {
  return <PageInlineSlot slotKey="before" />
}

export function PageInlineSlot({ className, slotKey }: { className?: string; slotKey: PageSlotKey }) {
  const location = useLocation()
  return <PageComponentSlots className={className} pageKey={pageKeyFromPathname(location.pathname)} slotKey={slotKey} />
}
