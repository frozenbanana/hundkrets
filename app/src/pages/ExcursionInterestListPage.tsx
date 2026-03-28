import { A, useParams } from "@solidjs/router";
import { createResource, For, Show } from "solid-js";
import { AppShell } from "~/components/AppShell";
import { Avatar } from "~/components/Avatar";
import { formatDogInfo } from "~/components/DogInfo";
import { parseApiError } from "~/lib/errors";
import { pb } from "~/lib/pocketbase";
import type { Dog } from "~/types";

const pbBaseUrl = import.meta.env.VITE_POCKETBASE_URL || "http://localhost:8090";

type InterestRow = {
  userId: string;
  name: string;
  avatar: string;
  dogs: Dog[];
};

function pocketOrClause(field: string, ids: string[]): string {
  if (ids.length === 0) return 'id = ""';
  const clauses = ids.map((id) => `${field} = "${id.replace(/"/g, "")}"`);
  return clauses.length === 1 ? clauses[0]! : `(${clauses.join(" || ")})`;
}

export default function ExcursionInterestListPage() {
  const params = useParams<{ id: string }>();

  const [data] = createResource(
    () => params.id,
    async (excursionId): Promise<{ title: string; rows: InterestRow[] }> => {
      if (!excursionId) throw new Error("Saknar hundträff");
      const [excursion, interestsRaw] = await Promise.all([
        pb.collection("excursions").getOne<{ id: string; title: string }>(excursionId),
        pb.collection("excursion_interests").getFullList<{
          id: string;
          excursion: string;
          user: string;
        }>({ filter: `excursion = "${excursionId.replace(/"/g, "")}"` }),
      ]);

      const userIds = [...new Set(interestsRaw.map((i) => i.user))];
      if (userIds.length === 0) {
        return { title: excursion.title, rows: [] };
      }

      const [usersRaw, dogsRaw] = await Promise.all([
        pb.collection("users").getFullList<{ id: string; name?: string; avatar?: string }>({
          filter: pocketOrClause("id", userIds),
        }),
        pb.collection("dogs").getFullList<Dog>({ filter: pocketOrClause("owner", userIds) }),
      ]);

      const userById = new Map(usersRaw.map((u) => [u.id, u]));
      const dogsByOwner = new Map<string, Dog[]>();
      for (const d of dogsRaw) {
        const list = dogsByOwner.get(d.owner) ?? [];
        list.push(d);
        dogsByOwner.set(d.owner, list);
      }

      const rows: InterestRow[] = userIds
        .map((userId) => {
          const u = userById.get(userId);
          return {
            userId,
            name: u?.name?.trim() || "Användare",
            avatar: u?.avatar?.trim() ?? "",
            dogs: (dogsByOwner.get(userId) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name, "sv")),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name, "sv", { sensitivity: "base" }));

      return { title: excursion.title, rows };
    }
  );

  return (
    <AppShell>
      <div class="container excursions-page">
        <A href={`/app/excursions/${params.id}`} class="profile-back-link">
          ← Tillbaka till hundträffen
        </A>

        <Show when={data.loading}>
          <p>Laddar intresselista…</p>
        </Show>

        <Show when={data.error}>
          <section class="card" style="padding: 1rem;">
            <p style="color: #dc2626; margin: 0;">
              Kunde inte ladda intresselistan: {parseApiError(data.error)}
            </p>
          </section>
        </Show>

        <Show when={data() && !data.loading}>
          {(d) => (
            <section class="card excursion-interest-list">
              <h1 class="excursion-interest-list__title">Intresselista</h1>
              <p class="excursion-interest-list__subtitle">{d().title}</p>
              <p class="excursion-interest-list__lead">Användare som vill komma och deras registrerade hundar.</p>

              <Show
                when={d().rows.length > 0}
                fallback={<p class="excursion-interest-list__empty">Ingen har anmält intresse än.</p>}
              >
                <ul class="excursion-interest-list__entries">
                  <For each={d().rows}>
                    {(row) => (
                      <li class="excursion-interest-list__entry card">
                        <div class="excursion-interest-list__user">
                          <Avatar
                            name={row.name}
                            id={row.userId}
                            avatar={row.avatar}
                            baseUrl={pbBaseUrl}
                            size="sm"
                          />
                          <A href={`/users/${row.userId}`} class="excursion-interest-list__user-name">
                            {row.name}
                          </A>
                        </div>
                        <div class="excursion-interest-list__dogs">
                          <Show
                            when={row.dogs.length > 0}
                            fallback={
                              <p class="excursion-interest-list__no-dogs">Inga hundar registrerade i profilen.</p>
                            }
                          >
                            <ul class="excursion-interest-list__dog-list">
                              <For each={row.dogs}>
                                {(dog) => (
                                  <li class="excursion-interest-list__dog-item">
                                    {formatDogInfo({
                                      name: dog.name,
                                      breed: dog.breed,
                                      gender: dog.gender,
                                      size: dog.size,
                                      showSize: !dog.breed?.trim(),
                                    })}
                                  </li>
                                )}
                              </For>
                            </ul>
                          </Show>
                        </div>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
            </section>
          )}
        </Show>
      </div>
    </AppShell>
  );
}
