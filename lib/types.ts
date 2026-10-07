export type LineItem = {
  name: string;
  amount: number;
};

export type Receipt = {
  id: string;
  imageUrl?: string;
  merchant: string;
  purchaseDate: string;
  total: number;
  currency: string;
  lineItems: LineItem[];
  categorySuggestion: string;
  createdAt: string;
  rawText: string;
};
