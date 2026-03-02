import { A, useNavigate, useParams, useSearchParams } from "@solidjs/router";
import { Title, Meta } from "@solidjs/meta";
import {
  createResource,
  createSignal,
  For,
  Show,
} from "solid-js";
import { pb } from "~/lib/pocketbase";
import { isUserVerified } from "~/lib/auth";
import { Avatar } from "~/components/Avatar";
import { DogImage } from "~/components/DogImage";
import { InterestModal } from "../app/matches/InterestModal";
import { RespondModal } from "../app/matches/RespondModal";
import type { Conn } from "../app/matches/types";
import type { DogRecord } from "../app/matches/types";
import {
  dateStr,
  sizesStr,
  genderLabel,
  sizeLabel,
  temperamentLabel,
} from "../app/matches/helpers";
import { parseApiError } from "~/lib/errors";
import { showToast } from "~/lib/toast";
import { AppShell } from "~/components/AppShell";

type ProfileData = {
  user: { id: string; name?: string; avatar?: string; area?: string; city?: string; neighborhood?: string; bio?: string; breeds_owned_before?: string; verified?: boolean };
  needs: Array<Record<string, unknown> & { dog?: string; notes?: string }>;
  capacities: Array<Record<string, unknown> & { dog_sizes?: string | string[]; dog_genders?: string; max_dogs?: number; notes?: string }>;
  dogs: Array<Record<string, unknown> & { id?: string; name?: string; breed?: string; size?: string; gender?: string; age?: number; image?: string; notes?: string; temperament_new_people?: string; temperament_new_dogs_female?: string; temperament_new_dogs_male?: string }>;
};

const baseUrl = import.meta.env.VITE_POCKETBASE_URL || "http://127.0.0.1:8090";

