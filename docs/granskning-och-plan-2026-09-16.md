# Förköp – granskning och prioriterad plan (2026-09-16)

Skriven efter en genomgång av hela appkoden, alla migrationer, en read-only-probe
mot Supabase-projektet appen pekar på (som `anon`, alltså utloggad användare)
och en genomläsning av konkurrenten studentbiljetter.se. Ingen kod ändrades.
Dokumentet är skrivet så att en annan modell kan genomföra punkterna en i taget.

**Arbetsregler för den som genomför:**
- Gör en punkt i taget, i den ordning de står. Kör `npx tsc --noEmit` och
  `npx eslint src` efter varje punkt.
- Ändra aldrig en SQL-migration som redan är körd i Supabase. Skriv en ny fil
  med nytt tidsstämpelnamn i `supabase/migrations/`.
- Inget råt fel från Supabase/Postgres får någonsin sättas i ett state som
  visas för användaren. Mönstret som ska följas finns i
  `src/lib/payment-details.ts` (egen felkod → översatt text i `src/lib/i18n.tsx`).
- Alla texter användaren ser går via `t('...')` med både `sv` och `en`.

---

## 0. Kortversion

| # | Vad | Varför nu |
|---|-----|-----------|
| 1 | Översätt alla auth-fel och annons-fel till svenska via felkoder (avsnitt 1) | Mest troliga orsaken till "konstigt fel" igår. Sex ställen visar råa engelska/Postgres-meddelanden. |
| 2 | Höj Supabases e-postgräns och kolla Auth-loggen för igår (avsnitt 1.1) | Standardgränsen är 30 mejl/timme även med Resend. En lanseringsdag räcker inte det. |
| 3 | Lägg in krashrapportering + felgräns (avsnitt 1.5) | Idag finns ingen möjlighet att veta vad användare faktiskt ser. |
| 4 | Säkerhet P0 (avsnitt 2): rotera läckta nycklar, granska legacy-tabellen `profiles`, sätt gräns på antal annonser och textlängder | Billiga åtgärder, hög nedsida om de missas. |
| 5 | Kör bevaknings-SQL:en, bygg 1.0.3, committa allt (avsnitt 5) | Bevakningar, Google/Apple-inloggning, nationskonton ligger klara men olevererade. |
| 6 | Distribution: Android + webbversion på forkoplund.se med SEO-sidor (avsnitt 4) | Konkurrenten vinner på Google-sök och Facebook-delning; vi vinner på app + push. Vi behöver båda. |

---

## Status 2026-09-16 (kod genomförd)

Genomfört i koden, testat och redo att byggas:

- **1.1–1.3 Felmeddelanden.** `src/lib/auth-errors.ts` översätter varje
  auth-fel via `error.code`; `src/lib/tickets.ts` gör detsamma för annonser
  via SQLSTATE. Inget `error.message` når längre användaren i
  `explore.tsx`, `settings.tsx`, `reset-password.tsx`, `messages.tsx`,
  `sell.tsx` eller `admin.tsx`. Verifierat mot skarpa Supabase: fel lösenord
  ger nu "Fel e-post eller lösenord." i stället för "Invalid login
  credentials". Registrering kräver 8 tecken i klienten med synlig hjälptext,
  så Supabases engelska lösenordsfel aldrig hinner uppstå.
- **1.4 Chattens gränser.** Rategräns (P0001) och "för många nya chattar"
  (23W05) visas som egna, översatta texter.
- **1.5 Felgräns.** `src/components/error-boundary.tsx` ersätter vit/röd
  skärm med en svensk sida och en "Försök igen"-knapp. Den använder medvetet
  inga providers, så den överlever även en krasch i en provider.
  *Sentry återstår – kräver konto och DSN, se "Kvar till dig".*
- **2/S3 Gränser.** `supabase/migrations/20260916120000_content_limits.sql`:
  längdgränser på alla fritextfält, max 5 annonser/10 min, max 30 aktiva
  annonser (100 för verifierade nationer), max 10 rapporter/dygn, max 20 nya
  chattar/timme. 21/21 tester i PGlite, körbar flera gånger, kraschar inte på
  gamla rader. Motsvarande `maxLength` finns i formulären.
- **2/P2 Anon-åtkomst.** `supabase/migrations/20260916130000_restrict_anon_access.sql`
  tar bort utloggades läsrättighet på allt utom `listings` och
  `verified_organizers`.
