# Plan: officiella konton utan hinder, och en app som håller

Skriven 26 september 2026, efter genomgång av gränserna i databasen och koden
i appen. Inget här är gjort än. Fortsättning på
[granskning-och-plan-2026-09-16.md](granskning-och-plan-2026-09-16.md).

---

## 1. Gränserna som finns i dag

Alla gränser sitter i databasen, som triggers, och gäller alla konton lika.

| Vad | Gräns | Var |
| --- | --- | --- |
| Meddelanden | 5 per 10 sek · 20 per minut · **300 per dygn** | `enforce_message_rate_limit`, 20260709090000 |
| Nya annonser | 5 per 10 minuter | `enforce_listing_limits`, 20260916120000 |
| Aktiva annonser | 30 (100 för verifierade arrangörer) | samma |
| Nya chattar man själv startar | 20 per timme | `enforce_conversation_limits` |
| Rapporter | 10 per dygn | `enforce_report_limits` |

**Två problem för ett officiellt konto.**

Dygnsgränsen på 300 meddelanden är den som slår till på riktigt. LTH Griparna
med 40 biljetter i en batch får lätt hundra frågor på en kväll, och varje svar
räknas. Minutgränsen på 20 slår till när de sitter och svarar många i rad.
När gränsen nås får de "Du har nått dagens gräns" och kan inte svara någon
mer förrän i morgon — det ser ut som att appen är trasig.

Och: allowancen på 100 aktiva annonser gäller `verified_organizers`, inte
`official_accounts`. Griparna sitter alltså kvar på 30. Det är en miss från i
går, inte ett medvetet val.

## 2. Förslag: ett begrepp för "konto vi litar på"

En funktion som alla gränser frågar, i stället för att varje trigger får sin
egen lista:

```sql
create or replace function public.is_trusted_account(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.official_accounts o where o.user_id = p_user_id)
      or exists (select 1 from public.verified_organizers v where v.user_id = p_user_id);
$$;
```

Nya gränser för de kontona:

| Vad | I dag | Förslag för betrodda konton |
| --- | --- | --- |
| Meddelanden per 10 sek | 5 | 30 |
| Meddelanden per minut | 20 | ingen |
| Meddelanden per dygn | 300 | 3000 |
| Nya annonser per 10 min | 5 | 30 |
| Aktiva annonser | 30 | 100 |
| Nya chattar per timme | 20 | 100 |

**Varför inte ta bort gränserna helt.** Ingen av dem finns för att hindra
Griparna. De finns för dagen någon kommer åt kontot, eller för dagen vi själva
råkar skriva en slinga som skickar meddelanden. 30 på tio sekunder är mer än
någon människa hinner skriva, och 3000 per dygn är tio gånger mer än en hel
kväll av svar. Gränsen märks aldrig av dem, men den gör att ett kapat konto
inte kan spamma hela Lund innan vi hinner reagera. Det kostar oss inget att
behålla dem på den nivån, och att sätta dem till oändligt sparar ingenting.

**Arbete:** en migrering, ingen appändring, inget nytt bygge. Ungefär en
halvtimme inklusive test mot en kopia av databasen.

## 3. Fler förbättringar för officiella konton

Ordnade efter hur mycket de ger jämfört med vad de kostar.

1. **Filter "Endast officiella" på Hitta.** En knapp i filterraden. Köparen som
   vill vara säker kan se bara verifierade säljare. Gör bocken värd något för
   köparen, inte bara för säljaren. *Litet arbete.*
2. **"Sålda X av Y".** Kontot lade upp 40, har 12 kvar. Vi vet redan båda
   talen om vi sparar ursprungsantalet. Visar köparen att det går undan, och
   sparar frågan "finns de kvar?". *Litet, en kolumn.*
3. **Följ ett officiellt konto.** Notis när de lägger upp. Samma maskineri som
   bevakningarna, med konto i stället för nation som filter. *Medelstort.*
4. **Duplicera annons.** De säljer till match efter match. En knapp "Lägg upp
   igen" som öppnar formuläret ifyllt med förra annonsen. *Litet.*
5. **Enkel statistik.** Hur många har öppnat annonsen, hur många hörde av sig.
   Kräver en tabell för visningar. *Medelstort, men det är den sortens sak som
   gör att en förening fortsätter använda appen.*

## 4. Buggar och risker i appen

Det här hittade jag i koden nu. Inget av det märks med tjugo användare, allt
märks med tvåtusen.

### P1 — gör innan ni växer

- **Inkorgen hämtar alla meddelanden.** `fetchLatestMessages` hämtar varenda
  meddelande i alla dina konversationer, bara för att visa den sista raden i
  listan. Samtidigt lyssnar appen på *alla* nya meddelanden i hela databasen
  och gör om hela hämtningen varje gång någon, var som helst, skriver något.
  Med hundra aktiva användare blir det tiotusentals rader i onödan per minut.
  *Fix: en vy eller RPC som ger sista meddelandet per konversation, och
  uppdatera bara den konversation som berörs. En halvdag.*
- **Flödet hämtar alla annonser.** Ingen paginering någonstans. Fungerar i dag,
  blir segt vid några hundra annonser. *Fix: hämta 50 och "ladda fler". Några
  timmar.*
- **Döda pushtokens rensas aldrig.** Avinstallerar någon appen ligger token
  kvar för alltid, och vi läser aldrig Expos kvitton. Notiser börjar tyst
  misslyckas och vi märker det inte. *Fix: ett nattligt jobb som läser kvitton
  och tar bort `DeviceNotRegistered`. Några timmar.*

### P2 — gör snart

- **Ingen felrapportering.** Kraschar appen hos en användare får vi aldrig veta
  det. Sentry är gratis i den storlek ni har. *Behöver en DSN från dig.*
- **5,4 MB nationslogotyper i appen.** `afborgen.png` är 1,6 MB, `helsingkrona.png`
  1,0 MB — de visas som 36 punkter stora cirklar. Skalade till 256 px blir
  hela mappen under 0,3 MB. Mindre app att ladda ner, snabbare start.
  *En timme.*
- **Ingen delningslänk.** Man kan inte skicka en annons till en kompis. Det är
  det billigaste sättet att växa: varje delning i en Facebookgrupp är en ny
  användare. Kräver universal links (`associatedDomains`) och en dela-knapp.
  *En dag, plus en domän som pekar rätt.*
- **Inga automatiska tester.** SQL:en testar jag mot en kopia av databasen varje
  gång, men testerna ligger utanför repot och typkontrollen körs för hand.
  *Fix: lägg in testerna och ett `npm test`. Några timmar.*

### P3 — när det finns tid

- **Webben är bara ett bygge, ingen sajt.** Konkurrenten studentbiljetter.se är
  en webbsajt och syns därför på Google. Ni har redan en statisk webbexport.
  Lägg den på forkop.se med en sida per nation, så hittar folk er utan att
  först höra talas om appen.
- **`not valid`-villkoren.** Längdgränserna från september gäller nya rader men
  är aldrig validerade mot de gamla Lovable-raderna. Städa och validera.
- **Android.** Appen är byggd för iOS. Ungefär var femte student i Lund har
  Android och kan inte använda appen alls.

## 5. Ordning jag föreslår

1. Gränserna för officiella konton (avsnitt 2) — en migrering, ingen väntan på
   Apple.
2. Inkorgen och pushtokens (P1) — innan användarna blir fler.
3. Filter "Endast officiella" och "Sålda X av Y" — små, syns direkt.
4. Sentry och bildstorlekarna (P2).
5. Delningslänkar, och därefter webbsajten.
