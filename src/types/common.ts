// Common types used across the app

export type SyncStatus = 'synced' | 'pending' | 'failed';

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SelectOption {
  label: string;
  value: string;
}

// Pakistani Cities and Areas
export const CITIES: SelectOption[] = [
  { label: 'Lahore', value: 'lahore' },
  { label: 'Karachi', value: 'karachi' },
  { label: 'Islamabad', value: 'islamabad' },
  { label: 'Rawalpindi', value: 'rawalpindi' },
  { label: 'Faisalabad', value: 'faisalabad' },
  { label: 'Multan', value: 'multan' },
  { label: 'Peshawar', value: 'peshawar' },
  { label: 'Quetta', value: 'quetta' },
];

export const AREAS: Record<string, SelectOption[]> = {
  lahore: [
    { label: 'Gulberg', value: 'gulberg' },
    { label: 'DHA', value: 'dha' },
    { label: 'Model Town', value: 'model_town' },
    { label: 'Johar Town', value: 'johar_town' },
    { label: 'Garden Town', value: 'garden_town' },
    { label: 'Cantt', value: 'cantt' },
  ],
  karachi: [
    { label: 'DHA', value: 'dha' },
    { label: 'Clifton', value: 'clifton' },
    { label: 'Gulshan-e-Iqbal', value: 'gulshan' },
    { label: 'Saddar', value: 'saddar' },
    { label: 'North Nazimabad', value: 'north_nazimabad' },
    { label: 'PECHS', value: 'pechs' },
  ],
  islamabad: [
    { label: 'F-6', value: 'f6' },
    { label: 'F-7', value: 'f7' },
    { label: 'F-8', value: 'f8' },
    { label: 'G-9', value: 'g9' },
    { label: 'I-8', value: 'i8' },
    { label: 'Blue Area', value: 'blue_area' },
  ],
  rawalpindi: [
    { label: 'Saddar', value: 'saddar' },
    { label: 'Satellite Town', value: 'satellite_town' },
    { label: 'Bahria Town', value: 'bahria_town' },
    { label: 'Chaklala', value: 'chaklala' },
  ],
  faisalabad: [
    { label: 'D Ground', value: 'd_ground' },
    { label: 'Peoples Colony', value: 'peoples_colony' },
    { label: 'Madina Town', value: 'madina_town' },
  ],
  multan: [
    { label: 'Cantt', value: 'cantt' },
    { label: 'Bosan Road', value: 'bosan_road' },
    { label: 'Gulgasht Colony', value: 'gulgasht' },
  ],
  peshawar: [
    { label: 'University Town', value: 'university_town' },
    { label: 'Hayatabad', value: 'hayatabad' },
    { label: 'Saddar', value: 'saddar' },
  ],
  quetta: [
    { label: 'Cantt', value: 'cantt' },
    { label: 'Satellite Town', value: 'satellite_town' },
  ],
};

