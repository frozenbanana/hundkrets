export type Conn = { id?: string; from_user: string; to_user: string; message?: string };

export type DogRecord = {
  id?: string;
  name?: string;
  breed?: string;
  size?: string;
  gender?: string;
  age?: number;
  image?: string;
  notes?: string;
  temperament_new_people?: string;
  temperament_new_dogs_female?: string;
  temperament_new_dogs_male?: string;
};
