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
  /** Last login/activity timestamp for "Senast aktiv" sort */
  last_login_at?: string;
}

export interface Dog extends RecordModel {
  owner: string;
  name: string;
  size: string;
  gender: string;
  breed?: string;
  age?: number;
}

export interface WatchNeed extends RecordModel {
  user: string;
  dog: string | string[]; // Can be single or multiple dogs
  care_type?: "daytime" | "overnight" | "both";
  start_date?: string;
  end_date?: string;
  flexible_dates?: boolean;
  duration_weeks?: number;
  expand?: { user?: User; dog?: Dog | Dog[] }; // Dog or array of Dogs when expanded
}

export interface WatchCapacity extends RecordModel {
  user: string;
  care_type?: "daytime" | "overnight" | "both";
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

export type CareType = "daytime" | "overnight" | "both";

function overlapsCareType(a?: string, b?: string): boolean {
  const aVal = (a ?? "both") as CareType;
  const bVal = (b ?? "both") as CareType;
  if (aVal === "both" || bVal === "both") return true;
  return aVal === bVal;
}

function ts(v?: string): number {
  const t = Date.parse(v ?? "");
  return Number.isNaN(t) ? 0 : t;
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
      for (const n of userNeeds) {
        // dog can be a single ID or array of IDs
        const dogIds = Array.isArray(n.dog) ? n.dog : [n.dog];
        for (const id of dogIds) userDogIds.add(id);
      }
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
      for (const n of userNeeds) {
        // dog can be a single ID or array of IDs
        const dogIds = Array.isArray(n.dog) ? n.dog : [n.dog];
        for (const id of dogIds) userDogIds.add(id);
      }
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

export function rankOnboardingTopListings(
  listings: ListingWithDistance[],
  myNeeds: WatchNeed[],
  myCapacities: WatchCapacity[]
): ListingWithDistance[] {
  return [...listings].sort((a, b) => {
    const aNeedFit =
      myNeeds.length > 0 &&
      myNeeds.some((myNeed) =>
        a.capacities.some((theirCap) => overlapsCareType(myNeed.care_type, theirCap.care_type))
      );
    const aCapacityFit =
      myCapacities.length > 0 &&
      myCapacities.some((myCap) =>
        a.needs.some((theirNeed) => overlapsCareType(myCap.care_type, theirNeed.care_type))
      );
    const bNeedFit =
      myNeeds.length > 0 &&
      myNeeds.some((myNeed) =>
        b.capacities.some((theirCap) => overlapsCareType(myNeed.care_type, theirCap.care_type))
      );
    const bCapacityFit =
      myCapacities.length > 0 &&
      myCapacities.some((myCap) =>
        b.needs.some((theirNeed) => overlapsCareType(myCap.care_type, theirNeed.care_type))
      );

    const aScore = (aNeedFit ? 2 : 0) + (aCapacityFit ? 2 : 0);
    const bScore = (bNeedFit ? 2 : 0) + (bCapacityFit ? 2 : 0);
    if (aScore !== bScore) return bScore - aScore;

    const aDist = a.distanceKm ?? 999;
    const bDist = b.distanceKm ?? 999;
    if (aDist !== bDist) return aDist - bDist;

    return ts((b.user as { last_login_at?: string }).last_login_at) - ts((a.user as { last_login_at?: string }).last_login_at);
  });
}

function careTypeLabelSv(ct?: string): string {
  if (ct === "daytime") return "dagpassning";
  if (ct === "overnight") return "övernattning";
  return "heldagar";
}

export interface OnboardingMatchExplanation {
  /** Short lines shown under the member name */
  lines: string[];
  needFit: boolean;
  capacityFit: boolean;
}

/**
 * Human-readable “why this profile” for onboarding / recommended rows.
 * When du har både behov och tillgänglighet får du alltid en rad per riktning.
 */
export function explainOnboardingListingMatch(
  listing: ListingWithDistance,
  myNeeds: WatchNeed[],
  myCapacities: WatchCapacity[]
): OnboardingMatchExplanation {
  const needFit =
    myNeeds.length > 0 &&
    listing.capacities.length > 0 &&
    myNeeds.some((myNeed) =>
      listing.capacities.some((theirCap) => overlapsCareType(myNeed.care_type, theirCap.care_type))
    );
  const capacityFit =
    myCapacities.length > 0 &&
    listing.needs.length > 0 &&
    myCapacities.some((myCap) =>
      listing.needs.some((theirNeed) => overlapsCareType(myCap.care_type, theirNeed.care_type))
    );

  const lines: string[] = [];

  if (myNeeds.length > 0) {
    if (listing.capacities.length === 0) {
      lines.push("Ditt behov och deras tillgänglighet — de har inte lagt in tillgänglighet än.");
    } else if (needFit) {
      lines.push("Ditt behov och deras tillgänglighet — matchar.");
    } else {
      lines.push("Ditt behov och deras tillgänglighet — ingen tydlig överlappning just nu.");
    }
  }

  if (myCapacities.length > 0) {
    if (listing.needs.length === 0) {
      lines.push("Din tillgänglighet och deras behov — de har inget registrerat behov än.");
    } else if (capacityFit) {
      lines.push("Din tillgänglighet och deras behov — matchar.");
    } else {
      lines.push("Din tillgänglighet och deras behov — ingen tydlig överlappning just nu.");
    }
  }

  if (lines.length === 0) {
    lines.push("Nära dig och nyligen aktiv — ta en titt på profilen.");
  }

  const anyFit = needFit || capacityFit;
  if (!anyFit && (myNeeds.length > 0 || myCapacities.length > 0)) {
    lines.push("Rekommenderad ändå pga närhet och aktivitet.");
  }

  let careLine: string | undefined;
  if (needFit && myNeeds.length > 0) {
    outer: for (const myNeed of myNeeds) {
      for (const cap of listing.capacities) {
        if (!overlapsCareType(myNeed.care_type, cap.care_type)) continue;
        const mn = (myNeed.care_type ?? "both") as CareType;
        const tc = (cap.care_type ?? "both") as CareType;
        if (mn === "both" && tc === "both") break outer;
        if (mn === tc) {
          careLine = `Samma typ av passning: ${careTypeLabelSv(mn)}.`;
        } else {
          careLine = `Passning: ${careTypeLabelSv(mn)} mot deras ${careTypeLabelSv(tc)}.`;
        }
        break outer;
      }
    }
  }
  if (!careLine && capacityFit && myCapacities.length > 0) {
    outer2: for (const myCap of myCapacities) {
      for (const theirNeed of listing.needs) {
        if (!overlapsCareType(myCap.care_type, theirNeed.care_type)) continue;
        const mc = (myCap.care_type ?? "both") as CareType;
        const tn = (theirNeed.care_type ?? "both") as CareType;
        if (mc === "both" && tn === "both") break outer2;
        if (mc === tn) {
          careLine = `Samma typ av passning: ${careTypeLabelSv(mc)}.`;
        } else {
          careLine = `Passning: ${careTypeLabelSv(mc)} mot deras ${careTypeLabelSv(tn)}.`;
        }
        break outer2;
      }
    }
  }
  if (careLine) lines.push(careLine);

  return { lines, needFit, capacityFit };
}
