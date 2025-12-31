export type BookerLevel = 'junior' | 'senior' | 'manager';
export type UserRole = 'booker' | 'salesman';
export type UserStatus = 'active' | 'inactive';

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: UserRole;
  level: BookerLevel;
  maxDiscountPercent: number;  // Max allowed discount percentage
  maxDiscountAmount: number;   // Max discount amount per order (Rs.)
  status: UserStatus;
  avatar?: string;
  regionId: string; // Region assignment (required)
  branch?: string; // Branch assignment (from KPO)
  area?: string; // Specific area for bookers and salesmen (optional, deprecated in favor of branch)
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
}
