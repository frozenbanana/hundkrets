import { createResource, Show } from "solid-js";
import { fetchBreedImageUrl } from "~/lib/dog-ceo";

interface DogImageProps {
  dog: { id?: string; name?: string; breed?: string; image?: string };
  baseUrl: string;
  class?: string;
  style?: string | Record<string, string>;
}

export function DogImage(props: DogImageProps) {
  const { dog, baseUrl, class: className, style } = props;

  const [placeholderUrl] = createResource(
    () => (dog.image ? null : dog.breed ?? ""),
    (breed) => (breed !== null ? fetchBreedImageUrl(breed || undefined) : Promise.resolve(null))
  );

  const styleValue = style;

  return (
    <Show
      when={dog.image}
      fallback={
        <Show
          when={placeholderUrl()}
          fallback={
            <div class="dog-card-img-placeholder" style={styleValue}>
              🐕
            </div>
          }
        >
          <img
            src={placeholderUrl()!}
            alt={dog.name ?? "Hund"}
            class={className ?? "dog-card-img"}
            style={styleValue}
          />
        </Show>
      }
    >
      <img
        src={`${baseUrl}/api/files/dogs/${dog.id}/${dog.image}`}
        alt={dog.name ?? "Hund"}
        class={className ?? "dog-card-img"}
        style={styleValue}
      />
    </Show>
  );
}
