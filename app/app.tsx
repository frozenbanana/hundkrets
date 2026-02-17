import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { ErrorBoundary, Suspense } from "solid-js";
import "./app.css";

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
      <Router
        root={(props) => (
          <Suspense fallback={<div class="loading">Laddar Hundkrets…</div>}>
            {props.children}
          </Suspense>
        )}
      >
        <FileRoutes />
      </Router>
    </ErrorBoundary>
  );
}
