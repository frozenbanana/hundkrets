import { Route, Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { MetaProvider } from "@solidjs/meta";
import { ErrorBoundary, Suspense, createEffect, onMount } from "solid-js";
import { useLocation } from "@solidjs/router";
import { refreshAuth } from "~/lib/authStore";
import { ToastContainer } from "~/components/Toast";
import ExcursionsPage from "./routes/app/excursions/index";
import ExcursionDetailPage from "~/pages/ExcursionDetailPage";
import ExcursionInterestListPage from "~/pages/ExcursionInterestListPage";
import "./app.css";

function AuthRefresh() {
  onMount(() => {
    refreshAuth().catch(() => {});
  });
  return null;
}

function UmamiTracker() {
  const location = useLocation();
  createEffect(() => {
    const path = location.pathname;
    const umami = (window as unknown as { umami?: { track: (url?: string) => void } }).umami;
    if (umami?.track) {
      umami.track(path);
    }
  });
  return null;
}

export default function App() {
  return (
    <ErrorBoundary
      fallback={(err, reset) => (
        <div class="container" style="padding: 2rem;">
          <h1>Något gick fel</h1>
          <p style="color: #dc2626;">{err?.message ?? String(err)}</p>
          <button type="button" class="btn" onClick={reset}>Försök igen</button>
          <a href="/" class="btn btn-secondary" style="margin-left: 0.5rem;">Till Hundkrets</a>
        </div>
      )}
    >
      <MetaProvider>
        <Router
          root={(props) => (
            <Suspense
              fallback={
                <div class="loading loading-brand" role="status" aria-live="polite">
                  <img src="/logo-icon.png" alt="" class="loading-brand-logo" width="64" height="64" />
                  <p class="loading-brand-text">Laddar Hundkrets…</p>
                </div>
              }
            >
              <AuthRefresh />
              <UmamiTracker />
              {props.children}
              <ToastContainer />
            </Suspense>
          )}
        >
          <Route path="/app/excursions" component={ExcursionsPage} />
          <Route path="/app/excursions/:id/intresserade" component={ExcursionInterestListPage} />
          <Route path="/app/excursions/:id" component={ExcursionDetailPage} />
          <FileRoutes />
        </Router>
      </MetaProvider>
    </ErrorBoundary>
  );
}