- **2/S6 Profilbilder.** Skalas om till 512 px JPEG i appen före uppladdning
  (~40–80 kB i stället för 50–500 kB), EXIF/GPS försvinner, en publik
  SVG-uppladdning är inte längre möjlig, och gamla filer med annan filändelse
  städas bort. Bandbredden är den verkliga kostnaden: en avatar hämtas på
  varje annonskort.
- **2/S2 (delvis).** `contact_method`/`contact_info` läses inte längre av
  appen, vilket är förutsättningen för att kunna droppa kolumnerna.
- **Integritetspolicyn** nämner nu Resend, Apple/Google-inloggning och
  bevakningar, på svenska och engelska.

Kvar i koden (medvetet ej gjort nu, kräver test på riktig enhet eller ditt beslut):
**S5 nonce**, **Sentry**, **S2 kolumndropp**, **Expo push access token**,
**expo-secure-store för sessionen**, och hela avsnitt 4 (Android, webb, SEO).

---

## 1. Varför användare ser konstiga felmeddelanden

### 1.1 Inloggning/registrering visar Supabases råa engelska text (troligast igår)

`src/app/(tabs)/explore.tsx:192` och `:238` gör
`setAuthError(error instanceof Error ? error.message : ...)`, och
`src/lib/auth.tsx` kastar `new Error(error.message)` rakt igenom för
`signIn`, `signUp`, `resetPasswordForEmail` och `signOut`. Det betyder att en
användare kan få se t.ex.:

- `Invalid login credentials`
- `Email not confirmed`
- `User already registered`
- `Password should be at least 6 characters.` (det finns ingen klientkontroll av
  lösenordslängd vid registrering, så detta träffas ofta)
- `email rate limit exceeded` / `Error sending confirmation email`
- `For security purposes, you can only request this after 59 seconds.`
- `Unable to validate email address: invalid format`

**Extra misstanke om igår:** Supabase Auth har en egen gräns för antal
utskickade mejl per timme (standard 30) som gäller *även* med egen SMTP via
Resend. Om fler än ~30 personer registrerade sig eller bad om lösenordslänk
inom en timme fick resten `email rate limit exceeded` rakt i ansiktet.

**Att göra (du själv, i Supabase Dashboard):**
1. Logs → Auth Logs, filtrera på gårdagens datum och status 4xx/5xx. Där syns
   exakt vilket fel användaren fick.
2. Authentication → Rate Limits → höj "Rate limit for sending emails" till
   minst 200/timme (Resend klarar det). Höj även "sign ups and sign ins" om
   den ligger nära standard.

**Att göra (kod):** skapa `src/lib/auth-errors.ts` med en funktion
`describeAuthError(error: unknown, t): string` som mappar på **`error.code`**
(finns på `AuthApiError` i supabase-js 2.108, aldrig på texten):

| `error.code` | Svensk text (ny i18n-nyckel) |
|---|---|
| `invalid_credentials` | Fel e-post eller lösenord. |
| `email_not_confirmed` | Du behöver bekräfta din e-post först. Kolla inkorgen (och skräpposten). |
| `user_already_exists` | Det finns redan ett konto med den e-postadressen. Logga in i stället. |
| `weak_password` | Lösenordet måste vara minst 6 tecken. |
| `email_address_invalid`, `validation_failed` | Det ser inte ut som en giltig e-postadress. |
| `over_email_send_rate_limit` | Vi har skickat många mejl just nu. Vänta en stund och försök igen. |
| `over_request_rate_limit` | För många försök. Vänta en minut och försök igen. |
| `same_password` | Det nya lösenordet måste skilja sig från det gamla. |
| `otp_expired` | Länken har gått ut. Be om en ny. |
| allt annat | Något gick fel. Försök igen. (befintlig `authGenericError`) |

Ändra `auth.tsx` så att alla `throw new Error(error.message)` i stället kastar
själva `AuthError`-objektet (så koden följer med), och låt `explore.tsx`,
`settings.tsx:149` (lösenordsbyte) och `reset-password.tsx:59` visa
`describeAuthError(...)`. Lägg också in klientkontroll: registreringsknappen
inaktiv tills lösenordet är ≥ 6 tecken, med hjälptext.

