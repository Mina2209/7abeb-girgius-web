export type ClientRole = 'viewer' | 'editor' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  church_name: string;
  church_role: string;
  services: string[];
  avatar_url: string | null;
  created_at: string;
  role: ClientRole;
}

export interface ClientUser {
  id: string;
  email: string;
  username: string;
}

