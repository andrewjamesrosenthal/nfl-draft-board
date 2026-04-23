import { BoardList } from "@/components/board-list";

export default function BoardPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight">
          Your personal <span className="gradient-text">big board</span>
        </h1>
        <p className="text-muted-foreground">
          Ranked by the paired-comparison engine. Filter by position, team needs, and class.
          Pin a manual rank to override the algorithm for any player.
        </p>
      </header>
      <BoardList
        mode="personal"
        title="Personal rankings"
        description="Sorted by your current Elo rating. Confidence reflects how much data has built up on each player."
      />
    </div>
  );
}