export default function UserProfile() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const nav = useNavigate();
  const userId = () => params.id;

  const fromMatches = () =>
    searchParams.from === "matches" ||
    (typeof document !== "undefined" && document.referrer?.includes("/app/matches"));

  const fromChat = () => searchParams.from === "chat";
  const fromApp = () => searchParams.from === "app";
  const chatId = () => (searchParams as { chat?: string }).chat;
  const backToChatUrl = () => {
    const id = chatId();
    return id ? `/app/chats/${id}` : "/app/chats";
  };

  const [profile, { refetch }] = createResource(
    userId,
    async (id) => {
      const res = await fetch(`/api/users/${id}/profile`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Profilen hittades inte");
      }
      return res.json() as Promise<ProfileData>;
    }
  );

  const [connections, { refetch: refetchConnections }] = createResource(
    () => (pb.authStore.isValid ? pb.authStore.model?.id : null),
    async (myId) => {
      if (!myId) return [];
      try {
        const list = await pb.collection("connection_requests").getFullList({
          requestKey: "profile-connections",
        });
        return list as Conn[];
      } catch {
        return [];
      }
    }
  );

  const conns = () => connections() ?? [];
  const connFromThem = () =>
    conns().find((c) => c.from_user === userId() && c.to_user === pb.authStore.model?.id);
  const mutual = () => {
    const me = pb.authStore.model?.id;
    if (!me) return false;
    return (
      conns().some((x) => x.from_user === me && x.to_user === userId()) &&
      conns().some((x) => x.from_user === userId() && x.to_user === me)
    );
  };

  const isOwnProfile = () => pb.authStore.model?.id === userId();

  const [privateProfile] = createResource(
    () => (pb.authStore.isValid && (mutual() || isOwnProfile()) ? userId() : null),
    async (id) => {
      const u = await pb.collection("users").getOne(id);
      return u as { phone?: string; address_private?: string };
    }
  );

  const requested = () =>
    pb.authStore.model?.id &&
    conns().some((x) => x.from_user === pb.authStore.model?.id && x.to_user === userId());

  const [publicPreview, setPublicPreview] = createSignal(false);
  const showPrivateInfo = () =>
    (mutual() || (isOwnProfile() && !publicPreview())) && privateProfile();

  const [refreshing, setRefreshing] = createSignal(false);
  const [interestModalTarget, setInterestModalTarget] = createSignal<{ userId: string; userName?: string } | undefined>();
  const [interestModalMessage, setInterestModalMessage] = createSignal("");
  const [respondModalTarget, setRespondModalTarget] = createSignal<
    { requestId: string; fromUserId: string; fromUserName?: string } | undefined
  >();
  const [respondModalMessage, setRespondModalMessage] = createSignal("");

  async function handleInterested(toUserId: string, message?: string) {
    const fromUserId = pb.authStore.model?.id;
    if (!fromUserId) return;
    setRefreshing(true);
    try {
      await pb.collection("connection_requests").create({
        from_user: fromUserId,
        to_user: toUserId,
        ...(message?.trim() && { message: message.trim() }),
      });
      refetchConnections();
      setInterestModalTarget(undefined);
      showToast("Intresse skickat");
    } catch (e) {
      showToast(parseApiError(e), "error");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleWithdraw(toUserId: string) {
    const me = pb.authStore.model?.id;
    if (!me) return;
    const conn = conns().find((c) => c.from_user === me && c.to_user === toUserId);
    if (!conn?.id) return;
    setRefreshing(true);
    try {
      await pb.collection("connection_requests").delete(conn.id);
      refetchConnections();
      showToast("Intresse återtaget");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleUnmatch(otherUserId: string) {
    const me = pb.authStore.model?.id;
    if (!me) return;
    const connsToRemove = conns().filter(
      (c) =>
        (c.from_user === me && c.to_user === otherUserId) ||
        (c.from_user === otherUserId && c.to_user === me)
    );
    setRefreshing(true);
    try {
      for (const c of connsToRemove) {
        if (c.id) await pb.collection("connection_requests").delete(c.id);
      }
      refetchConnections();
      showToast("Avmatchad");
    } catch (e) {
      showToast(parseApiError(e), "error");
    } finally {
      setRefreshing(false);
    }
  }

  async function ensureConversation(otherUserId: string): Promise<string> {
    const myId = pb.authStore.model?.id;
    if (!myId) throw new Error("Inte inloggad");
    const userA = myId < otherUserId ? myId : otherUserId;
    const userB = myId < otherUserId ? otherUserId : myId;
    const key = `${userA}:${userB}`;
    try {
      const existing = await pb.collection("conversations").getFirstListItem(`pair_key = "${key}"`);
      return existing.id;
    } catch {}
    try {
      const existingByUsers = await pb.collection("conversations").getFirstListItem(
        `(user_a = "${myId}" && user_b = "${otherUserId}") || (user_a = "${otherUserId}" && user_b = "${myId}")`
      );
      return existingByUsers.id;
    } catch {}
    const created = await pb.collection("conversations").create({
      user_a: userA,
      user_b: userB,
      pair_key: key,
    });
    return created.id;
  }

  async function handleOpenChat(otherUserId: string) {
    try {
      const conversationId = await ensureConversation(otherUserId);
      nav(`/app/chats/${conversationId}?with=${otherUserId}`);
    } catch {
      showToast("Kunde inte öppna chatt just nu.", "error");
    }
  }

  function openInterestModal() {
    const u = profile()?.user;
    if (u) setInterestModalTarget({ userId: u.id, userName: u.name });
    setInterestModalMessage("");
  }

  function openRespondModal() {
    const conn = connFromThem();
    if (conn?.id) {
      setRespondModalTarget({
        requestId: conn.id,
        fromUserId: conn.from_user,
        fromUserName: profile()?.user?.name,
      });
      setRespondModalMessage("");
    }
  }

  async function handleAcceptWithReply() {
    const target = respondModalTarget();
    if (!target) return;
    setRefreshing(true);
    try {
      await pb.collection("connection_requests").create({
        from_user: pb.authStore.model!.id,
        to_user: target.fromUserId,
        ...(respondModalMessage().trim() && { message: respondModalMessage().trim() }),
      });
      setRespondModalTarget(undefined);
      refetchConnections();
      showToast("Matchad! Ni kan nu kontakta varandra.");
    } catch (e) {
      showToast(parseApiError(e), "error");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleRejectRequest() {
    const target = respondModalTarget();
    if (!target) return;
    setRefreshing(true);
    try {
      await pb.collection("connection_requests").delete(target.requestId);
      setRespondModalTarget(undefined);
      refetchConnections();
    } catch (e) {
      showToast(parseApiError(e), "error");
    } finally {
      setRefreshing(false);
    }
  }

  const profileUrl = () =>
    typeof window !== "undefined"
      ? window.location.origin + `/users/${userId()}`
      : "";

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${profile()?.user?.name || "Profil"} – Hundkrets`,
          text: `Kolla in denna profil på Hundkrets`,
          url: profileUrl(),
        });
        showToast("Delat!");
      } catch (err) {
        if ((err as Error).name !== "AbortError") showToast("Kunde inte dela", "error");
      }
    } else {
      await navigator.clipboard.writeText(profileUrl());
      showToast("Länk kopierad!");
    }
  }

  const facebookShareUrl = () =>
    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(profileUrl())}`;
  const twitterShareUrl = () =>
    `https://twitter.com/intent/tweet?url=${encodeURIComponent(profileUrl())}&text=${encodeURIComponent(`${profile()?.user?.name || "Profil"} – Hundkrets`)}`;

  const siteUrl = import.meta.env.VITE_SITE_URL || "https://hundkrets.se";
  const profileOgUrl = () => `${siteUrl}/users/${userId()}`;
  const profileOgTitle = () =>
    profile()?.user?.name ? `${profile()!.user.name} – Hundkrets` : "Profil – Hundkrets";
  const profileOgDescription = () => {
    const u = profile()?.user;
    if (!u) return "Hundkrets – byt hundpassning med grannar.";
    const parts: string[] = [];
    if (u.area) parts.push(u.area);
    if (u.bio) parts.push(u.bio.slice(0, 100) + (u.bio.length > 100 ? "…" : ""));
    return parts.length ? parts.join(" · ") : "Hundkrets – byt hundpassning med grannar.";
  };
  const profileOgImage = () => {
    const u = profile()?.user;
    if (u?.avatar && u?.id) return `${import.meta.env.VITE_POCKETBASE_URL || "http://127.0.0.1:8090"}/api/files/users/${u.id}/${u.avatar}`;
    return `${siteUrl}/og-image.png`;
  };

  const useAppLayout = () => isOwnProfile() && fromApp();

  return (
    <>
      <Show when={profile()}>
        <Title>{profileOgTitle()}</Title>
        <Meta property="og:title" content={profileOgTitle()} />
        <Meta property="og:description" content={profileOgDescription()} />
        <Meta property="og:url" content={profileOgUrl()} />
        <Meta property="og:image" content={profileOgImage()} />
        <Meta property="og:type" content="profile" />
        <Meta name="twitter:card" content="summary_large_image" />
        <Meta name="twitter:title" content={profileOgTitle()} />
        <Meta name="twitter:description" content={profileOgDescription()} />
        <Meta name="twitter:image" content={profileOgImage()} />
      </Show>

      <Show when={!useAppLayout()}>
        <div class="profile-page">
          <header class="profile-header">
            <div class="profile-header-inner container">
              <div class="profile-header-left">
                <Show when={fromChat()}>
                  <A href={backToChatUrl()} class="profile-back-btn" aria-label="Tillbaka till chatt">
                    ← Tillbaka till chatt
                  </A>
                </Show>
                <Show when={!fromChat() && fromApp()}>
                  <A href="/app" class="profile-back-btn" aria-label="Tillbaka till översikt">
                    ← Tillbaka till översikt
                  </A>
                </Show>
                <Show when={!fromChat() && !fromApp() && fromMatches()}>
                  <A href="/app/matches" class="profile-back-btn" aria-label="Tillbaka till matchningar">
                    ← Tillbaka
                  </A>
                </Show>
                <Show when={!fromChat() && !fromApp() && !fromMatches()}>
                  <A href="/" class="profile-back-btn" aria-label="Till Hundkrets">
                    ← Hundkrets
                  </A>
                </Show>
              </div>
              <A href="/" class="profile-logo" style="display: flex; align-items: center; gap: 0.5rem;">
                <img src="/logo-icon.png" alt="" width="28" height="28" style="border-radius: 6px;" />
                <span style="font-weight: 700;">Hundkrets</span>
              </A>
              <div class="profile-header-right" />
            </div>
          </header>
          <main class="container" style="padding-top: 1.5rem; padding-bottom: 3rem;">
        <Show when={profile.loading}>
          <div class="loading">Laddar profil…</div>
        </Show>
        <Show when={profile.error}>
          <div class="card" style="text-align: center; padding: 2rem;">
            <p style="color: var(--color-text-muted); margin: 0 0 1rem;">{profile.error?.message}</p>
            <A href="/" class="btn">Till Hundkrets</A>
          </div>
        </Show>
        <Show when={profile()}>
          {(data) => {
            const u = data().user;
            const needs = data().needs;
            const capacities = data().capacities;
            const dogs = data().dogs;

            const getDog = (dogId: string) => dogs.find((d) => d.id === dogId) as DogRecord | undefined;

            return (
              <>
                <Show when={isOwnProfile()}>
                  <div class="card profile-owner-toolbar" style="margin-bottom: 1rem;">
                    <Show when={publicPreview()} fallback={
                      <>
                        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem;">
                          <A href="/app/settings" class="btn">
                            Inställningar
                          </A>
                          <button
                            type="button"
                            class="btn btn-secondary"
                            onClick={() => setPublicPreview(true)}
                          >
                            Se hur profilen ser ut publikt
                          </button>
                        </div>
                        <p style="margin: 0.75rem 0 0; color: var(--color-text-muted);">
                          Du ser nu din fulla profil med telefon och adress.
                        </p>
                      </>
                    }>
                      <strong>Så här ser din profil ut för andra</strong>
                      <p style="margin: 0.35rem 0 0; color: var(--color-text-muted);">
                        Telefon och adress visas inte. Besökare som inte är inloggade ser nedan.
                      </p>
                      <button
                        type="button"
                        class="btn btn-secondary"
                        style="margin-top: 0.75rem;"
                        onClick={() => setPublicPreview(false)}
                      >
                        Visa hela profilen
                      </button>
                    </Show>
                  </div>
                </Show>

                <div class="profile-hero card">
                  <Show when={connFromThem()}>
                    <div class="modal-detail-connection-banner" style="margin-bottom: 1rem;">
                      <strong>{u.name || "De"} vill ha kontakt med dig</strong>
                      {connFromThem()!.message && (
                        <p class="modal-detail-connection-message">"{connFromThem()!.message}"</p>
                      )}
                    </div>
                  </Show>

                  <Show when={pb.authStore.isValid && u.verified === false && (!isOwnProfile() || publicPreview())}>
                    <div class="modal-detail-connection-banner admin-message-banner admin-message-banner-warning" style="margin-bottom: 1rem;">
                      <strong>Profilen är inte verifierad</strong>
                      <p style="margin: 0.35rem 0 0;">Du kan inte skicka intresseanmälan till denna användare.</p>
                    </div>
                  </Show>

                  <div class="profile-hero-content">
                    <Avatar
                      name={u.name}
                      city={u.city}
                      neighborhood={u.neighborhood}
                      area={u.area}
                      id={u.id}
                      avatar={u.avatar}
                      baseUrl={baseUrl}
                      class="profile-avatar"
                      verified={u.verified}
                    />
                    <div class="profile-hero-info">
                      <h1 class="profile-name">{u.name || "Okänd"}</h1>
                      {dogs.length === 0 && needs.length === 0 && capacities.length > 0 && (
                        <p class="profile-tagline" style="color: var(--color-paw); font-weight: 600;">
                          Vill bara passa hundar – har inte egen hund
                        </p>
                      )}
                      {u.area && <p class="profile-area">{u.area}</p>}
                      {u.bio && (
                        <div class="modal-detail-bio" style="margin-top: 0.75rem;">
                          <strong class="modal-detail-bio-label">Om {u.name || "dem"}</strong>
                          <p class="modal-detail-bio-text">{u.bio}</p>
                        </div>
                      )}
                      {u.breeds_owned_before && (
                        <p class="profile-line">
                          <strong>Erfarenhet:</strong> {u.breeds_owned_before}
                        </p>
                      )}
                      {showPrivateInfo() && (
                        <>
                          {privateProfile()!.phone && (
                            <p class="profile-line">
                              <strong>Telefon:</strong>{" "}
                              <a href={`tel:${privateProfile()!.phone}`}>{privateProfile()!.phone}</a>
                            </p>
                          )}
                          {privateProfile()!.address_private && (
                            <p class="profile-line">
                              <strong>Adress:</strong> {privateProfile()!.address_private}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div class="profile-actions">
                    <div class="profile-share">
                      <button
                        type="button"
                        class="profile-share-btn"
                        onClick={handleShare}
                        aria-label="Dela"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="18" cy="5" r="3" />
                          <circle cx="6" cy="12" r="3" />
                          <circle cx="18" cy="19" r="3" />
                          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                        </svg>
                      </button>
                      <a
                        href={facebookShareUrl()}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="profile-share-btn"
                        aria-label="Dela på Facebook"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                        </svg>
                      </a>
                      <a
                        href={twitterShareUrl()}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="profile-share-btn"
                        aria-label="Dela på X"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                      </a>
                    </div>

                    <Show when={!pb.authStore.isValid || (isOwnProfile() && publicPreview())}>
                      <div class="profile-cta-guest">
                        <p style="margin: 0 0 0.75rem; color: var(--color-text-muted);">
                          Skapa konto för att skicka intresseanmälan
                        </p>
                        <A
                          href={`/register?redirect=${encodeURIComponent(`/users/${u.id}`)}`}
                          class="btn"
                        >
                          Skapa konto
                        </A>
                      </div>
                    </Show>

                    <Show when={pb.authStore.isValid && !isOwnProfile()}>
                      <div class="profile-actions-logged-in">
                        <Show when={!mutual()}>
                          {requested() ? (
                            <>
                              <span class="btn btn-secondary" style="cursor: default;">
                                Intresse skickat
                              </span>
                              <button
                                type="button"
                                class="btn btn-secondary"
                                disabled={refreshing()}
                                onClick={() => handleWithdraw(u.id)}
                              >
                                Ångra
                              </button>
                            </>
                          ) : connFromThem() ? (
                            <button
                              type="button"
                              class="btn"
                              disabled={refreshing() || !isUserVerified()}
                              title={!isUserVerified() ? "Verifiera din e-post för att svara." : undefined}
                              onClick={openRespondModal}
                            >
                              Svara
                            </button>
                          ) : (
                            <button
                              type="button"
                              class={u.verified === false ? "btn btn-secondary btn-disabled" : "btn"}
                              disabled={refreshing() || !isUserVerified() || u.verified === false}
                              title={
                                !isUserVerified()
                                  ? "Verifiera din e-post för att skicka intresse."
                                  : u.verified === false
                                    ? "Du kan inte skicka intresse till en ej verifierad profil."
                                    : undefined
                              }
                              onClick={openInterestModal}
                            >
                              Jag är intresserad
                            </button>
                          )}
                        </Show>
                        <Show when={!isOwnProfile() && mutual()}>
                          <button
                            type="button"
                            class="btn"
                            disabled={refreshing()}
                            onClick={() => handleOpenChat(u.id)}
                          >
                            Öppna chatt
                          </button>
                          <button
                            type="button"
                            class="btn btn-secondary"
                            disabled={refreshing()}
                            onClick={() => {
                              if (!confirm("Är du säker? Ni kommer inte längre se varandras kontaktuppgifter."))
                                return;
                              handleUnmatch(u.id);
                            }}
                          >
                            Avmatcha
                          </button>
                        </Show>
                      </div>
                    </Show>
                  </div>
                </div>

                {capacities.length > 0 && (
                  <section class="profile-section">
                    <h2>Kan passa hundar</h2>
                    <div class="modal-detail-cards">
                      <For each={capacities}>
                        {(c) => (
                          <div class="capacity-card">
                            <div class="capacity-card-content">
                              <div class="capacity-card-row">
                                <span class="need-card-label">Datum:</span> {dateStr(c)}
                              </div>
                              <div class="capacity-card-row">
                                <span class="need-card-label">Storlekar:</span> {sizesStr(c.dog_sizes)}
                              </div>
                              <div class="capacity-card-row">
                                <span class="need-card-label">Kön:</span>{" "}
                                {genderLabel[c.dog_genders ?? "any"] ?? c.dog_genders}
                              </div>
                              <div class="capacity-card-row">
                                <span class="need-card-label">Max antal hundar:</span> {c.max_dogs}
                              </div>
                              {c.notes && (
                                <p class="need-card-notes">
                                  <span class="need-card-label">Anteckningar:</span> {c.notes}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  </section>
                )}

                {needs.length > 0 && (
                  <section class="profile-section">
                    <h2>Behöver hundpassning</h2>
                    <div class="modal-detail-cards">
                      <For each={needs}>
                        {(n) => {
                          const dog = getDog(n.dog ?? "");
                          const d = dog ?? {};
                          const needWithNotes = n;
                          return (
                            <div class="need-card">
                              <div class="need-card-image">
                                <DogImage dog={d} baseUrl={baseUrl} class="dog-card-img" />
                              </div>
                              <div class="need-card-content">
                                <strong class="need-card-title">{d.name ?? "Hund"}</strong>
                                <div class="need-card-columns">
                                  <div class="need-card-col">
                                    {d.size && (
                                      <p class="need-card-line">
                                        <span class="need-card-label">Storlek:</span> {sizeLabel[d.size] ?? d.size}
                                      </p>
                                    )}
                                    {d.breed && (
                                      <p class="need-card-line">
                                        <span class="need-card-label">Ras:</span> {d.breed}
                                      </p>
                                    )}
                                    {d.gender && (
                                      <p class="need-card-line">
                                        <span class="need-card-label">Kön:</span> {genderLabel[d.gender] ?? d.gender}
                                      </p>
                                    )}
                                    {d.age != null && (
                                      <p class="need-card-line">
                                        <span class="need-card-label">Ålder:</span> {d.age} år
                                      </p>
                                    )}
                                  </div>
                                  <div class="need-card-col">
                                    {(d.temperament_new_people || d.temperament_new_dogs_female || d.temperament_new_dogs_male) && (
                                      <p class="need-card-line">
                                        <span class="need-card-label">Temperament:</span>
                                        <br />
                                        Nya människor: {temperamentLabel[d.temperament_new_people ?? ""] || d.temperament_new_people || "—"} · Nya hundar (Hona):{" "}
                                        {temperamentLabel[d.temperament_new_dogs_female ?? ""] || d.temperament_new_dogs_female || "—"} · Nya hundar (Hane):{" "}
                                        {temperamentLabel[d.temperament_new_dogs_male ?? ""] || d.temperament_new_dogs_male || "—"}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                {d.notes && (
                                  <p class="need-card-notes">
                                    <span class="need-card-label">Anteckningar:</span> {d.notes}
                                  </p>
                                )}
                                {needWithNotes.notes && (
                                  <p class="need-card-notes">
                                    <span class="need-card-label">Behov:</span> {needWithNotes.notes}
                                  </p>
                                )}
                                <div class="need-card-footer">
                                  <span class="need-card-label">Datum:</span> {dateStr(n)}
                                </div>
                              </div>
                            </div>
                          );
                        }}
                      </For>
                    </div>
                  </section>
                )}
              </>
            );
          }}
        </Show>
          </main>
        </div>
      </Show>

      <Show when={useAppLayout()}>
        <AppShell>
          <main class="container" style="padding-top: 1.5rem; padding-bottom: 3rem;">
        <Show when={profile.loading}>
          <div class="loading">Laddar profil…</div>
        </Show>
        <Show when={profile.error}>
          <div class="card" style="text-align: center; padding: 2rem;">
            <p style="color: var(--color-text-muted); margin: 0 0 1rem;">{profile.error?.message}</p>
            <A href="/" class="btn">Till Hundkrets</A>
          </div>
        </Show>
        <Show when={profile()}>
          {(data) => {
            const u = data().user;
            const needs = data().needs;
            const capacities = data().capacities;
            const dogs = data().dogs;

            const getDog = (dogId: string) => dogs.find((d) => d.id === dogId) as DogRecord | undefined;

            return (
              <>
                <Show when={isOwnProfile()}>
                  <div class="card profile-owner-toolbar" style="margin-bottom: 1rem;">
                    <Show when={publicPreview()} fallback={
                      <>
                        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem;">
                          <A href="/app/settings" class="btn">
                            Inställningar
                          </A>
                          <button
                            type="button"
                            class="btn btn-secondary"
                            onClick={() => setPublicPreview(true)}
                          >
                            Se hur profilen ser ut publikt
                          </button>
                        </div>
                        <p style="margin: 0.75rem 0 0; color: var(--color-text-muted);">
                          Du ser nu din fulla profil med telefon och adress.
                        </p>
                      </>
                    }>
                      <strong>Så här ser din profil ut för andra</strong>
                      <p style="margin: 0.35rem 0 0; color: var(--color-text-muted);">
                        Telefon och adress visas inte. Besökare som inte är inloggade ser nedan.
                      </p>
                      <button
                        type="button"
                        class="btn btn-secondary"
                        style="margin-top: 0.75rem;"
                        onClick={() => setPublicPreview(false)}
                      >
                        Visa hela profilen
                      </button>
                    </Show>
                  </div>
                </Show>

                <div class="profile-hero card">
                  <Show when={connFromThem()}>
                    <div class="modal-detail-connection-banner" style="margin-bottom: 1rem;">
                      <strong>{u.name || "De"} vill ha kontakt med dig</strong>
                      {connFromThem()!.message && (
                        <p class="modal-detail-connection-message">"{connFromThem()!.message}"</p>
                      )}
                    </div>
                  </Show>

                  <Show when={pb.authStore.isValid && u.verified === false && (!isOwnProfile() || publicPreview())}>
                    <div class="modal-detail-connection-banner admin-message-banner admin-message-banner-warning" style="margin-bottom: 1rem;">
                      <strong>Profilen är inte verifierad</strong>
                      <p style="margin: 0.35rem 0 0;">Du kan inte skicka intresseanmälan till denna användare.</p>
                    </div>
                  </Show>

                  <div class="profile-hero-content">
                    <Avatar
                      name={u.name}
                      city={u.city}
                      neighborhood={u.neighborhood}
                      area={u.area}
                      id={u.id}
                      avatar={u.avatar}
                      baseUrl={baseUrl}
                      class="profile-avatar"
                      verified={u.verified}
                    />
                    <div class="profile-hero-info">
                      <h1 class="profile-name">{u.name || "Okänd"}</h1>
                      {dogs.length === 0 && needs.length === 0 && capacities.length > 0 && (
                        <p class="profile-tagline" style="color: var(--color-paw); font-weight: 600;">
                          Vill bara passa hundar – har inte egen hund
                        </p>
                      )}
                      {u.area && <p class="profile-area">{u.area}</p>}
                      {u.bio && (
                        <div class="modal-detail-bio" style="margin-top: 0.75rem;">
                          <strong class="modal-detail-bio-label">Om {u.name || "dem"}</strong>
                          <p class="modal-detail-bio-text">{u.bio}</p>
                        </div>
                      )}
                      {u.breeds_owned_before && (
                        <p class="profile-line">
                          <strong>Erfarenhet:</strong> {u.breeds_owned_before}
                        </p>
                      )}
                      {showPrivateInfo() && (
                        <>
                          {privateProfile()!.phone && (
                            <p class="profile-line">
                              <strong>Telefon:</strong>{" "}
                              <a href={`tel:${privateProfile()!.phone}`}>{privateProfile()!.phone}</a>
                            </p>
                          )}
                          {privateProfile()!.address_private && (
                            <p class="profile-line">
                              <strong>Adress:</strong> {privateProfile()!.address_private}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div class="profile-actions">
                    <div class="profile-share">
                      <button
                        type="button"
                        class="profile-share-btn"
                        onClick={handleShare}
                        aria-label="Dela"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="18" cy="5" r="3" />
                          <circle cx="6" cy="12" r="3" />
                          <circle cx="18" cy="19" r="3" />
                          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                        </svg>
                      </button>
                      <a
                        href={facebookShareUrl()}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="profile-share-btn"
                        aria-label="Dela på Facebook"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                        </svg>
                      </a>
                      <a
                        href={twitterShareUrl()}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="profile-share-btn"
                        aria-label="Dela på X"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                      </a>
                    </div>

                    <Show when={!pb.authStore.isValid || (isOwnProfile() && publicPreview())}>
                      <div class="profile-cta-guest">
                        <p style="margin: 0 0 0.75rem; color: var(--color-text-muted);">
                          Skapa konto för att skicka intresseanmälan
                        </p>
                        <A
                          href={`/register?redirect=${encodeURIComponent(`/users/${u.id}`)}`}
                          class="btn"
                        >
                          Skapa konto
                        </A>
                      </div>
                    </Show>

                    <Show when={pb.authStore.isValid && !isOwnProfile()}>
                      <div class="profile-actions-logged-in">
                        <Show when={!mutual()}>
                          {requested() ? (
                            <>
                              <span class="btn btn-secondary" style="cursor: default;">
                                Intresse skickat
                              </span>
                              <button
                                type="button"
                                class="btn btn-secondary"
                                disabled={refreshing()}
                                onClick={() => handleWithdraw(u.id)}
                              >
                                Ångra
                              </button>
                            </>
                          ) : connFromThem() ? (
                            <button
                              type="button"
                              class="btn"
                              disabled={refreshing() || !isUserVerified()}
                              title={!isUserVerified() ? "Verifiera din e-post för att svara." : undefined}
                              onClick={openRespondModal}
                            >
                              Svara
                            </button>
                          ) : (
                            <button
                              type="button"
                              class={u.verified === false ? "btn btn-secondary btn-disabled" : "btn"}
                              disabled={refreshing() || !isUserVerified() || u.verified === false}
                              title={
                                !isUserVerified()
                                  ? "Verifiera din e-post för att skicka intresse."
                                  : u.verified === false
                                    ? "Du kan inte skicka intresse till en ej verifierad profil."
                                    : undefined
                              }
                              onClick={openInterestModal}
                            >
                              Jag är intresserad
                            </button>
                          )}
                        </Show>
                        <Show when={!isOwnProfile() && mutual()}>
                          <button
                            type="button"
                            class="btn"
                            disabled={refreshing()}
                            onClick={() => handleOpenChat(u.id)}
                          >
                            Öppna chatt
                          </button>
                          <button
                            type="button"
                            class="btn btn-secondary"
                            disabled={refreshing()}
                            onClick={() => {
                              if (!confirm("Är du säker? Ni kommer inte längre se varandras kontaktuppgifter."))
                                return;
                              handleUnmatch(u.id);
                            }}
                          >
                            Avmatcha
                          </button>
                        </Show>
                      </div>
                    </Show>
                  </div>
                </div>

                {capacities.length > 0 && (
                  <section class="profile-section">
                    <h2>Kan passa hundar</h2>
                    <div class="modal-detail-cards">
                      <For each={capacities}>
                        {(c) => (
                          <div class="capacity-card">
                            <div class="capacity-card-content">
                              <div class="capacity-card-row">
                                <span class="need-card-label">Datum:</span> {dateStr(c)}
                              </div>
                              <div class="capacity-card-row">
                                <span class="need-card-label">Storlekar:</span> {sizesStr(c.dog_sizes)}
                              </div>
                              <div class="capacity-card-row">
                                <span class="need-card-label">Kön:</span>{" "}
                                {genderLabel[c.dog_genders ?? "any"] ?? c.dog_genders}
                              </div>
                              <div class="capacity-card-row">
                                <span class="need-card-label">Max antal hundar:</span> {c.max_dogs}
                              </div>
                              {c.notes && (
                                <p class="need-card-notes">
                                  <span class="need-card-label">Anteckningar:</span> {c.notes}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  </section>
                )}

                {needs.length > 0 && (
                  <section class="profile-section">
                    <h2>Behöver hundpassning</h2>
                    <div class="modal-detail-cards">
                      <For each={needs}>
                        {(n) => {
                          const dog = getDog(n.dog ?? "");
                          const d = dog ?? {};
                          const needWithNotes = n;
                          return (
                            <div class="need-card">
                              <div class="need-card-image">
                                <DogImage dog={d} baseUrl={baseUrl} class="dog-card-img" />
                              </div>
                              <div class="need-card-content">
                                <strong class="need-card-title">{d.name ?? "Hund"}</strong>
                                <div class="need-card-columns">
                                  <div class="need-card-col">
                                    {d.size && (
                                      <p class="need-card-line">
                                        <span class="need-card-label">Storlek:</span> {sizeLabel[d.size] ?? d.size}
                                      </p>
                                    )}
                                    {d.breed && (
                                      <p class="need-card-line">
                                        <span class="need-card-label">Ras:</span> {d.breed}
                                      </p>
                                    )}
                                    {d.gender && (
                                      <p class="need-card-line">
                                        <span class="need-card-label">Kön:</span> {genderLabel[d.gender] ?? d.gender}
                                      </p>
                                    )}
                                    {d.age != null && (
                                      <p class="need-card-line">
                                        <span class="need-card-label">Ålder:</span> {d.age} år
                                      </p>
                                    )}
                                  </div>
                                  <div class="need-card-col">
                                    {(d.temperament_new_people || d.temperament_new_dogs_female || d.temperament_new_dogs_male) && (
                                      <p class="need-card-line">
                                        <span class="need-card-label">Temperament:</span>
                                        <br />
                                        Nya människor: {temperamentLabel[d.temperament_new_people ?? ""] || d.temperament_new_people || "—"} · Nya hundar (Hona):{" "}
                                        {temperamentLabel[d.temperament_new_dogs_female ?? ""] || d.temperament_new_dogs_female || "—"} · Nya hundar (Hane):{" "}
                                        {temperamentLabel[d.temperament_new_dogs_male ?? ""] || d.temperament_new_dogs_male || "—"}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                {d.notes && (
                                  <p class="need-card-notes">
                                    <span class="need-card-label">Anteckningar:</span> {d.notes}
                                  </p>
                                )}
                                {needWithNotes.notes && (
                                  <p class="need-card-notes">
                                    <span class="need-card-label">Behov:</span> {needWithNotes.notes}
                                  </p>
                                )}
                                <div class="need-card-footer">
                                  <span class="need-card-label">Datum:</span> {dateStr(n)}
                                </div>
                              </div>
                            </div>
                          );
                        }}
                      </For>
                    </div>
                  </section>
                )}
              </>
            );
          }}
        </Show>
          </main>
        </AppShell>
      </Show>

      <Show when={interestModalTarget()}>
        {(target) => (
          <InterestModal
            target={target()}
            message={interestModalMessage()}
            onMessageChange={setInterestModalMessage}
            onClose={() => setInterestModalTarget(undefined)}
            onSubmit={() => {
              const t = target();
              if (t) handleInterested(t.userId, interestModalMessage().trim() || undefined);
            }}
            loading={refreshing()}
            isVerified={isUserVerified()}
          />
        )}
      </Show>
      <Show when={respondModalTarget()}>
        {(target) => (
          <RespondModal
            target={target()}
            message={respondModalMessage()}
            onMessageChange={setRespondModalMessage}
            onClose={() => setRespondModalTarget(undefined)}
            onAccept={handleAcceptWithReply}
            onReject={handleRejectRequest}
            loading={refreshing()}
            isVerified={isUserVerified()}
          />
        )}
      </Show>
    </>
  );
}
