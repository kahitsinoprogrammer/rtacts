import { createContext } from "react";

export type User = {
  UserID: string;
  Username: string;
  Email: string;
  FirstName: string;
  MiddleName?: string;
  LastName: string;
};

export const UserContext = createContext<User | null>(null);
