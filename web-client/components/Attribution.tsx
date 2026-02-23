import Link from "next/link";
import type { Puzzle } from "@/lib/types";

interface AttributionProps {
  puzzle: Puzzle;
  className?: string;
}

export function Attribution({ puzzle, className = "" }: AttributionProps) {
  const { repo, file, commit } = puzzle;
  const repoUrl = `https://github.com/${repo.owner}/${repo.name}`;
  const fileUrl = `${repoUrl}/blob/${commit.sha}/${file.path}`;

  return (
    <div className={`rounded-lg border border-zinc-200 bg-zinc-50/50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400 ${className}`.trim()}>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Link
          href={repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-zinc-900 underline hover:no-underline dark:text-zinc-100"
        >
          {repo.owner}/{repo.name}
        </Link>
        <span aria-hidden>·</span>
        <Link
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:no-underline"
        >
          {file.path}
        </Link>
        <span aria-hidden>·</span>
        <span>{commit.branch}</span>
        {commit.sha !== commit.branch && (
          <>
            <span aria-hidden>·</span>
            <span className="font-mono text-xs">{commit.sha.slice(0, 7)}</span>
          </>
        )}
      </p>
      {repo.licenseUrl && (
        <p className="mt-1">
          <Link
            href={repo.licenseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs underline hover:no-underline"
          >
            License
          </Link>
        </p>
      )}
    </div>
  );
}
