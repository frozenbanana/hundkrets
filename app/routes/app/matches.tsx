import { Navigate } from "@solidjs/router";

/** Redirect legacy /app/matches to /app/explore */
export default function MatchesRedirect() {
  return <Navigate href="/app/explore" replace />;
}
