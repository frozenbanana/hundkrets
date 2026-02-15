import type { RecordModel } from "pocketbase";

export interface User extends RecordModel {
  name?: string;
  phone?: string;
  area?: string;
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
  start_date: string;
  end_date: string;
  expand?: { user?: User; dog?: Dog };
}

export interface WatchCapacity extends RecordModel {
  user: string;
  start_date: string;
  end_date: string;
  dog_sizes: string;
  dog_genders: string;
  max_dogs: number;
  expand?: { user?: User };
}

export interface Match {
  user: User;
  theirNeed: WatchNeed;
  theirCapacity: WatchCapacity;
  myNeed: WatchNeed;
  myCapacity: WatchCapacity;
}

function datesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  const aS = new Date(aStart).getTime();
  const aE = new Date(aEnd).getTime();
  const bS = new Date(bStart).getTime();
  const bE = new Date(bEnd).getTime();
  return aS <= bE && bS <= aE;
}

function dogFitsCapacity(
  dogSize: string,
  dogGender: string,
  capacity: WatchCapacity
): boolean {
  const sizeOk =
    capacity.dog_sizes === "any" || capacity.dog_sizes === dogSize;
  const genderOk =
    capacity.dog_genders === "any" || capacity.dog_genders === dogGender;
  return sizeOk && genderOk;
}

function normalizeArea(area: string | undefined): string {
  return (area ?? "").trim().toLowerCase();
}

export function findMatches(
  needs: WatchNeed[],
  capacities: WatchCapacity[],
  currentUserId: string,
  users: User[],
  dogs: Dog[]
): Match[] {
  const myNeeds = needs.filter((n) => n.user === currentUserId);
  const myCapacities = capacities.filter((c) => c.user === currentUserId);
  const myArea = normalizeArea(
    users.find((u) => u.id === currentUserId)?.area
  );
  if (!myArea) return [];

  const userMap = new Map(users.map((u) => [u.id, u]));
  const dogMap = new Map(dogs.map((d) => [d.id, d]));

  const matches: Match[] = [];

  for (const otherNeed of needs) {
    if (otherNeed.user === currentUserId) continue;
    const otherUser = userMap.get(otherNeed.user);
    if (!otherUser) continue;
    if (normalizeArea(otherUser.area) !== myArea) continue;

    const otherDog = dogMap.get(otherNeed.dog) ?? (otherNeed.expand?.dog as Dog);
    if (!otherDog) continue;

    for (const otherCapacity of capacities) {
      if (otherCapacity.user !== otherNeed.user) continue;

      for (const myNeed of myNeeds) {
        const myDog = dogMap.get(myNeed.dog) ?? (myNeed.expand?.dog as Dog);
        if (!myDog) continue;

        for (const myCapacity of myCapacities) {
          if (
            !datesOverlap(
              otherNeed.start_date,
              otherNeed.end_date,
              myCapacity.start_date,
              myCapacity.end_date
            )
          )
            continue;
          if (
            !datesOverlap(
              myNeed.start_date,
              myNeed.end_date,
              otherCapacity.start_date,
              otherCapacity.end_date
            )
          )
            continue;

          if (!dogFitsCapacity(otherDog.size, otherDog.gender, myCapacity))
            continue;
          if (!dogFitsCapacity(myDog.size, myDog.gender, otherCapacity))
            continue;

          matches.push({
            user: otherUser,
            theirNeed: otherNeed,
            theirCapacity: otherCapacity,
            myNeed,
            myCapacity,
          });
        }
      }
    }
  }

  return matches;
}
