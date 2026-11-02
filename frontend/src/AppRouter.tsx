import { useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import AppLayout, { type RateLimitState } from "./components/AppLayout";
import RepositoryPage from "./pages/RepositoryPage";
import SearchPage from "./pages/SearchPage";

export default function AppRouter() {
  const [searchRateLimit, setSearchRateLimit] = useState<RateLimitState>({
    remaining: null,
    limit: null,
  });
  const [coreRateLimit, setCoreRateLimit] = useState<RateLimitState>({
    remaining: null,
    limit: null,
  });

  return (
    <BrowserRouter>
      <Routes>
        <Route
          element={
            <AppLayout
              searchRateLimit={searchRateLimit}
              coreRateLimit={coreRateLimit}
              setSearchRateLimit={setSearchRateLimit}
              setCoreRateLimit={setCoreRateLimit}
            />
          }
        >
          <Route index element={<SearchPage />} />
          <Route path="repos/:owner/:name" element={<RepositoryPage />} />
          <Route path="*" element={<SearchPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
