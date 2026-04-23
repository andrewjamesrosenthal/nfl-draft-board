import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Historical classes — coming soon" };

export default function HistoricalPage() {
  return (
    <ComingSoon
      title="Historical classes, coming soon"
      description="Redraft mode, pre-draft vs actual comparisons, and biggest-steals views are being rebuilt. For now, you can still pit current prospects against drafted players in the arena."
      next={[
        { href: "/compare",   label: "Historical vs current" },
        { href: "/community", label: "Community board" },
        { href: "/board",     label: "Your big board" },
      ]}
    />
  );
}
