interface ArticleBodyProps {
  html: string;
  compact?: boolean;
  className?: string;
}

export default function ArticleBody({
  html,
  compact = false,
  className = "",
}: ArticleBodyProps) {
  return (
    <div
      className={`article-content ${compact ? "article-content-compact" : ""} ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
