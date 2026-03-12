import { Show } from "solid-js";

const GENDER_LABELS: Record<string, string> = {
  male: "Hane",
  female: "Tik",
};

const SIZE_LABELS: Record<string, string> = {
  small: "Liten",
  medium: "Mellan",
  large: "Stor",
};

export type DogInfoProps = {
  name?: string;
  age?: number | null;
  breed?: string | null;
  gender?: string | null;
  size?: string | null;
  /** Show size instead of breed (default: false) */
  showSize?: boolean;
};

/**
 * Formats dog info in Swedish: "{name}, {age} år, {breed/size} {gender}"
 * Used for displaying dog information consistently across the app.
 */
export function formatDogInfo(dog: DogInfoProps): string {
  const parts: string[] = [];
  
  if (dog.name) parts.push(dog.name);
  
  if (dog.age != null && dog.age > 0) {
    parts.push(`${dog.age} år`);
  }
  
  if (dog.showSize && dog.size) {
    parts.push(SIZE_LABELS[dog.size] || dog.size);
  } else if (dog.breed) {
    parts.push(dog.breed);
  }
  
  if (dog.gender) {
    parts.push(GENDER_LABELS[dog.gender] || dog.gender);
  }
  
  return parts.join(", ") || "Hund";
}

/**
 * Component that displays dog info in Swedish format.
 * Shows: {name}, {age} år, {breed} {gender}
 */
export function DogInfo(dog: DogInfoProps) {
  return (
    <span class="dog-info">
      <strong>{dog.name || "Hund"}</strong>
      <Show when={dog.age != null && dog.age > 0}>
        <>, {dog.age} år</>
      </Show>
      <Show when={dog.showSize && dog.size}>
        <>, {SIZE_LABELS[dog.size!] || dog.size}</>
      </Show>
      <Show when={!dog.showSize && dog.breed}>
        <>, {dog.breed}</>
      </Show>
      <Show when={dog.gender}>
        <>, {GENDER_LABELS[dog.gender!] || dog.gender}</>
      </Show>
    </span>
  );
}