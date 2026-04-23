import { BoardList } from "@/components/board-list";

export default function CommunityPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight">
          Community <span className="gradient-text">consensus</span> board
        </h1>
        <p className="text-muted-foreground">
          Aggregated Elo ratings across every user's comparisons. Filter by class, position, or team needs.
        </p>
      </header>
      <BoardList
        mode="community"
        title="Community rankings"
        description="Live consensus big board. Updates as the community votes."
      />
    </div>
  );
}