**Acceptans:** ingen väg från `supabase.auth.*` till skärmen passerar
`error.message`. Testa: fel lösenord, okänd e-post, dubbelregistrering,
5-teckenslösenord, "glömt lösenord" två gånger snabbt.

### 1.2 Lägg upp annons visar rå Postgres-text

`src/app/(tabs)/sell.tsx:219` gör `setSubmitError(error.message)`. Det kan visa
`new row violates row-level security policy for table "listings"` (t.ex. om
sessionen hunnit gå ut), `value too long...`, eller framtida check-constraints.

**Att göra:** mappa på `error.code`: `42501` → "Du verkar ha blivit utloggad.
Logga in igen och försök på nytt.", `23514`/`22001` → "Något i annonsen gick
inte att spara. Kontrollera texterna och försök igen.", övrigt → generiskt
"Kunde inte lägga upp annonsen. Försök igen." Lägg funktionen i
`src/lib/tickets.ts` (`describeListingError`) så den kan återanvändas.

### 1.3 Övriga ställen med `error.message` mot användare

| Fil:rad | Fel som kan läcka | Åtgärd |
|---|---|---|
| `src/app/(tabs)/messages.tsx:83` | PostgREST-/nätverkstext vid hämtning av inkorg | Alltid `t('messagesFetchError')` |
| `src/app/reset-password.tsx:59` | `New password should be different...` | `describeAuthError` |
| `src/app/settings.tsx:149` | samma | `describeAuthError` |
| `src/app/(tabs)/index.tsx:321` | text från `registerForPushNotifications` – redan svenska, OK | – |
| `src/app/admin.tsx:59,140,155` | rå text, men bara för admin | Lägre prio, men gör samma sak när du ändå är där |

Alla 45 `throw new Error(error.message)` i `src/lib/*` är OK **så länge**
anroparen fångar och visar en översatt text – det gör alla utom de i tabellen
ovan. Håll regeln: lib kastar, skärmen översätter.

### 1.4 Chattens rategräns döljs bakom ett generiskt fel

`enforce_message_rate_limit()` i databasen kastar redan bra svenska
meddelanden ("Du skickar meddelanden för snabbt…"), men `chat-modal.tsx:240`
visar alltid `chatSendError`. Låt chatten visa databasens text när
`error.code === 'P0001'` (det är vår egen `raise exception`), annars den
generiska. Låg prio, men gratis förbättring.

### 1.5 Ingen vet vad användarna ser

Det finns varken krashrapportering eller felgräns i appen.

**Att göra:**
1. Lägg till `@sentry/react-native` enligt Expos guide (`npx expo install
   @sentry/react-native`, plugin i `app.json`, DSN via EAS-env
   `EXPO_PUBLIC_SENTRY_DSN`). Initiera i `src/app/_layout.tsx`. Sätt
   `sendDefaultPii: false`. Kräver ny build.
2. Exportera en `ErrorBoundary` från `src/app/_layout.tsx` (expo-router stödjer
   `export function ErrorBoundary(props)`) som visar en enkel svensk sida:
   "Något gick fel" + knapp "Försök igen" (`props.retry`). Rapportera till
   Sentry i den.
3. Fånga `unhandledrejection`-fel globalt (Sentry gör det).

**Acceptans:** ett medvetet `throw` i en skärm ger den svenska felsidan, inte
röd skärm/vit skärm, och syns i Sentry inom en minut.

---

## 2. Säkerhet

### Vad som fungerar bra (verifierat mot databasen som `anon`)

- Ingen tabell går att skriva till utloggad: `listings`, `reports`, `ratings`,
  `conversations`, `messages`, `push_tokens`, `verified_organizers`, `profiles`
  svarar alla `42501` på insert.
- `seller_payment_details`, `blocked_users`, `admins` är helt stängda för anon
  (inte ens select-rättighet). Bra mönster – gör likadant för resten (P2 nedan).
- Swish-nummer ligger i egen tabell som bara motparter i en chatt kan läsa.
- Chatten har serverside-rategräns, blockering åt båda hållen, säljar-id sätts
  av trigger (kan inte spoofas), rapporter kan bara läsas av admin.
- Admin-rollen kan bara ges via SQL-editorn; alla admin-RPC:er kontrollerar
  `is_admin()`.
