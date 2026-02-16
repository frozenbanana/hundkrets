import type { RecordModel } from "pocketbase";

export interface User extends RecordModel {
  email: string;
  name?: string;
  phone?: string;
  area?: string;
  city?: string;
  neighborhood?: string;
  address_private?: string;
  latitude?: number;
  longitude?: number;
  breeds_owned_before?: string;
}

export interface Dog extends RecordModel {
  owner: string;
  name: string;
  breed?: string;
  size: "small" | "medium" | "large";
  gender: "male" | "female";
  temperament?: string;
  temperament_new_people?: string;
  temperament_new_dogs_female?: string;
  temperament_new_dogs_male?: string;
  notes?: string;
  image?: string;
}

export interface WatchNeed extends RecordModel {
  user: string;
  dog: string;
  start_date?: string;
  end_date?: string;
  flexible_dates?: boolean;
  open_any_duration?: boolean;
  duration_specific?: string;
  notes?: string;
}

export interface WatchCapacity extends RecordModel {
  user: string;
  start_date?: string;
  end_date?: string;
  flexible_dates?: boolean;
  open_any_duration?: boolean;
  duration_specific?: string;
  dog_sizes: ("small" | "medium" | "large")[] | string;
  dog_genders: "male" | "female" | "any";
  max_dogs: number;
  notes?: string;
}
