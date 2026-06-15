import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, X, Minus } from "lucide-react";
import { KARNEVAL_SHOWS, KARNEVAL_DAYS, KARNEVAL_TIMES, KarnevalDay } from "@/lib/eventCalendar";
import { NATIONS, getNation } from "@/lib/nations";
import { Listing } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { getEventOptions, EventOption } from "@/lib/eventOptions";
import { createListing } from "@/lib/listings";
import EventCombobox from "@/components/EventCombobox";
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_EXCHANGE_EVENT_LENGTH,
  MAX_EXCHANGE_OPTIONS,
  MAX_LISTING_QUANTITY,
  looksLikeSpam,
} from "@/lib/contentRules";

interface CreateListingDialogProps {
  onCreateListing: (listing: Listing) => void;
}

const FORKOP_OPTION: EventOption = {
  id: "forkop",
  label: "Förköp",
  nationId: "",
  nationName: "",
  category: "other",
  requiresTicket: true,
};

export default function CreateListingDialog({ onCreateListing }: CreateListingDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<EventOption | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [eventSearchFocused, setEventSearchFocused] = useState(false);
  const [customEventName, setCustomEventName] = useState("");
  const [customNationId, setCustomNationId] = useState("");

  const [karnevalShow, setKarnevalShow] = useState("");
  const [karnevalDay, setKarnevalDay] = useState<KarnevalDay | "">("");
  const [karnevalTime, setKarnevalTime] = useState("");

  const [quantity, setQuantity] = useState(1);
  const [wantsSell, setWantsSell] = useState(true);
  const [wantsExchange, setWantsExchange] = useState(false);
  // Multi-row trade targets
  const [exchangeRows, setExchangeRows] = useState<{ event: string; qty: number }[]>([
    { event: "", qty: 1 },
  ]);
  const [description, setDescription] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);

  const allEvents = useMemo(() => [...getEventOptions(), FORKOP_OPTION], []);

  const filteredEvents = useMemo(() => {
    if (!searchQuery.trim()) {
      const featured = [
        ...allEvents.filter((event) => event.category !== "karneval").slice(0, 4),
        ...allEvents.filter((event) => event.category === "karneval").slice(0, 5),
      ];
      return featured.slice(0, 9);
    }
    const q = searchQuery.toLowerCase();
    return allEvents
      .filter((e) => e.label.toLowerCase().includes(q) || e.nationName.toLowerCase().includes(q))
      .slice(0, 10);
  }, [searchQuery, allEvents]);

  const isForkop = selectedEvent?.id === FORKOP_OPTION.id;

  const resolvedEvent = useMemo(() => {
    if (selectedEvent) {
      if (selectedEvent.id === FORKOP_OPTION.id) {
        if (!customNationId) return null;
        const nation = getNation(customNationId);
        return {
          name: selectedEvent.label,
          nationId: nation.id,
          nationName: nation.name,
          category: "other" as const,
        };
      }
      if (selectedEvent.category === "karneval" && karnevalShow) {
        const show = KARNEVAL_SHOWS.find((s) => s.id === karnevalShow);
        return {
          name: show?.name || selectedEvent.label,
          nationId: "karneval",
          nationName: "Lundakarnevalen",
          category: "karneval" as const,
        };
      }
      return {
        name: selectedEvent.label,
        nationId: selectedEvent.nationId,
        nationName: selectedEvent.nationName,
        category: selectedEvent.category,
      };
    }
    if (customEventName) {
      const nation = getNation(customNationId || "other");
      return { name: customEventName, nationId: nation.id, nationName: nation.name, category: "other" as const };
    }
    return null;
  }, [selectedEvent, karnevalShow, customEventName, customNationId]);

  const isKarneval = selectedEvent?.category === "karneval" || selectedEvent?.id === "karneval-2026";

  const reset = () => {
    setSearchQuery("");
    setSelectedEvent(null);
    setShowResults(false);
    setEventSearchFocused(false);
    setCustomEventName("");
    setCustomNationId("");
    setKarnevalShow("");
    setKarnevalDay("");
    setKarnevalTime("");
    setQuantity(1);
    setWantsSell(true);
    setWantsExchange(false);
    setExchangeRows([{ event: "", qty: 1 }]);
    setDescription("");
  };

  // Map a karneval event id like "karneval-spexet" to a show id "spexet"
  const showIdFromEvent = (ev: EventOption | null): string => {
    if (!ev || ev.category !== "karneval") return "";
    const m = ev.id.match(/^karneval-([a-z]+)/);
    if (!m) return "";
    return KARNEVAL_SHOWS.some((s) => s.id === m[1]) ? m[1] : "";
  };

  const handleSelectEvent = (ev: EventOption) => {
    setSelectedEvent(ev);
    setSearchQuery(ev.label);
    setShowResults(false);
    setEventSearchFocused(false);
    setCustomEventName("");
    setCustomNationId("");
    if (ev.category === "karneval") {
      // Auto-select the matching show; user only needs to pick day + time
      setKarnevalShow(showIdFromEvent(ev));
      setKarnevalDay("");
      setKarnevalTime("");
    } else {
      setKarnevalShow("");
      setKarnevalDay("");
      setKarnevalTime("");
    }
  };

  const handleClearEvent = () => {
    setSelectedEvent(null);
    setSearchQuery("");
    setEventSearchFocused(false);
    setCustomEventName("");
    setCustomNationId("");
    setKarnevalShow("");
    setKarnevalDay("");
    setKarnevalTime("");
  };

  const handleOpenChange = (next: boolean) => {
    if (next && !user) {
      navigate("/auth");
      return;
    }
    setOpen(next);
    if (!next) reset();
  };

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) {
        setEventSearchFocused(false);
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Available time slots for the chosen show + day
  const availableTimes = (karnevalShow && karnevalDay && KARNEVAL_TIMES[karnevalShow]?.[karnevalDay]) || [];
  const requiresKarnevalTime = availableTimes.length > 0;

  // Helpers for multi-row exchange
  const addExchangeRow = () => {
    if (exchangeRows.length >= MAX_EXCHANGE_OPTIONS) {
      toast({
        title: sv ? "Max antal nått" : "Maximum reached",
        description: sv
          ? `Du kan lägga till högst ${MAX_EXCHANGE_OPTIONS} bytesalternativ.`
          : `You can add up to ${MAX_EXCHANGE_OPTIONS} trade options.`,
        variant: "destructive",
      });
      return;
    }
    setExchangeRows((rows) => [...rows, { event: "", qty: 1 }]);
  };
  const removeExchangeRow = (i: number) =>
    setExchangeRows((rows) => (rows.length > 1 ? rows.filter((_, idx) => idx !== i) : rows));
  const updateExchangeRow = (i: number, patch: Partial<{ event: string; qty: number }>) =>
    setExchangeRows((rows) =>
      rows.map((r, idx) => {
        if (idx !== i) return r;
        return {
          ...r,
          ...patch,
          event: patch.event !== undefined ? patch.event.slice(0, MAX_EXCHANGE_EVENT_LENGTH) : r.event,
          qty: patch.qty !== undefined ? Math.max(0, Math.min(MAX_LISTING_QUANTITY, patch.qty || 0)) : r.qty,
        };
      }),
    );

  const handleSubmit = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    if (isForkop && !customNationId) {
      toast({
        title: t("create.missingFields"),
        description: lang === "sv" ? "Välj nation eller arrangör för förköpet" : "Choose nation or organizer for the pre-sale",
        variant: "destructive",
      });
      return;
    }
    if (!resolvedEvent) {
      toast({ title: t("create.missingFields"), description: t("create.missingFieldsDesc"), variant: "destructive" });
      return;
    }
    if (isKarneval && (!karnevalShow || !karnevalDay || (requiresKarnevalTime && !karnevalTime))) {
      toast({
        title: t("create.missingFields"),
        description: lang === "sv"
          ? requiresKarnevalTime
            ? "Välj föreställning, datum och tid"
            : "Välj föreställning och datum"
          : requiresKarnevalTime
            ? "Choose show, date and time"
            : "Choose show and date",
        variant: "destructive",
      });
      return;
    }
    if (!wantsSell && !wantsExchange) {
      toast({
        title: t("create.missingFields"),
        description: sv ? "Välj minst säljes eller bytes" : "Choose at least sell or trade",
        variant: "destructive",
      });
      return;
    }
    if (quantity < 1 || quantity > MAX_LISTING_QUANTITY) {
      toast({
        title: t("create.missingFields"),
        description: sv
          ? `Antal måste vara mellan 1 och ${MAX_LISTING_QUANTITY}.`
          : `Quantity must be between 1 and ${MAX_LISTING_QUANTITY}.`,
        variant: "destructive",
      });
      return;
    }

    // Validate / build trade-target string
    const validRows = exchangeRows
      .map((r) => ({
        event: r.event.trim().slice(0, MAX_EXCHANGE_EVENT_LENGTH),
        qty: Math.max(1, Math.min(MAX_LISTING_QUANTITY, r.qty || 1)),
      }))
      .filter((r) => r.event.length > 0);
    if (validRows.length > MAX_EXCHANGE_OPTIONS) {
      toast({
        title: t("create.missingFields"),
        description: sv
          ? `Du kan ange högst ${MAX_EXCHANGE_OPTIONS} bytesalternativ.`
          : `You can specify up to ${MAX_EXCHANGE_OPTIONS} trade options.`,
        variant: "destructive",
      });
      return;
    }
    if (wantsExchange && validRows.length === 0) {
      toast({
        title: t("create.missingFields"),
        description: lang === "sv" ? "Beskriv vad du vill byta mot" : "Describe what you want to exchange for",
        variant: "destructive",
      });
      return;
    }
    if (description.trim().length > MAX_DESCRIPTION_LENGTH) {
      toast({
        title: t("create.missingFields"),
        description: sv
          ? `Beskrivningen får vara högst ${MAX_DESCRIPTION_LENGTH} tecken.`
          : `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`,
        variant: "destructive",
      });
      return;
    }
    if (description.trim() && looksLikeSpam(description)) {
      toast({
        title: sv ? "Texten ser ut som spam" : "Text looks like spam",
        description: sv
          ? "Kortare och mer normal text fungerar bättre."
          : "Please use shorter, more normal text.",
        variant: "destructive",
      });
      return;
    }
    // Single source of truth: store all rows joined by " + ", quantity = total
    const exchangeSeparator = lang === "sv" ? " eller " : " or ";
    const exchangeEventStr = validRows.map((r) => `${r.qty}x ${r.event}`).join(exchangeSeparator);
    const exchangeQtyTotal = validRows[0]?.qty ?? 1;

    // For karneval: kort format, t.ex. "KABARÉN – FRE 22 MAJ | 16.30"
    const karnevalShortDay: Record<KarnevalDay, { sv: string; en: string }> = {
      fredag: { sv: "FRE 22 MAJ", en: "FRI MAY 22" },
      lordag: { sv: "LÖR 23 MAJ", en: "SAT MAY 23" },
      sondag: { sv: "SÖN 24 MAJ", en: "SUN MAY 24" },
    };
    const finalEventName = isKarneval
      ? `${resolvedEvent.name.toUpperCase()} – ${karnevalShortDay[karnevalDay as KarnevalDay]?.[lang] ?? ""}${requiresKarnevalTime ? ` | ${karnevalTime}` : ""}`
      : resolvedEvent.name;

    setSubmitting(true);
    try {
      const created = await createListing(user.id, {
        event_name: finalEventName,
        nation: resolvedEvent.nationId,
        category: resolvedEvent.category,
        quantity,
        wants_sell: wantsSell,
        wants_exchange: wantsExchange,
        exchange_event: wantsExchange ? exchangeEventStr : null,
        exchange_quantity: wantsExchange ? exchangeQtyTotal : null,
        original_price: null,
        description: description.trim() || null,
      });
      onCreateListing(created);
      toast({ title: t("create.success"), description: finalEventName });
      setOpen(false);
      reset();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const sv = lang === "sv";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="default"
          className="warm-accent-shadow gap-2 border border-[#e39e72]/35 bg-[#ffc8a5] font-display font-semibold text-foreground hover:border-[#e39e72]/55 hover:bg-[#f4b88f] dark:border-[#e39e72]/45 dark:bg-[#e39e72] dark:text-white dark:hover:border-[#e39e72]/70 dark:hover:bg-[#cf885c]"
        >
          <Plus className="h-4 w-4" /> {t("header.postTicket")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{t("create.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {/* Event search */}
          <div ref={searchRef} className="relative">
            <Label>{sv ? "Evenemang" : "Event"} *</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowResults(true);
                  setSelectedEvent(null);
                }}
                onFocus={() => {
                  setEventSearchFocused(true);
                  setShowResults(true);
                }}
                onBlur={(e) => {
                  const nextTarget = e.relatedTarget as Node | null;
                  if (!searchRef.current?.contains(nextTarget)) {
                    setEventSearchFocused(false);
                    setShowResults(false);
                  }
                }}
                placeholder={sv ? "Sök event, t.ex. Sunwing..." : "Search event, e.g. Sunwing..."}
                className="pl-9 pr-9"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearEvent}
                  className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            {eventSearchFocused && showResults && !selectedEvent && (
              <div
                className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto overscroll-contain rounded-md border border-border bg-popover shadow-lg touch-pan-y"
                onWheel={(e) => e.stopPropagation()}
              >
                {filteredEvents.length > 0 ? (
                  filteredEvents.map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSelectEvent(ev)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex justify-between items-center"
                    >
                      <span className="font-medium">{ev.label}</span>
                      <span className="text-xs text-muted-foreground">{ev.nationName}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    {sv ? "Inga resultat — skriv eget nedan" : "No results — enter custom below"}
                  </div>
                )}
                {searchQuery.trim() &&
                  !filteredEvents.some((e) => e.label.toLowerCase() === searchQuery.toLowerCase()) && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setCustomEventName(searchQuery.trim());
                        setSelectedEvent(null);
                        setShowResults(false);
                        setEventSearchFocused(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors border-t border-border text-muted-foreground"
                    >
                      +{" "}
                      {sv
                        ? `Skapa "${searchQuery.trim()}" som eget event`
                        : `Create "${searchQuery.trim()}" as custom event`}
                    </button>
                  )}
              </div>
            )}
          </div>

          {selectedEvent && (
            <div className="pt-1">
              <h3 className="font-display text-lg font-semibold">{selectedEvent.label}</h3>
              {!isForkop && <p className="text-sm text-muted-foreground">{selectedEvent.nationName}</p>}
            </div>
          )}

          {isForkop && (
            <div>
              <Label>{sv ? "Nation/arrangör" : "Nation/organizer"} *</Label>
              <Select value={customNationId} onValueChange={setCustomNationId}>
                <SelectTrigger>
                  <SelectValue placeholder={sv ? "Välj nation eller arrangör..." : "Choose nation or organizer..."} />
                </SelectTrigger>
                <SelectContent>
                  {NATIONS.filter((n) => n.id !== "stadsparken").map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!selectedEvent && customEventName && (
            <>
              <div className="rounded-lg bg-muted/50 border border-border px-3 py-2 text-sm">
                <span className="font-medium">{customEventName}</span>
                <span className="text-muted-foreground"> · {sv ? "Eget event" : "Custom event"}</span>
              </div>
              <div>
                <Label>{t("create.nation")}</Label>
                <Select value={customNationId} onValueChange={setCustomNationId}>
                  <SelectTrigger>
                    <SelectValue placeholder={sv ? "Välj nation..." : "Choose nation..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {NATIONS.map((n) => (
                      <SelectItem key={n.id} value={n.id}>
                        {n.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {isKarneval && !showIdFromEvent(selectedEvent) && (
            <div>
              <Label>{sv ? "Föreställning" : "Show"} *</Label>
              <Select value={karnevalShow} onValueChange={setKarnevalShow}>
                <SelectTrigger>
                  <SelectValue placeholder={sv ? "Välj föreställning..." : "Choose show..."} />
                </SelectTrigger>
                <SelectContent>
                  {KARNEVAL_SHOWS.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {sv ? s.sv : s.en}
                      {s.duration ? ` (${s.duration})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {isKarneval && (
            <>
              {karnevalShow && (
                <div>
                  <Label>{sv ? "Datum" : "Date"} *</Label>
                  <Select
                    value={karnevalDay}
                    onValueChange={(v) => {
                      setKarnevalDay(v as KarnevalDay);
                      setKarnevalTime("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={sv ? "Välj datum..." : "Choose date..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {KARNEVAL_DAYS.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {sv ? d.sv : d.en}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {karnevalShow && karnevalDay && availableTimes.length > 0 && (
                <div>
                  <Label>{sv ? "Tid" : "Time"} *</Label>
                  <Select value={karnevalTime} onValueChange={setKarnevalTime}>
                    <SelectTrigger>
                      <SelectValue placeholder={sv ? "Välj tid..." : "Choose time..."} />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {availableTimes.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          {/* Quantity */}
          <div>
            <Label>{t("create.quantity")}</Label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setQuantity(n)}
                  className={`h-9 w-9 rounded-md border text-sm font-medium transition-colors ${
                    quantity === n
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border bg-background text-foreground hover:bg-accent"
                  }`}
                >
                  {n}
                </button>
              ))}
              <Input
                type="number"
                min={5}
                max={MAX_LISTING_QUANTITY}
                value={quantity > 4 ? quantity : ""}
                onChange={(e) =>
                  setQuantity(Math.min(MAX_LISTING_QUANTITY, Math.max(1, Number(e.target.value) || 1)))
                }
                placeholder="5-99"
                className="w-16 h-9 text-center"
              />
            </div>
          </div>

          {/* Annonstyp: Säljes / Bytes (kan kombineras) */}
          <div className="space-y-2">
            <Label>{sv ? "Annonstyp (en eller båda)" : "Listing type"} *</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setWantsSell((v) => !v)}
                className={`h-11 rounded-md border text-sm font-semibold transition-colors ${
                  wantsSell
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border bg-background text-foreground hover:bg-accent"
                }`}
              >
                {sv ? "Säljes" : "For sale"}
              </button>
              <button
                type="button"
                onClick={() => setWantsExchange((v) => !v)}
                className={`h-11 rounded-md border text-sm font-semibold transition-colors ${
                  wantsExchange
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border bg-background text-foreground hover:bg-accent"
                }`}
              >
                {sv ? "Bytes" : "For trade"}
              </button>
            </div>

            {wantsExchange && (
              <div className="space-y-2 pt-1">
                <Label className="text-xs">{sv ? "Vill byta mot (ett eller flera alternativ)" : "Trade for (one or more alternatives)"} *</Label>
                {exchangeRows.map((row, i) => (
                  <div key={i} className="grid grid-cols-[1fr_4.5rem_2rem] gap-2 items-end">
                    <EventCombobox
                      value={row.event}
                      onChange={(v) => updateExchangeRow(i, { event: v })}
                      placeholder={sv ? "T.ex. Sunwing, Yran..." : "e.g. Sunwing, Yran..."}
                    />
                    <Input
                      type="number"
                      min={1}
                      max={MAX_LISTING_QUANTITY}
                      value={row.qty === 0 ? "" : row.qty}
                      onChange={(e) =>
                        updateExchangeRow(i, { qty: e.target.value === "" ? 0 : Number(e.target.value) })
                      }
                      onBlur={() => {
                        if (!row.qty || row.qty < 1) updateExchangeRow(i, { qty: 1 });
                      }}
                      placeholder={sv ? "Antal" : "Qty"}
                      className="text-center"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeExchangeRow(i)}
                      disabled={exchangeRows.length === 1}
                      className="h-9 w-9 text-muted-foreground hover:text-destructive"
                      aria-label={sv ? "Ta bort rad" : "Remove row"}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addExchangeRow}
                  className="w-full h-9 rounded-md border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/40 hover:bg-muted/30 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {sv ? "Lägg till alternativ" : "Add option"}
                </button>
              </div>
            )}
          </div>

          {/* Description (optional) */}
          <div>
            <Label>{sv ? "Beskrivning (valfritt)" : "Description (optional)"}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                sv
                  ? "Specificera detaljer, t.ex. tid, plats, sittplats eller särskilda önskemål..."
                  : "Add details, e.g. time, location, seat or special requests..."
              }
              rows={3}
              maxLength={MAX_DESCRIPTION_LENGTH}
              className="resize-none"
            />
          </div>

          <Button onClick={handleSubmit} disabled={submitting} className="w-full font-display font-semibold" size="lg">
            {submitting ? (sv ? "Publicerar..." : "Publishing...") : t("create.publish")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
