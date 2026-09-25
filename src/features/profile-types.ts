export type ProfileWithAvatar = {
  id: string;
  full_name: string;
  phone_number: string;
  email: string | null;
  role: string;
  avatar_url?: string | null;
  technician_specialty?: string | null;
};
