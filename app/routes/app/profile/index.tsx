import { A, useNavigate } from "@solidjs/router";
import { createMemo, createResource, For, Show } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { isUserVerified } from "~/lib/auth";
import { Avatar } from "~/components/Avatar";
import { DogImage } from "~/components/DogImage";
import { ProfileSettingsSection } from "~/components/ProfileSettingsSection";
import { dateStr, genderLabel, sizeLabel } from "../explore/helpers";

type ProfileData = {
  user: { id: string; name?: string; avatar?: string; area?: string; city?: string; neighborhood?: string; bio?: string; breeds_owned_before?: string };
  needs: Array<{ id?: string; dog?: string; notes?: string } & Record<string, unknown>>;
  capacities: Array<{ id?: string; dog_sizes?: string | string[]; dog_genders?: string; max_dogs?: number; notes?: string } & Record<string, unknown>>;
  dogs: Array<{ id?: string; name?: string; breed?: string; size?: string; gender?: string; age?: number; image?: string; notes?: string }>;
};

function needDateStr(n: { flexible_dates?: boolean; open_any_duration?: boolean; duration_specific?: string; start_date?: string; end_date?: string }) {
  return dateStr(n);
}

function capDateStr(c: { flexible_dates?: boolean; open_any_duration?: boolean; duration_specific?: string; start_date?: string; end_date?: string }) {
  return dateStr(c);
}

function capSizesStr(s: string | string[] | undefined): string {
  if (!s) return "—";
  const arr = Array.isArray(s) ? s : [s];
  if (arr.length >= 3) return "Alla storlekar";
  return arr.map((x) => sizeLabel[x] ?? x).join(", ");
}