- Verified organizers, ticket watches: skrivskyddade/ägarscopade och testade
  (18/18 resp. 34/34 tester i PGlite).
- Kontoradering går via Edge Function med användarens egen JWT och städar
  storage först.
- Inga hemligheter i git (`.env`, `*.ipa`, `*.p8` m.fl. ignoreras, inga
  spårade nyckelfiler).

### P0 – gör direkt

**S1. Rotera hemligheter som funnits i chattloggar.** Under arbetet har
service_role-nyckeln, en Google OAuth client secret och ett lösenord för
adminkontot klistrats in i konversationen. Chattloggar är inte en
hemlighetsförvaring.
- Supabase → Settings → API: rotera `service_role` (eller byt till nya
  publishable/secret-nycklar och uppdatera Edge Function-miljön).
- Google Cloud → Credentials → webbklienten: **Reset secret**, klistra in det
  nya i Supabase → Auth → Providers → Google.
- Byt adminkontots lösenord i appen.

**S2. Granska legacy-tabeller och -kolumner från Lovable-tiden.** Databasen
innehåller saker som inte finns i någon migration i repot:
- Tabellen `public.profiles` (finns, RLS på, men innehåll och policies
  okända – kan innehålla e-post/telefon som alla inloggade får läsa).
- Kolumnen `listings.seller_verified` – publikt läsbar och klientskrivbar. Den
  används inte i appen, men en gammal webbklient eller ett handgjort anrop kan
  sätta den till `true`. Nationsverifiering ska **bara** komma från
  `verified_organizers`.
- Kolumnerna `listings.contact_method`/`contact_info` – appen skriver alltid
  `''`, inga ifyllda rader finns idag, men kolumnerna är publika.

Kör i SQL-editorn och läs resultatet innan något ändras:

```sql
-- Vad finns i profiles och vem får läsa?
select column_name, data_type from information_schema.columns
 where table_schema = 'public' and table_name = 'profiles';
select count(*) from public.profiles;
select tablename, policyname, roles, cmd, qual, with_check
  from pg_policies where schemaname = 'public'
 order by tablename, policyname;

-- Vilka FK:er tar bort data när ett konto raderas? (annars blir det
-- föräldralösa annonser/chattar, eller så misslyckas kontoradering)
select conrelid::regclass as tabell, conname, confdeltype
  from pg_constraint where contype = 'f' and confrelid = 'auth.users'::regclass;
```

Sedan, som ny migration: `alter table public.listings drop column
seller_verified;` samt `drop column contact_method, drop column contact_info`
(efter att `LISTING_COLUMNS` i `src/lib/tickets.ts` och insert i `sell.tsx`
rensats – kolumnerna i `select`-strängen måste bort **först**, annars går
listningen sönder för gamla appversioner: gör kodändringen, släpp build,
droppa kolumnerna senare). Om `profiles` inte används av något: `drop table`.

**S3. Ingen gräns på antal annonser eller textlängder.** Vem som helst kan
lägga upp tusen annonser i en loop, och `event_name`, `description`,
`trade_description`, `seller_name` och egen arrangörstext har ingen längdgräns
i databasen. `event_name` går dessutom in i push-titeln för bevakningar.
Ny migration:

```sql
alter table public.listings
  add constraint listings_event_name_len check (char_length(event_name) between 1 and 80),
  add constraint listings_ticket_type_len check (char_length(ticket_type) between 1 and 40),
  add constraint listings_description_len check (description is null or char_length(description) <= 1000),
  add constraint listings_trade_description_len check (trade_description is null or char_length(trade_description) <= 200),
  add constraint listings_seller_name_len check (seller_name is null or char_length(seller_name) <= 40),
  add constraint listings_quantity_range check (quantity between 1 and 21),
  add constraint listings_price_range check (price is null or price between 0 and 3000);
```

Plus en `before insert`-trigger i stil med `enforce_message_rate_limit`:
max 5 annonser per 10 minuter, max 30 aktiva annonser per användare, med
svenska meddelanden och egen errcode (`23W02`) som `sell.tsx` översätter.
Sätt motsvarande `maxLength` i `sell.tsx` (beskrivning 1000, egen arrangör 40,
egen biljettyp 30) så användaren aldrig träffar constrainten.

