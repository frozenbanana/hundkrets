import { createResource, For, Show } from "solid-js";
import { fetchMultipleRandomDogs } from "~/lib/dog-ceo";

export function DogGallery() {
  const [dogs] = createResource(() => fetchMultipleRandomDogs(12));

  return (
    <div class="dog-gallery">
      <Show when={dogs.loading}>
        <div class="dog-gallery-loading">
          <span class="dog-gallery-loading-dot" />
          <span class="dog-gallery-loading-dot" />
          <span class="dog-gallery-loading-dot" />
        </div>
      </Show>
      <Show when={dogs() && dogs()!.length > 0}>
        <div class="dog-gallery-grid">
          <For each={dogs()}>
            {(url, i) => (
              <div
                class="dog-gallery-item"
                style={{
                  "animation-delay": `${(i() % 6) * 0.15}s`,
                  "animation-duration": `${3 + (i() % 4) * 0.5}s`,
                }}
              >
                <img src={url} alt="" loading="lazy" />
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