export default function ProfileIndex() {
  const nav = useNavigate();
  const myId = () => pb.authStore.model?.id;

  const [profile] = createResource(
    myId,
    async (id) => {
      if (!id) return null;
      const res = await fetch(`/api/users/${id}/profile`);
      if (!res.ok) throw new Error("Kunde inte ladda profil");
      return res.json() as Promise<ProfileData>;
    }
  );

  const quickActions = createMemo(() => {
    const data = profile();
    if (!data) return [];
    const actions: { href: string; label: string; reason?: string }[] = [];
    const { user, dogs, needs, capacities } = data;

    if (!user?.avatar?.trim()) {
      actions.push({ href: "/app/profile/edit", label: "Lägg till profilbild", reason: "Profiler med bild får fler matchningar" });
    }
    if (!user?.bio?.trim()) {
      actions.push({ href: "/app/profile/edit", label: "Lägg till en bio", reason: "Användare med bio får mer matchningar" });
    }
    const profileIncomplete = !user?.name?.trim() || !user?.area?.trim();
    if (profileIncomplete) {
      const missing: string[] = [];
      if (!user?.name?.trim()) missing.push("namn");
      if (!user?.area?.trim()) missing.push("område");
      actions.push({ href: "/app/profile/edit", label: `Fyll i din profil (${missing.join(", ")})`, reason: "En komplett profil ökar chansen att matcha" });
    }
    if (dogs.length === 0) {
      actions.push({ href: "/app/dogs", label: "Lägg till dina hundar", reason: "Du behöver minst en hund för att matcha med andra" });
    } else {
      const dogsWithoutImage = dogs.filter((d) => !(d.image as string)?.trim());
      if (dogsWithoutImage.length > 0) {
        const names = dogsWithoutImage.map((d) => d.name || "Hund").join(", ");
        actions.push({ href: "/app/dogs", label: `Lägg till bild på ${names}`, reason: "Hundar med bild får fler matchningar" });
      }
      const dogsWithoutNotes = dogs.filter((d) => !(d.notes as string)?.trim());
      if (dogsWithoutNotes.length > 0) {
        const names = dogsWithoutNotes.map((d) => d.name || "Hund").join(", ");
        const reason =
          dogsWithoutNotes.length === 1
            ? `Din hund ${names} har inte några anteckningar`
            : `Dina hundar ${names} har inte några anteckningar`;
        actions.push({ href: "/app/dogs", label: "Lägg till anteckningar", reason });
      }
    }
    if (needs.length === 0) {
      actions.push({ href: "/app/needs", label: "Lägg till när du behöver hundpassning", reason: "Vi matchar dig med andra som kan passa din hund" });
    }
    if (capacities.length === 0) {
      actions.push({ href: "/app/capacity", label: "Lägg till när du kan passa hundar", reason: "Du behöver tillgänglighet för att matcha med andra" });
    }
    actions.push({ href: "/app/explore", label: "Utforska" });
    return actions;
  });

  if (!myId()) {
    nav("/login", { replace: true });
    return null;
  }

  const baseUrl = import.meta.env.VITE_POCKETBASE_URL || "http://127.0.0.1:8090";

  return (
    <div class="container">
      <div class="profile-page-header">
        <h1 class="profile-page-title">Min profil</h1>
        <A href={myId() ? `/users/${myId()}?from=profile` : "/app/profile"} class="profile-page-preview-link">
          Hur ser andra min profil
        </A>
      </div>

      <Show when={profile.loading}>
        <div class="loading">Laddar...</div>
      </Show>
      <Show when={profile.error}>
        <div class="card" style="color: #dc2626;">{profile.error?.message}</div>
      </Show>
      <Show when={profile()}>
        {(data) => {
          const u = data().user;
          const needs = data().needs;
          const capacities = data().capacities;
          const dogsList = data().dogs ?? [];

          return (
            <>
              {/* Snabbåtgärder - just under header */}
              <div class="profile-card card" style="margin-bottom: 1rem;">
                <h2 class="profile-card-title" style="margin-bottom: 1rem;">Snabbåtgärder</h2>
                <Show when={quickActions().length > 0}>
                  <ul class="quick-actions-list">
                    <For each={quickActions()}>
                      {(action) => (
                        <li>
                          <A href={action.href} class="quick-action-link">
                            <span class="quick-action-label">{action.label}</span>
                            {action.reason && <span class="quick-action-reason">{action.reason}</span>}
                          </A>
                        </li>
                      )}
                    </For>
                  </ul>
                </Show>
                <Show when={quickActions().length === 0}>
                  <p class="profile-card-muted">
                    Din profil är komplett. Nu är du redo för matchningar.
                    <Show when={isUserVerified()}>
                      {" "}
                      <A href={myId() ? `/users/${myId()}?from=profile` : "/app/profile"}>Se din profil</A>
                      {" · "}
                    </Show>
                    <A href="/app/explore">Utforska</A>.
                  </p>
                </Show>
              </div>

              <div class="profile-cards">
                {/* Min profil */}
                <div class="profile-card card" id="min-profil">
                  <div class="profile-card-header">
                    <h2 class="profile-card-title">Min profil</h2>
                    <A href="/app/profile/edit" class="profile-card-edit-btn" aria-label="Redigera profil">
                      Redigera
                    </A>
                  </div>
                  <div class="profile-card-content profile-card-profile">
                    <Avatar
                      name={u.name}
                      city={u.city}
                      neighborhood={u.neighborhood}
                      id={u.id}
                      avatar={u.avatar}
                      baseUrl={baseUrl}
                    />
                    <div class="profile-card-profile-info">
                      <p class="profile-card-name">{u.name || "—"}</p>
                      {u.area && <p class="profile-card-area">{u.area}</p>}
                      {u.bio && (
                        <p class="profile-card-bio">
                          {u.bio.length > 100 ? u.bio.slice(0, 97) + "..." : u.bio}
                        </p>
                      )}
                      {!u.bio && <p class="profile-card-muted">Ingen bio ännu.</p>}
                    </div>
                  </div>
                </div>

                {/* Mina hundar */}
                <div class="profile-card card">
                  <div class="profile-card-header">
                    <h2 class="profile-card-title">Mina hundar</h2>
                    <A href="/app/dogs" class="profile-card-edit-btn" aria-label="Redigera hundar">
                      Redigera
                    </A>
                  </div>
                  <div class="profile-card-content">
                    <Show when={dogsList.length === 0}>
                      <p class="profile-card-muted">Inga hundar ännu. Lägg till för att komma igång.</p>
                    </Show>
                    <Show when={dogsList.length > 0}>
                      <div class="profile-card-dogs-list">
                        <For each={dogsList}>
                          {(dog) => (
                            <div class="profile-card-dog-item">
                              <DogImage dog={dog} baseUrl={baseUrl} class="profile-card-dog-img" />
                              <div>
                                <p class="profile-card-dog-name">{dog.name || "Hund"}</p>
                                <p class="profile-card-dog-meta">
                                  {dog.breed || "—"} • {dog.size ? sizeLabel[dog.size] ?? dog.size : "—"} • {dog.gender ? genderLabel[dog.gender] ?? dog.gender : "—"}
                                </p>
                              </div>
                            </div>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                </div>

                {/* Mina behov */}
                <div class="profile-card card">
                  <div class="profile-card-header">
                    <h2 class="profile-card-title">Mina behov</h2>
                    <A href="/app/needs" class="profile-card-edit-btn" aria-label="Redigera behov">
                      Redigera
                    </A>
                  </div>
                  <div class="profile-card-content">
                    <Show when={needs.length === 0}>
                      <p class="profile-card-muted">Inga behov ännu. Lägg till när du behöver hundpassning.</p>
                    </Show>
                    <Show when={needs.length > 0}>
                      <div class="profile-card-list">
                        <For each={needs}>
                          {(need) => {
                            const dog = need.dog ? data().dogs.find((d) => d.id === need.dog) : undefined;
                            return (
                              <div class="profile-card-list-item">
                                <span class="profile-card-list-label">{dog?.name ?? "Hund"}:</span>{" "}
                                {needDateStr(need)}
                                {need.notes && <span class="profile-card-list-notes"> • {need.notes}</span>}
                              </div>
                            );
                          }}
                        </For>
                      </div>
                    </Show>
                  </div>
                </div>

                {/* Min tillgänglighet */}
                <div class="profile-card card">
                  <div class="profile-card-header">
                    <h2 class="profile-card-title">Min tillgänglighet</h2>
                    <A href="/app/capacity" class="profile-card-edit-btn" aria-label="Redigera tillgänglighet">
                      Redigera
                    </A>
                  </div>
                  <div class="profile-card-content">
                    <Show when={capacities.length === 0}>
                      <p class="profile-card-muted">Ingen kapacitet ännu. Lägg till när du kan passa hundar.</p>
                    </Show>
                    <Show when={capacities.length > 0}>
                      <div class="profile-card-list">
                        <For each={capacities}>
                          {(cap) => (
                            <div class="profile-card-list-item">
                              {capDateStr(cap)} • {capSizesStr(cap.dog_sizes)} • {genderLabel[cap.dog_genders as string] ?? cap.dog_genders ?? "—"} • max {cap.max_dogs ?? "—"} hundar
                              {cap.notes && <span class="profile-card-list-notes"> • {cap.notes}</span>}
                            </div>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                </div>
              </div>

              <ProfileSettingsSection />
            </>
          );
        }}
      </Show>
    </div>
  );
}