**S4. Auth-inställningar i Supabase Dashboard.**
- Password → minsta längd 8 (uppdatera texten i 1.1 och klientkontrollen).
- ~~Password → slå på "Leaked password protection" (HaveIBeenPwned).~~ Kräver
  Pro-planen. Hoppas över tills vidare; 8-teckenskravet är den fria delen av
  samma skydd.
- Rate Limits → se 1.1.
- Email → OTP/länk-giltighet: 1 timme räcker.

### P1 – inom två veckor

**S5. Nonce för Apple och Google.** `signInWithIdToken` anropas utan `nonce`
(Google-providern har "Skip nonce check" påslaget). Det gör en stulen
ID-token återanvändbar under dess livstid. Fix: generera en slumpad nonce,
skicka `sha256(nonce)` till `AppleAuthentication.signInAsync({ nonce })` resp.
`GoogleSignin.signIn({ nonce })` och den råa noncen till
`supabase.auth.signInWithIdToken({ ..., nonce })`. Slå sedan av "Skip nonce
check". Testa på riktig enhet – kräver ny build.

**S6. Profilbilder utan gränser.** ~~`uploadAvatarImage` skickar valfri
MIME-typ och storlek till en publik bucket.~~ **Gjort i koden:** appen skalar
om till 512 px och sparar som JPEG (kvalitet 0,7) före uppladdning, vilket
landar på ~40–80 kB oavsett källbild, alltid som `avatar.jpg`, och städar bort
filer från tidigare filändelser. Omkodningen tar bort EXIF (inklusive
GPS-position) som annars hamnat i en publik bucket.

Kvar i dashboarden: Storage → avatars → **2 MB** som skyddsnät (inte 500 kB —
användare som ännu kör 1.0.2 laddar upp originalbilden och skulle nekas), och
tillåtna typer `image/jpeg, image/png, image/webp, image/heic` så länge 1.0.2
finns ute. När 1.0.3 rullat ut kan taket sänkas till 1 MB och typerna till
enbart `image/jpeg`.

**S7. Rategräns på rapporter och nya chattar.** `reports` kan spammas
(ingen gräns); `conversations` kan öppnas mot alla annonser i en loop. Samma
trigger-mönster som meddelanden: max 10 rapporter/dygn, max 20 nya
konversationer/timme.

**S8. Gräns för e-postbyte och namn.** `settings.tsx` låter användaren byta
lösenord utan att bekräfta det gamla. Supabase kräver som standard
återautentisering bara om det slås på: Auth → "Secure password change".
Slå på.

### P2 – bra hygien

- **Revoke anon** på tabeller som inte ska läsas utloggad: `conversations`,
  `messages`, `reports`, `ratings`, `push_tokens`, `profiles` (idag svarar de
  `200 []` för anon – RLS stoppar rader, men rättigheten borde inte finnas).
- **Expo push access token** (Enhanced push security) så inte vem som helst
  som får tag på ett push-token kan skicka notiser via `exp.host`.
  Läggs i `net.http_post`-headern `Authorization: Bearer ...` i båda
  triggerfunktionerna, hämtat från Vault.
- **Sessionslagring**: refresh-token ligger i AsyncStorage (okrypterat).
  Byt till `expo-secure-store`-adapter för nyckeln `sb-*-auth-token`.
- **Integritetspolicyn** nämner Supabase och Expo men inte Resend (e-post),
  Apple/Google-inloggning eller Sentry när det kommer. Uppdatera
  `legal/integritetspolicy.md` + `privacy-policy.md`.

---

## 3. Konkurrenten: studentbiljetter.se

**Vad de är:** webbplats (Django på Render bakom Cloudflare), lanserad efter
oss, enbart Lund. Inloggning **bara via Facebook**. Betalning via **Stripe**
med utbetalning till säljaren *efter* eventet ("tvistfönster"), Stripe säger
upp till två veckor. Säljaren **laddar upp QR-koden (screenshot/PDF) vid
annonsering** och köparen får den automatiskt vid köp. Pristak = inköpspris.
Endast QR-biljetter (inga namnbundna). Manuell granskning av första annonsen.
Eventkatalog med ~80 event (tider, adresser, nation), varje event har en egen
SEO-optimerad sida, bevakning per event, en "Nationsguide" med släpptider per
nation, FAQ. Kontakt via en Gmail-adress.

**Deras styrkor (som vi saknar):**
1. Direktleverans av biljetten + pengar i escrow → köparen behöver inte lita
   på säljaren.
