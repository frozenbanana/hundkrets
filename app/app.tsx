import { Route, Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { MetaProvider } from "@solidjs/meta";
import { ErrorBoundary, Suspense, onMount } from "solid-js";
import { refreshAuth } from "~/lib/authStore";
import { ToastContainer } from "~/components/Toast";
import ExcursionDetailPage from "~/pages/ExcursionDetailPage";
import "./app.css";

function AuthRefresh() {
  onMount(() => {
    refreshAuth().catch(() => {});
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
            <Suspense fallback={<div class="loading">Laddar Hundkrets…</div>}>
              <AuthRefresh />
              {props.children}
              <ToastContainer />
            </Suspense>
          )}
        >
          <Route path="/app/excursions/:id" component={ExcursionDetailPage} />
          <FileRoutes />
        </Router>
      </MetaProvider>
    </ErrorBoundary>
  );
}
