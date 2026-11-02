import { ExternalLink, Star } from "lucide-react";
import type { Repository } from "../types";

interface RepositoryCardProps {
  repository: Repository;
}

export default function RepositoryCard({
  repository,
}: RepositoryCardProps) {
  return (
    <article className="repository-card">
      <div className="repository-card__top">
        <div className="repository-avatar" aria-hidden="true">
          {repository.name.slice(0, 1).toUpperCase()}
        </div>
        <a
          className="repository-link"
          href={repository.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Відкрити ${repository.full_name} на GitHub`}
        >
          <ExternalLink size={17} />
        </a>
      </div>
      <p className="repository-owner">{repository.full_name.split("/")[0]}</p>
      <h3>
        <a href={repository.url} target="_blank" rel="noreferrer">
          {repository.name}
        </a>
      </h3>
      <p className="repository-description">
        {repository.description || "Автор не додав опис до репозиторію."}
      </p>
      <div className="repository-meta">
        {repository.language ? (
          <span className="language-tag">
            <span className="language-dot" />
            {repository.language}
          </span>
        ) : (
          <span className="language-tag language-tag--muted">
            Мову не вказано
          </span>
        )}
        <span className="star-count">
          <Star size={15} />
          {repository.stars.toLocaleString("uk-UA")}
        </span>
      </div>
    </article>
  );
}
