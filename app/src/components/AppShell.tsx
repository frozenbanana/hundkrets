import { A, useNavigate } from "@solidjs/router";
import { onMount } from "solid-js";
import { pb } from "~/lib/pocketbase";

export function AppShell(props: { children: import("solid-js").JSX.Element }) {
  const nav = useNavigate();

  onMount(() => {
    if (!pb.authStore.isValid) {
      nav("/login", { replace: true });
    }
  });

  function logout() {
    pb.authStore.clear();
    nav("/", { replace: true });
  }

  return (
    <div>
      <nav>
        <A href="/app">Dashboard</A>
        <A href="/app/profile">Profile</A>
        <A href="/app/dogs">My Dogs</A>
        <A href="/app/needs/new">Add Watch Need</A>
        <A href="/app/capacity/new">Add Watch Capacity</A>
        <A href="/app/matches">Matches</A>
        <button type="button" class="btn btn-secondary" onClick={logout} style="margin-left: auto;">
          Log out
        </button>
      </nav>
      {props.children}
    </div>
  );
}
