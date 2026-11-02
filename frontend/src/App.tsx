import { useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  ChartNoAxesCombined,
  Code2,
  Command,
  Github,
  LoaderCircle,
  Search,
  Sparkles,
} from "lucide-react";
import RepositoryCard from "./components/RepositoryCard";
import { searchRepositories } from "./services/repositories";
import type { SearchResponse } from "./types";

export default function App() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<SearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setError("Введіть щонайменше 2 символи для пошуку.");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const result = await searchRepositories(trimmedQuery);
      setData(result);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Сталася неочікувана помилка. Спробуйте ще раз.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  function searchExample(example: string) {
    setQuery(example);
    setError("");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="RepoScope — на головну">
          <span className="brand-mark">
            <Code2 size={21} strokeWidth={2.5} />
          </span>
          <span>repo<span className="brand-accent">scope</span></span>
        </a>

        <div className="sidebar-section-label">РОБОЧИЙ ПРОСТІР</div>
        <nav className="sidebar-nav" aria-label="Основна навігація">
          <a className="nav-item nav-item--active" href="#explore">
            <Search size={18} />
            <span>Пошук репозиторіїв</span>
          </a>
          <span className="nav-item nav-item--disabled" aria-disabled="true">
            <ChartNoAxesCombined size={18} />
            <span>Метрики</span>
            <span className="soon-badge">згодом</span>
          </span>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-note-icon">
            <Sparkles size={17} />
          </div>
          <p>Огляд репозиторіїв GitHub</p>
          <span>Метрики та аналітика з’являться тут наступними.</span>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="github-link"
          >
            <Github size={15} />
            GitHub
            <ArrowUpRight size={13} />
          </a>
        </div>
      </aside>

      <main className="main-content" id="explore">
        <header className="topbar">
          <div className="breadcrumb">
            Робочий простір <span>/</span> <strong>Дослідження</strong>
          </div>
          <div className="topbar-status">
            <span className="status-dot" />
            GitHub API
            <span className="topbar-divider" />
            <span className="shortcut">
              <Command size={13} /> API
            </span>
          </div>
        </header>

        <section className="content-wrap">
          <div className="page-heading">
            <div className="eyebrow"><span /> REPOSITORY EXPLORER</div>
            <h1>Знайдіть свій наступний<br className="desktop-break" /> цікавий репозиторій.</h1>
            <p className="page-subtitle">
              Досліджуйте open-source проєкти GitHub. Метрики та глибша аналітика — попереду.
            </p>
          </div>

          <form className="search-panel" onSubmit={handleSearch}>
            <div className="search-field">
              <Search size={21} className="search-field-icon" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Наприклад, python, react або machine learning..."
                aria-label="Пошуковий запит"
                minLength={2}
                maxLength={256}
              />
              <span className="search-hint">GitHub</span>
            </div>
            <button type="submit" disabled={isLoading}>
              {isLoading ? (
                <LoaderCircle size={17} className="spin" />
              ) : (
                <Search size={17} />
              )}
              <span>{isLoading ? "Шукаємо" : "Шукати"}</span>
            </button>
          </form>

          <div className="suggestion-row">
            <span>Спробуйте:</span>
            {["python", "react", "machine learning"].map((example) => (
              <button
                type="button"
                className="suggestion-chip"
                key={example}
                onClick={() => searchExample(example)}
              >
                {example}
              </button>
            ))}
          </div>

          {error && (
            <div className="error-banner" role="alert">
              <span className="error-icon">!</span>
              <span>{error}</span>
            </div>
          )}

          {isLoading && (
            <div className="loading-state" role="status">
              <LoaderCircle size={24} className="spin" />
              <span>Шукаємо репозиторії на GitHub...</span>
            </div>
          )}

          {!isLoading && data && (
            <section className="results-section" aria-live="polite">
              <div className="results-heading">
                <div>
                  <div className="section-kicker">РЕЗУЛЬТАТИ ПОШУКУ</div>
                  <h2>Репозиторії за запитом «{data.query}»</h2>
                </div>
                <span className="result-count">
                  {data.total_count.toLocaleString("uk-UA")} знайдено
                </span>
              </div>
              {data.results.length > 0 ? (
                <div className="repository-grid">
                  {data.results.map((repository) => (
                    <RepositoryCard
                      repository={repository}
                      key={repository.id}
                    />
                  ))}
                </div>
              ) : (
                <div className="empty-results">
                  <Search size={22} />
                  <h3>Нічого не знайдено</h3>
                  <p>Спробуйте інші ключові слова або змініть запит.</p>
                </div>
              )}
            </section>
          )}

          {!isLoading && !data && !error && (
            <section className="welcome-panel">
              <div className="welcome-art" aria-hidden="true">
                <div className="art-orbit art-orbit--one" />
                <div className="art-orbit art-orbit--two" />
                <div className="art-core"><Code2 size={32} /></div>
                <div className="art-spark art-spark--one">✳</div>
                <div className="art-spark art-spark--two">✦</div>
              </div>
              <div className="welcome-copy">
                <span className="section-kicker">ПОЧНІТЬ ДОСЛІДЖЕННЯ</span>
                <h2>Ідеї починаються з пошуку.</h2>
                <p>
                  Введіть тему або технологію — покажемо популярні репозиторії,
                  мови програмування та кількість зірок.
                </p>
              </div>
              <div className="welcome-arrow"><ArrowUpRight size={19} /></div>
            </section>
          )}
        </section>

        <footer className="page-footer">
          <span>RepoScope <span className="footer-dot">·</span> GitHub Repository Explorer</span>
          <span>Створено для дослідження open-source</span>
        </footer>
      </main>
    </div>
  );
}
