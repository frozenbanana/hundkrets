import { A, useNavigate } from "@solidjs/router";
import { onMount } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { Avatar } from "~/components/Avatar";

export function AppShell(props: { children: import("solid-js").JSX.Element }) {
  const nav = useNavigate();
  const user = () => pb.authStore.model;

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
      <nav style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
        <A href="/app" style="display: flex; align-items: center; gap: 0.5rem; font-weight: 700; font-size: 1.1rem;">
          <img src="/logo-icon.png" alt="" width="28" height="28" style="border-radius: 6px;" />
          Hundkrets
        </A>
        <Avatar
          name={user()?.name}
          city={user()?.city}
          neighborhood={user()?.neighborhood}
          size="sm"
          class="avatar-sm"
        />
        <A href="/app">Översikt</A>
        <A href="/app/profile">Profil</A>
        <A href="/app/dogs">Mina hundar</A>
        <A href="/app/needs/new">Mina behov</A>
        <A href="/app/capacity/new">Min kapacitet</A>
        <A href="/app/matches">Matchningar</A>
        <button type="button" class="btn btn-secondary" onClick={logout} style="margin-left: auto;">
          Logga ut
        </button>
      </nav>
      {props.children}
    </div>
  );
}