2. Google hittar dem: sitemap, eventsidor med meta-taggar, innehållssida om
   släpptider. Vi har ingen webbnärvaro alls utöver App Store.
3. Eventkatalog → man bevakar ett *event*, inte bara "Malmö förköp".
4. Länkar går att dela i Messenger/Facebook-grupper – det är där andrahandshandeln
   sker idag.

**Deras svagheter (som vi kan trycka på):**
1. Facebook-only-login stänger ute många studenter. Vi har e-post, Apple, Google.
2. Webb utan push: de kan bara mejla. Vi kan notifiera inom sekunder – det
   avgör vem som får biljetten när något släpps kl 12.00.
3. Ingen chatt, ingen bytesfunktion ("Bytes"), inga betyg, ingen
   nationsverifiering.
4. Stripe-avgifter + två veckors utbetalning. Swish är gratis och direkt –
   studenter föredrar det.
5. Deras katalog visade **1 biljett till salu på 80 event**. Vi har lika lite.
   Ingen av oss har vunnit ännu – **det här avgörs av likviditet, inte
   funktioner.** Den som får nationernas egna släpp eller ett par
   Facebook-gruppers flöde in i sin plattform vinner.

---

## 4. Roadmap – prioriterad

Ordningen är medveten: först får inga användare tappas på fel och otrygghet,
sedan gör vi appen hittbar och delbar, sedan bygger vi det som gör en
transaktion tryggare än ett DM.

### Våg 1 – stabilitet och förtroende (denna och nästa vecka)

1. Avsnitt 1.1–1.3 (felmeddelanden). *Kod, ingen build-blockerare men bör med i 1.0.3.*
2. Avsnitt 2 P0: S1 (du), S2-granskning (du kör SQL, modellen tolkar), S3, S4 (du).
3. Sentry + ErrorBoundary (1.5).
4. Kör `supabase/migrations/20260916090000_create_ticket_watches.sql` i
   SQL-editorn (du). Bevakningsknappen finns redan i appen.
5. Bygg 1.0.3 (`npm run build:ios`, `npx eas-cli submit --platform ios
   --profile production`) och committa allt sedan `35974ab` i logiska commits:
   nationskonton, Apple/Google-inloggning, Google-knapp, bevakningar, felhantering.
6. **Android-release.** `app.json` har redan Android-konfig. Behövs:
   `eas build --platform android --profile production`, Google Play-konto
   (25 USD), `expo-notifications` fungerar med FCM (ladda upp
   `google-services.json` via EAS credentials), Google-inloggning på Android
   behöver en Android OAuth-klient med SHA-1 från EAS. Apple-knappen förblir
   iOS-only (guarden `Platform.OS === 'ios'` i `explore.tsx` blir
   `!== 'web'` för Google-delen). Ungefär halva Lunds studenter har Android –
   det är den enskilt största räckviddsökningen som finns.

### Våg 2 – bli hittbar och delbar (vecka 3–6)

7. **Webbversion på forkoplund.se.** Appen bygger redan för webb
   (`npx expo export --platform web`, `web.output: static`). Deploya
   `dist/` till Vercel/Cloudflare Pages på `app.forkoplund.se`. Krävs:
   dölja iOS-only-knappar, "Ladda ner appen"-banner, testa alla flöden i
   Safari mobil. Det ger direkt en länk att dela och en yta Google kan
   indexera.
8. **Publika delbara annons-länkar + universal links.** Route
   `src/app/l/[id].tsx` som visar en annons (och "öppna i appen"). Lägg
   `associatedDomains: ["applinks:forkoplund.se"]` i `app.json` och en
   `apple-app-site-association` på domänen, så länken öppnar appen om den
   finns. Dela-knapp i annonsmodalen (`expo-sharing`/`Share.share`). Det är så
   annonser sprids i Facebook-grupper – och varje delning marknadsför appen.
9. **SEO-landningssidor** på forkoplund.se (statiska, kan genereras från
   `NATIONS_LIST`): `/nation/malmo-nation` med "Förköp Malmö Nation – köp och
   sälj", en sida per nation, plus en "Släpptider i Lund"-sida (samma
   innehåll som konkurrentens Nationsguide, men vår). Titel/meta/OG per sida,
   sitemap.xml. Låg kostnad, långsiktig vinst.
