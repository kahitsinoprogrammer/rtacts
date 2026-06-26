import { createContext } from "react";

export type User = {
  UserID: string;
  Username: string;
  Email: string;
  FirstName: string;
  MiddleName?: string;
  LastName: string;
  UserType?: string;
  CompanyId?: string;
  user_type?: string;
  company_id?: string;
};

export const UserContext = createContext<User | null>(null);
