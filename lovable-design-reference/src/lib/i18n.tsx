import { createContext, ReactNode, useContext, useState } from "react";

export type Language = "sv" | "en";

const translations = {
  sv: {
    // Header
    "app.subtitle": "Biljettmarknad för studenter",
    "header.postTicket": "SÄLJ/BYT BILJETT",
    // Search
    "search.placeholder": "Sunwing, Yran, Spexet...",
    "filter.all": "Alla",
    "filter.buy": "Säljs",
    "filter.trade": "Byts",
    "filter.want": "Sökes",
    "filter.nation": "Nation/arrangör:",
    "sort.newest": "Nyast",
    "sort.oldest": "Äldst",
    "sort.cheapest": "Billigast",
    "sort.relevant": "Relevanta",
    // Trending
    "trending.label": "Trendande",
    // Listings
    "listings.count": "biljetter ute nu",
    "listings.countSingle": "biljett ute nu",
    "listings.noResults": "Inga annonser hittades",
    "listings.noResultsSub": "Prova en annan sökning eller bli den första att lägga upp!",
    "listings.sold": "SÅLD",
    "listing.sell": "Säljes",
    "listing.trade": "Byt",
    "listing.want": "Sökes",
    "listing.sellOrTrade": "Sälj/Byt",
    "listing.contact": "Kontakta",
    "listing.copyContact": "Kopiera kontaktinfo",
    "listing.copied": "Kopierat!",
    "listing.description": "Beskrivning",
    "listing.details": "Detaljer",
    "listing.ticketType": "Biljetttyp",
    "listing.quantity": "Antal",
    "listing.price": "Pris",
    "listing.tradeFor": "Byt mot",
    "listing.contactMethod": "Kontaktmetod",
    "listing.posted": "Upplagd",
    "listing.markSold": "Markera som såld",
    "listing.share": "Dela",
    "listing.avgPrice": "Snittspris",
    "listing.wantDescription": "Söker biljetter till",
    // Create
    "create.title": "Skapa annons",
    "create.eventName": "Evenemangsnamn",
    "create.ticketType": "Biljetttyp",
    "create.quantity": "Antal",
    "create.dealType": "Annonstyp",
    "create.price": "Pris (SEK)",
    "create.tradeDesc": "Vad vill du ha?",
    "create.description": "Beskrivning",
    "create.contactMethod": "Kontaktmetod",
    "create.contactInfo": "Kontaktinfo",
    "create.nation": "Nation/Organisation",
    "create.publish": "Publicera annons",
    "create.missingFields": "Saknade fält",
    "create.missingFieldsDesc": "Fyll i alla obligatoriska fält.",
    "create.success": "Annons skapad! 🎉",
    // Profile
    "profile.title": "Min profil",
    "profile.activeListings": "Aktiva annonser",
    "profile.soldListings": "Sålda annonser",
    "profile.joined": "Medlem sedan",
    "profile.myTickets": "Mina biljetter",
    "profile.noListings": "Inga annonser än",
    // Matching
    "matching.title": "Möjliga matchningar",
    "matching.badge": "Match!",
    "matching.ticketsIHave": "Biljetter jag har",
    "matching.addTicket": "Sälj/byt biljett",
    "matching.noMatches": "Inga matchningar hittades",
    // Theme
    "theme.dark": "Mörkt läge",
    "theme.light": "Ljust läge",
    // Watchlist
    "watchlist.watch": "Bevaka",
    "watchlist.watching": "Bevakar",
    "watchlist.newListing": "Ny annons",
    "watchlist.newListingDesc": "matchar din bevakning!",
  },
  en: {
    "app.subtitle": "Student ticket marketplace",
    "header.postTicket": "POST TICKET",
    "search.placeholder": "Sunwing, Yran, Spexet...",
    "filter.all": "All",
    "filter.buy": "For sale",
    "filter.trade": "Trade",
    "filter.want": "Wanted",
    "filter.nation": "Nation/organizer:",
    "sort.newest": "Newest",
    "sort.oldest": "Oldest",
    "sort.cheapest": "Cheapest",
    "sort.relevant": "Relevant",
    "trending.label": "Trending",
    "listings.count": "tickets available",
    "listings.countSingle": "ticket available",
    "listings.noResults": "No listings found",
    "listings.noResultsSub": "Try a different search or be the first to post!",
    "listings.sold": "SOLD",
    "listing.sell": "Sell",
    "listing.trade": "Trade",
    "listing.want": "Wanted",
    "listing.sellOrTrade": "Sell/Trade",
    "listing.contact": "Contact",
    "listing.copyContact": "Copy contact info",
    "listing.copied": "Copied!",
    "listing.description": "Description",
    "listing.details": "Details",
    "listing.ticketType": "Ticket type",
    "listing.quantity": "Quantity",
    "listing.price": "Price",
    "listing.tradeFor": "Trade for",
    "listing.contactMethod": "Contact method",
    "listing.posted": "Posted",
    "listing.markSold": "Mark as sold",
    "listing.share": "Share",
    "listing.avgPrice": "Avg price",
    "listing.wantDescription": "Looking for tickets to",
    "create.title": "Create Listing",
    "create.eventName": "Event Name",
    "create.ticketType": "Ticket Type",
    "create.quantity": "Quantity",
    "create.dealType": "Listing Type",
    "create.price": "Price (SEK)",
    "create.tradeDesc": "What do you want?",
    "create.description": "Description",
    "create.contactMethod": "Contact Method",
    "create.contactInfo": "Contact Info",
    "create.nation": "Nation/Organization",
    "create.publish": "Publish Listing",
    "create.missingFields": "Missing fields",
    "create.missingFieldsDesc": "Please fill in all required fields.",
    "create.success": "Listing created! 🎉",
    "profile.title": "My Profile",
    "profile.activeListings": "Active Listings",
    "profile.soldListings": "Sold Listings",
    "profile.joined": "Joined",
    "profile.myTickets": "My Tickets",
    "profile.noListings": "No listings yet",
    "matching.title": "Possible Matches",
    "matching.badge": "Match!",
    "matching.ticketsIHave": "Tickets I Have",
    "matching.addTicket": "Add ticket",
    "matching.noMatches": "No matches found",
    "theme.dark": "Dark mode",
    "theme.light": "Light mode",
    "watchlist.watch": "Watch",
    "watchlist.watching": "Watching",
    "watchlist.newListing": "New listing",
    "watchlist.newListingDesc": "matches your watchlist!",
  },
} as const;

type TranslationKey = keyof typeof translations.en;

interface I18nContextType {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextType>({
  lang: "sv",
  setLang: () => {},
  t: (key) => key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    return (localStorage.getItem("fk-lang") as Language) || "sv";
  });

  const setLang = (l: Language) => {
    setLangState(l);
    localStorage.setItem("fk-lang", l);
  };

  const t = (key: TranslationKey): string => {
    return translations[lang][key] || key;
  };

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
