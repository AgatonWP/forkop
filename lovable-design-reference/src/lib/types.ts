export type DealType = 'sell' | 'trade' | 'both';

/** A single trade-target row: "I want N tickets to event X" */
export interface ExchangeOption {
  eventName: string;
  quantity: number;
}

export interface Listing {
  id: string;
  eventName: string;
  ticketType: string;
  quantity: number;
  dealType: DealType;
  price?: number;
  tradeDescription?: string;
  /** Optional structured exchange target (event name from catalog) */
  exchangeEventName?: string;
  exchangeQuantity?: number;
  /** Optional list of additional trade targets (multi-row) */
  exchangeOptions?: ExchangeOption[];
  description: string;
  contactMethod: string;
  contactInfo: string;
  createdAt: Date;
  isHot?: boolean;
  isSold?: boolean;
  nationId: string;
  sellerName?: string;
}
