# Tixetny testsetup

Det här är en delvis färdig testversion av Tixetny. Appen är kopplad till ett separat Supabase-projekt för test, inte gamla Lovable/Tixet.

## Kom igång

1. Installera dependencies:

```bash
npm install
```

2. Skapa en fil som heter `.env` i projektroten:

```bash
touch .env
```

3. Lägg in detta i `.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://hikfcumubvpdwffetlev.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_X3nTO8Sh_TbYOf17kPX3gw_A3P5BFAj
```

4. Starta appen:

```bash
npx expo start --clear
```

5. Öppna appen:

- Tryck `w` för webben.
- Eller scanna QR-koden med Expo Go.

## Det som funkar nu

- Visa annonser från Supabase.
- Skapa konto.
- Logga in.
- Logga ut.
- Lägg upp en annons som inloggad användare.

## Bra att veta

- Appen är fortfarande under utveckling.
- Profilens annonslista är inte helt kopplad till riktig data ännu.
- Chatten är inte färdigkopplad till Supabase ännu.
- `.env` pushas inte till Git, så varje testare behöver skapa den själv.
- Supabase-nyckeln ovan är en publishable client key och är avsedd att användas i appen.

## Om något strular

Kör först:

```bash
npx tsc --noEmit
npx expo start --clear
```

Om annonser inte syns eller login inte funkar, kontrollera att `.env` ligger i projektroten och att Expo-terminalen skriver:

```text
env: export EXPO_PUBLIC_SUPABASE_ANON_KEY EXPO_PUBLIC_SUPABASE_URL
```