10. **Släpp-kalender med påminnelser.** Vi vet när nationerna släpper
    (måndag/onsdag 12.00 etc). Lägg en `nation_release_schedule`-tabell
    (admin-redigerad), visa "Nästa släpp: Lunds Nation, mån 12.00" i
    Köp-fliken och låt användaren slå på en push 10 minuter före. Ingen
    konkurrent kan göra detta utan app. Använder samma push-infrastruktur som
    bevakningarna (pg_cron finns redan).
11. **Eventnivå i katalogen.** Idag är en annons "nation + biljettyp + datum".
    Lägg till valfritt `event_title` ("Casanova", "Schlagernatt") som
    sökbart fält och gruppera Köp-fliken per kväll ("Fre 18 sep · Malmö
    Nation · Casanova · 3 annonser"). Bevakningar utökas med `event_title`.
    Steg mot konkurrentens eventkatalog utan att bygga en scraper.
12. **Onboarding av nationskonton.** Verifieringen finns
    (`verified_organizers`). Skriv ett kort mejl till varje nations
    klubbmästare/QM: gratis verifierat konto, egen badge, deras officiella
    släpp syns först. En nation ombord = likviditet. Notera i detta dokument
    vilka som svarat.

### Våg 3 – tryggare än ett DM (månad 2–3)

13. **Säker överlämning i chatten.** Säljaren bifogar QR-skärmdumpen i
    chatten men den ligger **låst/suddig** tills säljaren trycker "Betalning
    mottagen" (efter Swish). Köparen ser ett tydligt steg-för-steg-flöde:
    1) Swisha 2) Säljaren släpper 3) Biljett visas + spara till bilder.
    Kräver privat storage-bucket `ticket-images` med policy "bara
    konversationens parter", bildkomprimering, och att mark-as-sold sker
    automatiskt när biljetten släpps. Detta ger 80 % av escrow-känslan utan
    Stripe.
14. **Förtroendesignaler i profilen**: "Medlem sedan", antal sålda, betyg
    (finns), "Verifierad" (finns), Swish-nummer registrerat (ja/nej). Visa i
    annonsmodalen innan köparen chattar.
15. **Betygsätt säljaren också.** Idag betygsätter bara säljaren köparen.
    Köparbetyg på säljaren är det som skyddar mot bluff.
16. **Riktig escrow (Swish Handel / Stripe) – bara om 13 inte räcker.**
    Kostar avgifter, kräver bolag + KYC. Ta beslutet efter att 13 har mätts.

### Löpande

- Sentry-fel varje vecka → in i avsnitt 1.
- Håll `describeAuthError`/`describeListingError` som enda väg för fel.
- Uppdatera detta dokument när punkter är klara (bocka av, datum).

---

## 5. Klart men ännu inte levererat (kräver dig)

| Vad | Åtgärd |
|---|---|
| Bevakningar (DB) | Kör `supabase/migrations/20260916090000_create_ticket_watches.sql` i SQL-editorn |
| Bevakningar, Google-knapp (vit), Apple- och Google-inloggning, nationskonton | Ny build 1.0.3 → TestFlight → App Store |
| Allt sedan commit `35974ab` | Committa och pusha (be modellen dela upp i logiska commits) |
| Testkonton från felsökningen (`+forkoptest…`, `+resendtest…`, `+linktest…`) | Radera i Supabase → Authentication → Users |

---

## 6. Prompt att ge nästa modell

> Läs `docs/granskning-och-plan-2026-09-16.md` i sin helhet och följ
> arbetsreglerna i toppen. Börja med avsnitt 1.1 (skapa
> `src/lib/auth-errors.ts` med mappning på `error.code`, ändra `auth.tsx`
> till att kasta AuthError-objektet, och byt ut alla `error.message`-visningar
> i `explore.tsx`, `settings.tsx`, `reset-password.tsx`, `messages.tsx`).
> Fortsätt med 1.2, 1.3, sedan 2/S3 (ny migration + `maxLength`) och 1.5
> (Sentry + ErrorBoundary). Kör `npx tsc --noEmit` och `npx eslint src`
> efter varje steg. Ändra inte befintliga migrationsfiler. Gör inga
> UI-omdesigner. Stanna och fråga innan du kör något mot Supabase eller
> bygger.
