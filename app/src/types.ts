import type { RecordModel } from "pocketbase";

export interface User extends RecordModel {
  email: string;
  name?: string;
  phone?: string;
  area?: string;
}

export interface Dog extends RecordModel {
  owner: string;
  name: string;
  breed?: string;
  size: "small" | "medium" | "large";
  gender: "male" | "female";
  temperament?: string;
  notes?: string;
}

export interface WatchNeed extends RecordModel {
  user: string;
  dog: string;
  start_date: string;
  end_date: string;
  notes?: string;
}

export interface WatchCapacity extends RecordModel {
  user: string;
  start_date: string;
  end_date: string;
  dog_sizes: "small" | "medium" | "large" | "any";
  dog_genders: "male" | "female" | "any";
  max_dogs: number;
  notes?: string;
}
