import type { RecordModel } from "pocketbase";

export interface User extends RecordModel {
  name?: string;
  phone?: string;
  area?: string;
  address_private?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  neighborhood?: string;
  avatar?: string;
  /** Set to true when user completes onboarding (capacity step). Add this field in PocketBase admin. */
  onboarding_complete?: boolean;
  /** Email verification status from PocketBase auth */
  verified?: boolean;
}

export interface Dog extends RecordModel {
  owner: string;
  name: string;
  size: string;
  gender: string;
}

export interface WatchNeed extends RecordModel {
  user: string;
  dog: string;
  start_date?: string;
  end_date?: string;
  flexible_dates?: boolean;
  duration_weeks?: number;
  expand?: { user?: User; dog?: Dog };
}

export interface WatchCapacity extends RecordModel {
  user: string;
  start_date?: string;
  end_date?: string;
  flexible_dates?: boolean;
  duration_weeks?: number;
  dog_sizes: string | string[];
  dog_genders: string;
  max_dogs: number;
  expand?: { user?: User };
}

export interface Listing {
  user: User;
  needs: WatchNeed[];
  capacities: WatchCapacity[];
  dogs: Dog[];
}

function normalizeArea(area: string | undefined): string {
  return (area ?? "")
    .trim()
    .toLowerCase()
    .replace(/[,;]/g, " - ")
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*/g, " - ")
    .trim();
}

/**
 * Haversine distance in km between two points.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface ListingWithDistance extends Listing {
  distanceKm?: number;
}

/**
 * Find all users within maxDistanceKm who have at least one need OR one capacity.
 * Uses lat/lng when available; falls back to area match for users without coordinates.
 */
export function findListings(
  needs: WatchNeed[],
  capacities: WatchCapacity[],
  currentUserId: string,
  users: User[],
  dogs: Dog[],
  maxDistanceKm: number = 50
): ListingWithDistance[] {
  const me = users.find((u) => u.id === currentUserId);
  const myArea = normalizeArea(me?.area);
  const myLat = me?.latitude;
  const myLon = me?.longitude;

  const useDistance = typeof myLat === "number" && typeof myLon === "number";
  if (!useDistance && !myArea) return [];

  const dogMap = new Map(dogs.map((d) => [d.id, d]));

  const needsByUser = new Map<string, WatchNeed[]>();
  for (const n of needs) {
    if (!needsByUser.has(n.user)) needsByUser.set(n.user, []);
    needsByUser.get(n.user)!.push(n);
  }
  const capacitiesByUser = new Map<string, WatchCapacity[]>();
  for (const c of capacities) {
    if (!capacitiesByUser.has(c.user)) capacitiesByUser.set(c.user, []);
    capacitiesByUser.get(c.user)!.push(c);
  }

  const listings: ListingWithDistance[] = [];

  for (const user of users) {
    if (user.id === currentUserId) continue;

    if (useDistance) {
      const theirLat = user.latitude;
      const theirLon = user.longitude;
      if (typeof theirLat !== "number" || typeof theirLon !== "number") continue;
      const dist = haversineDistance(myLat!, myLon!, theirLat, theirLon);
      if (dist > maxDistanceKm) continue;

      const userNeeds = needsByUser.get(user.id) ?? [];
      const userCapacities = capacitiesByUser.get(user.id) ?? [];
      if (userNeeds.length === 0 && userCapacities.length === 0) continue;

      const userDogIds = new Set<string>();
      for (const n of userNeeds) userDogIds.add(n.dog);
      const userDogs = [...userDogIds].map((id) => dogMap.get(id)).filter(Boolean) as Dog[];

      listings.push({
        user,
        needs: userNeeds,
        capacities: userCapacities,
        dogs: userDogs,
        distanceKm: dist,
      });
    } else {
      if (normalizeArea(user.area) !== myArea) continue;

      const userNeeds = needsByUser.get(user.id) ?? [];
      const userCapacities = capacitiesByUser.get(user.id) ?? [];
      if (userNeeds.length === 0 && userCapacities.length === 0) continue;

      const userDogIds = new Set<string>();
      for (const n of userNeeds) userDogIds.add(n.dog);
      const userDogs = [...userDogIds].map((id) => dogMap.get(id)).filter(Boolean) as Dog[];

      listings.push({
        user,
        needs: userNeeds,
        capacities: userCapacities,
        dogs: userDogs,
      });
    }
  }

  return listings.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
}
