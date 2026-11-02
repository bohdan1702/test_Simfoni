import { ExternalLink, Star } from "lucide-react";
import { Link } from "react-router-dom";
import type { Repository } from "../types";

interface RepositoryCardProps {
  repository: Repository;
}

export default function RepositoryCard({
  repository,
}: RepositoryCardProps) {
  const [owner, name] = repository.full_name.split("/");
  const detailPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;

  return (
    <article className="repository-card">
      <Link
        className="repository-card__overlay"
        to={detailPath}
        aria-label={`Open repository overview for ${repository.full_name}`}
      />
      <div className="repository-card__top">
        <div className="repository-avatar" aria-hidden="true">
          {repository.name.slice(0, 1).toUpperCase()}
        </div>
        <a
          className="repository-link"
          href={repository.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${repository.full_name} on GitHub`}
        >
          <ExternalLink size={17} />
        </a>
      </div>
      <p className="repository-owner">{repository.full_name.split("/")[0]}</p>
      <h3>
        {repository.name}
      </h3>
      <p className="repository-description">
        {repository.description || "No description provided."}
      </p>
      <div className="repository-meta">
        {repository.language ? (
          <span className="language-tag">
            <span className="language-dot" />
            {repository.language}
          </span>
        ) : (
          <span className="language-tag language-tag--muted">
            Language not specified
          </span>
        )}
        <span className="star-count">
          <Star size={15} />
          {repository.stars.toLocaleString("en-US")}
        </span>
      </div>
    </article>
  );
}
