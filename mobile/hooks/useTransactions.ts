import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type Tx = {
  id: string;
  valueCents: number;
  type: "debit" | "credit";
  bookedAt: string;                // ISO
  merchant?: string;
  description?: string;
  category?: { name: string; color?: string } | null;
};

export function useTransactions() {
  return useQuery<Tx[]>({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data } = await api.get("/transactions");
      return data as Tx[];
    },
    staleTime: 30_000,
  });
}