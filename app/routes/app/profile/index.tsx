import { A, useNavigate } from "@solidjs/router";
import { createEffect, createMemo, createResource, createSignal, For, onMount, Show } from "solid-js";
import confetti from "canvas-confetti";
import { pb } from "~/lib/pocketbase";
import { Avatar } from "~/components/Avatar";
import { DogImage } from "~/components/DogImage";
import { ProfileSettingsSection } from "~/components/ProfileSettingsSection";
import { dateStr, genderLabel, sizeLabel } from "../explore/helpers";

type TodoItem = {
  id: string;
  label: string;
  href: string;
  completed: boolean;
};

const DISMISS_STORAGE_KEY = "profile-quick-actions-dismissed";

type ProfileData = {
  user: { id: string; name?: string; avatar?: string; area?: string; city?: string; neighborhood?: string; bio?: string; breeds_owned_before?: string; user_type?: "has_dogs" | "sitter_only" | "receiver_only" };
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

function maxDogsStr(n: number | undefined): string {
  if (n == null) return "—";
  return n === 1 ? "1 hund" : `${n} hundar`;
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

  const userTypeInfo = createMemo(() => {
    const data = profile();
    if (!data) return { isSitterOnly: false, isReceiverOnly: false };
    const { user, dogs, needs, capacities } = data;
    const userType = user?.user_type;
    const isSitterOnly = userType === "sitter_only" || (userType == null && dogs.length === 0);
    const isReceiverOnly =
      userType === "receiver_only" ||
      (userType == null && dogs.length > 0 && needs.length > 0 && capacities.length === 0);
    return { isSitterOnly, isReceiverOnly };
  });

  const profileTodos = createMemo(() => {
    const data = profile();
    if (!data) return [];
    const todos: TodoItem[] = [];
    const { user, dogs, needs, capacities } = data;
    const { isSitterOnly, isReceiverOnly } = userTypeInfo();

    const hasBio = !!user?.bio?.trim();
    todos.push({ id: "bio", label: "Fyll i din bio", href: "/app/profile/edit", completed: hasBio });

    const hasAvatar = !!user?.avatar?.trim();
    todos.push({ id: "avatar", label: "Lägg till en profilbild", href: "/app/profile/edit", completed: hasAvatar });

    if (!isSitterOnly) {
      const dogsWithoutNotes = dogs.filter((d) => !(d.notes as string)?.trim());
      const hasDogNotes = dogs.length > 0 && dogsWithoutNotes.length === 0;
      if (dogs.length > 0) {
        const dogNotesLabel =
          dogsWithoutNotes.length === 1
            ? `Lägg till anteckning om ${dogsWithoutNotes[0].name || "din hund"}`
            : dogsWithoutNotes.length > 1
              ? "Lägg till anteckningar om dina hundar"
              : "Lägg till en anteckning om din hund";
        todos.push({ id: "dog-notes", label: dogNotesLabel, href: "/app/dogs", completed: hasDogNotes });
      }

      const hasDogs = dogs.length > 0;
      todos.push({ id: "dogs", label: "Lägg till dina hundar", href: "/app/dogs", completed: hasDogs });

      const dogsWithoutImage = dogs.filter((d) => !(d.image as string)?.trim());
      const hasDogImages = dogs.length === 0 || dogsWithoutImage.length === 0;
      if (dogs.length > 0) {
        const dogImagesLabel =
          dogsWithoutImage.length > 0
            ? `Lägg till bild på ${dogsWithoutImage.map((d) => d.name || "Hund").join(", ")}`
            : "Lägg till bild på dina hundar";
        todos.push({ id: "dog-images", label: dogImagesLabel, href: "/app/dogs", completed: hasDogImages });
      }

      const hasNeeds = needs.length > 0;
      todos.push({ id: "needs", label: "Lägg till när du behöver hundpassning", href: "/app/needs", completed: hasNeeds });
    }

    if (!isReceiverOnly) {
      const hasCapacities = capacities.length > 0;
      todos.push({ id: "capacities", label: "Lägg till när du kan passa hundar", href: "/app/capacity", completed: hasCapacities });
    }

    const hasNameAndArea = !!user?.name?.trim() && !!user?.area?.trim();
    const missing: string[] = [];
    if (!user?.name?.trim()) missing.push("namn");
    if (!user?.area?.trim()) missing.push("område");
    const profileLabel = missing.length > 0 ? `Fyll i din profil (${missing.join(", ")})` : "Fyll i namn och område";
    todos.push({ id: "profile", label: profileLabel, href: "/app/profile/edit", completed: hasNameAndArea });

    return todos;
  });

  const allComplete = createMemo(() => {
    const todos = profileTodos();
    return todos.length > 0 && todos.every((t) => t.completed);
  });

  const [dismissed, setDismissed] = createSignal(false);
  const [hasCelebrated, setHasCelebrated] = createSignal(false);

  onMount(() => {
    const id = myId();
    if (id && typeof localStorage !== "undefined") {
      const key = `${DISMISS_STORAGE_KEY}-${id}`;
      setDismissed(localStorage.getItem(key) === "true");
    }
  });

  createEffect(() => {
    if (!allComplete() || hasCelebrated()) return;
    const id = myId();
    if (id && typeof localStorage !== "undefined" && localStorage.getItem(`${DISMISS_STORAGE_KEY}-${id}`) === "true") return;
    setHasCelebrated(true);
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
  });

  function handleDismiss() {
    const id = myId();
    if (id && typeof localStorage !== "undefined") {
      localStorage.setItem(`${DISMISS_STORAGE_KEY}-${id}`, "true");
      setDismissed(true);
    }
  }

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
              {/* Snabbåtgärder - dismissable when complete */}
              <Show when={!dismissed()}>
                <div class="profile-card card quick-actions-card" style="margin-bottom: 1rem;">
                  <div class="quick-actions-header">
                    <h2 class="profile-card-title">Snabbåtgärder</h2>
                    <Show when={allComplete()}>
                      <button
                        type="button"
                        class="quick-actions-dismiss-btn"
                        onClick={handleDismiss}
                        aria-label="Stäng"
                        title="Stäng"
                      >
                        ✕
                      </button>
                    </Show>
                  </div>
                  <p class="quick-actions-motivation">Användare med komplett profil får bättre matchningar</p>
                  <Show when={!allComplete()}>
                    <ul class="quick-actions-checklist">
                      <For each={profileTodos()}>
                        {(item) => (
                          <li class="quick-actions-checklist-item" classList={{ "is-completed": item.completed }}>
                            {item.completed ? (
                              <span class="quick-actions-checklist-label">
                                <span class="quick-actions-checkbox" aria-hidden="true">✓</span>
                                <span class="quick-actions-label-text">{item.label}</span>
                              </span>
                            ) : (
                              <A href={item.href} class="quick-actions-checklist-link">
                                <span class="quick-actions-checkbox" aria-hidden="true"> </span>
                                <span class="quick-actions-label-text">{item.label}</span>
                              </A>
                            )}
                          </li>
                        )}
                      </For>
                    </ul>
                  </Show>
                  <Show when={allComplete()}>
                    <p class="quick-actions-complete-message">
                      Din profil är komplett! Nu är det bara att tuta och köra!
                    </p>
                    <p class="quick-actions-complete-links">
                      <A href={myId() ? `/users/${myId()}?from=profile` : "/app/profile"}>Se din profil</A>
                      {" · "}
                      <A href="/app/explore">Utforska</A>
                    </p>
                  </Show>
                </div>
              </Show>

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
                    <Show when={!userTypeInfo().isSitterOnly}>
                      <A href="/app/dogs" class="profile-card-edit-btn" aria-label="Redigera hundar">
                        Redigera
                      </A>
                    </Show>
                    <Show when={userTypeInfo().isSitterOnly}>
                      <A href="/app/dogs/new" class="profile-card-edit-btn" aria-label="Lägg till hund">
                        Lägg till
                      </A>
                    </Show>
                  </div>
                  <div class="profile-card-content">
                    <Show when={userTypeInfo().isSitterOnly}>
                      <p class="profile-card-muted">
                        Du är registrerad som hundpassare. Vill du ändra på det så lägg till din egen hund.
                      </p>
                      <A href="/app/dogs/new" class="btn" style="margin-top: 0.75rem;">Lägg till hund</A>
                    </Show>
                    <Show when={!userTypeInfo().isSitterOnly && dogsList.length === 0}>
                      <p class="profile-card-muted">Inga hundar ännu. Lägg till för att komma igång.</p>
                      <A href="/app/dogs/new" class="btn" style="margin-top: 0.75rem;">Lägg till hund</A>
                    </Show>
                    <Show when={!userTypeInfo().isSitterOnly && dogsList.length > 0}>
                      <div class="profile-card-dogs-list">
                        <For each={dogsList}>
                          {(dog) => (
                            <div class="profile-card-dog-item">
                              <DogImage dog={dog} baseUrl={baseUrl} class="profile-card-dog-img" />
                              <div>
                                <p class="profile-card-dog-name">{dog.name || "Hund"}</p>
                                <p class="profile-card-dog-meta">
                                  {(dog.breed || "—") +
                                    ", " +
                                    (dog.age != null ? `${dog.age} årig ` : "") +
                                    (dog.gender ? genderLabel[dog.gender] ?? dog.gender : "—")}
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
                      <div class="profile-card-dogs-list">
                        <For each={needs}>
                          {(need) => {
                            // Handle dog as either single ID or array of IDs
                            const dogIds = Array.isArray(need.dog) ? need.dog : need.dog ? [need.dog] : [];
                            const needDogs = dogIds.map((id) => data().dogs.find((d) => d.id === id)).filter(Boolean) as ProfileData["dogs"];
                            const dogNames = needDogs.map((d) => d.name).join(", ") || "Hund";
                            const firstDog = needDogs[0] ?? { name: "Hund" };
                            return (
                              <div class="profile-card-dog-item">
                                <DogImage dog={firstDog} baseUrl={baseUrl} class="profile-card-dog-img" />
                                <div>
                                  <p class="profile-card-dog-name">{dogNames}</p>
                                  <p class="profile-card-dog-meta">
                                    {needDateStr(need)}
                                    {need.notes && <span class="profile-card-list-notes"> • {need.notes}</span>}
                                  </p>
                                </div>
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
                    <Show when={!userTypeInfo().isReceiverOnly}>
                      <A href="/app/capacity" class="profile-card-edit-btn" aria-label="Redigera tillgänglighet">
                        Redigera
                      </A>
                    </Show>
                    <Show when={userTypeInfo().isReceiverOnly}>
                      <A href="/app/capacity/new" class="profile-card-edit-btn" aria-label="Lägg till tillgänglighet">
                        Lägg till
                      </A>
                    </Show>
                  </div>
                  <div class="profile-card-content">
                    <Show when={userTypeInfo().isReceiverOnly}>
                      <p class="profile-card-muted">
                        Du är registrerad som endast behov av hundpassning. Vill du ändra på det så lägg till tillgänglighet för passning.
                      </p>
                      <A href="/app/capacity/new" class="btn" style="margin-top: 0.75rem;">Lägg till tillgänglighet</A>
                    </Show>
                    <Show when={!userTypeInfo().isReceiverOnly && capacities.length === 0}>
                      <p class="profile-card-muted">Ingen kapacitet ännu. Lägg till när du kan passa hundar.</p>
                      <A href="/app/capacity/new" class="btn" style="margin-top: 0.75rem;">Lägg till kapacitet</A>
                    </Show>
                    <Show when={!userTypeInfo().isReceiverOnly && capacities.length > 0}>
                      <div class="profile-card-list profile-card-capacity-list">
                        <For each={capacities}>
                          {(cap) => (
                            <div class="profile-card-capacity-item">
                              <div class="profile-card-capacity-row">
                                <span class="profile-card-capacity-label">När:</span>
                                <span>{capDateStr(cap)}</span>
                              </div>
                              <div class="profile-card-capacity-row">
                                <span class="profile-card-capacity-label">Storlekar:</span>
                                <span>{capSizesStr(cap.dog_sizes)}</span>
                              </div>
                              <div class="profile-card-capacity-row">
                                <span class="profile-card-capacity-label">Kön:</span>
                                <span>{genderLabel[cap.dog_genders as string] ?? cap.dog_genders ?? "—"}</span>
                              </div>
                              <div class="profile-card-capacity-row">
                                <span class="profile-card-capacity-label">Max antal:</span>
                                <span>{maxDogsStr(cap.max_dogs as number)}</span>
                              </div>
                              {cap.notes && (
                                <div class="profile-card-capacity-row">
                                  <span class="profile-card-capacity-label">Anteckning:</span>
                                  <span class="profile-card-list-notes">{cap.notes}</span>
                                </div>
                              )}
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
