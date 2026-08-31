export type LegalSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type LegalDocument = {
  title: string;
  updatedAt?: string;
  introduction: string[];
  sections: LegalSection[];
};

export const privacyPolicy: LegalDocument = {
  title: 'Integritetspolicy för Forkop',
  updatedAt: '27 augusti 2026',
  introduction: [
    'Den här integritetspolicyn beskriver hur personuppgifter behandlas när du använder appen Forkop.',
  ],
  sections: [
    {
      title: '1. Personuppgiftsansvarig',
      paragraphs: [
        'Agaton Westman Prage är personuppgiftsansvarig för behandlingen av personuppgifter i Forkop.',
        'Kontakt: agaton.westman.prage@gmail.com',
      ],
    },
    {
      title: '2. Personuppgifter vi behandlar',
      bullets: [
        'E-postadress och kontouppgifter: för att skapa konto, autentisera dig och administrera tjänsten.',
        'Visningsnamn och profilbild, om du väljer att lägga till dem: för att visa din profil i annonser, omdömen och chattar.',
        'Swish-nummer, om du väljer att spara det: för att en köpare som har startat en chatt med dig ska kunna betala dig.',
        'Annonsuppgifter: för att publicera och hantera dina annonser.',
        'Konversationer och meddelanden: för kommunikation mellan köpare och säljare samt hantering av trygghetsärenden.',
        'Omdömen: för att skapa förtroende mellan användare.',
        'Rapporter och blockeringar: för att förebygga missbruk och moderera tjänsten.',
        'Push-token, om du aktiverar pushnotiser: för att skicka notiser om nya meddelanden.',
      ],
      paragraphs: [
        'Lösenord hanteras av vår autentiseringsleverantör Supabase. Forkop kan inte läsa ditt lösenord i klartext.',
        'Vi använder inte tredjepartsannonser och samlar inte in platsdata eller kontakter från din enhet.',
      ],
    },
    {
      title: '3. Rättslig grund',
      bullets: [
        'Fullgörande av avtal: kontouppgifter, annonser, chattar och andra uppgifter som behövs för att tillhandahålla Forkop.',
        'Berättigat intresse: rapporter, blockeringar och nödvändig behandling för att förebygga missbruk och hålla tjänsten säker. Vårt intresse är att skydda användarna och tjänsten.',
        'Samtycke: pushnotiser skickas bara om du godkänner notiser i enhetens inställningar. Du kan återkalla tillståndet när som helst.',
      ],
      paragraphs: [
        'Valfria profiluppgifter och Swish-nummer lämnas frivilligt och kan tas bort i appens inställningar.',
      ],
    },
    {
      title: '4. Hur uppgifter visas och delas',
      bullets: [
        'Aktiva annonser och de profiluppgifter som hör till dem kan visas för andra användare.',
        'Profilbilder lagras i en publikt läsbar bildlagring för att kunna visas i appen.',
        'Chattar visas endast för deltagarna i respektive konversation.',
        'Ett sparat Swish-nummer visas endast för kontoinnehavaren och för en köpare som har en faktisk konversation med säljaren.',
        'Omdömen kan visas för andra användare, medan rapporter och blockeringar inte visas offentligt.',
        'Supabase används för autentisering, databas, fillagring och serverfunktioner.',
        'Expo används för appinfrastruktur och leverans av pushnotiser.',
      ],
      paragraphs: [
        'Leverantörerna behandlar uppgifter enligt sina villkor och dataskyddsåtaganden. Vi säljer inte personuppgifter och delar dem inte med annonsnätverk.',
      ],
    },
    {
      title: '5. Lagringstid',
      paragraphs: [
        'Vi sparar kontoanknutna uppgifter så länge kontot finns och uppgifterna behövs för tjänsten. Du kan ta bort en annons, valfria profiluppgifter och ditt Swish-nummer tidigare via appen.',
        'När du raderar kontot tas kontot och tillhörande personuppgifter bort från den aktiva tjänsten. Vissa uppgifter kan sparas längre om det krävs enligt lag eller behövs för att fastställa, göra gällande eller försvara rättsliga anspråk.',
      ],
    },
    {
      title: '6. Dina rättigheter',
      paragraphs: [
        'Enligt dataskyddsförordningen (GDPR) kan du, beroende på omständigheterna, ha rätt att:',
      ],
      bullets: [
        'få information om och tillgång till dina personuppgifter,',
        'få felaktiga uppgifter rättade,',
        'få uppgifter raderade,',
        'begära att behandlingen begränsas,',
        'invända mot behandling som grundas på berättigat intresse,',
        'få ut vissa uppgifter i ett portabelt format, och',
        'återkalla ett samtycke utan att det påverkar tidigare behandling.',
      ],
    },
    {
      title: '7. Så använder du dina rättigheter',
      paragraphs: [
        'Du kan radera ditt konto direkt under Inställningar i appen. För andra önskemål, kontakta agaton.westman.prage@gmail.com. Vi kan behöva kontrollera din identitet innan en begäran genomförs.',
        'Du har också rätt att lämna klagomål till Integritetsskyddsmyndigheten (IMY).',
      ],
    },
    {
      title: '8. Säkerhet',
      paragraphs: [
        'Vi använder tekniska och organisatoriska skyddsåtgärder, bland annat autentisering, krypterad överföring och radbaserad åtkomstkontroll i databasen. Ingen internetbaserad tjänst kan dock garantera fullständig säkerhet.',
      ],
    },
    {
      title: '9. Ändringar och kontakt',
      paragraphs: [
        'Vi kan uppdatera policyn när tjänsten eller lagkraven förändras. Datumet högst upp visar när policyn senast uppdaterades. Väsentliga ändringar meddelas i appen eller på annat lämpligt sätt.',
        'Agaton Westman Prage\nE-post: agaton.westman.prage@gmail.com',
      ],
    },
  ],
};

export const termsOfUse: LegalDocument = {
  title: 'Användarvillkor för Forkop',
  updatedAt: '27 augusti 2026',
  introduction: [
    'Dessa villkor gäller när du skapar ett konto eller använder Forkop. Genom att använda tjänsten godkänner du villkoren.',
  ],
  sections: [
    {
      title: '1. Om tjänsten',
      paragraphs: [
        'Forkop tillhandahålls av Agaton Westman Prage och är en digital mötesplats där användare kan lägga upp, hitta, köpa, sälja och byta biljetter. Forkop förmedlar kontakten men är inte part i någon överenskommelse, biljettöverlåtelse eller betalning mellan användare.',
      ],
    },
    {
      title: '2. Konto och behörighet',
      bullets: [
        'Du ansvarar för att dina uppgifter är korrekta och för att skydda dina inloggningsuppgifter.',
        'Du måste ha rätt att ingå de avtal du gör via tjänsten. Om du är under 18 år kan en vårdnadshavares godkännande krävas.',
        'Kontot är personligt och får inte säljas, delas eller överlåtas.',
        'Meddela oss snarast om du tror att någon obehörig använder ditt konto.',
      ],
    },
    {
      title: '3. Annonser och användarinnehåll',
      bullets: [
        'Du får bara annonsera sådant som du har rätt att sälja eller byta och måste beskriva det sanningsenligt.',
        'Kontrollera själv att en biljett får överlåtas och följ arrangörens villkor samt tillämplig lag.',
        'Olagligt, vilseledande, hotfullt, kränkande, diskriminerande eller rättighetsintrångande innehåll är förbjudet. Spam, bedrägeriförsök och trakasserier är också förbjudna.',
        'Du behåller rättigheterna till ditt innehåll men ger oss en icke-exklusiv rätt att lagra och visa det i den utsträckning som behövs för att driva Forkop.',
        'Vi får granska rapporter och ta bort innehåll eller begränsa konton som bryter mot villkoren eller innebär risk för användare eller tjänsten.',
      ],
    },
    {
      title: '4. Kontakt, rapportering och blockering',
      paragraphs: [
        'Användare kan kommunicera via appens chatt. Du kan rapportera en annons eller användare och blockera en användare från en konversation. Rapportera misstänkt bedrägeri, hot eller annat missbruk. Vid akut fara ska du kontakta polis eller annan relevant myndighet.',
      ],
    },
    {
      title: '5. Betalningar och biljetter',
      bullets: [
        'Betalningar, exempelvis via Swish, sker direkt mellan köpare och säljare utanför Forkop. Vi tar inte emot, håller eller återbetalar pengar.',
        'Du ansvarar själv för att kontrollera motparten, biljettens äkthet, överlåtbarhet, pris och leverans innan du betalar eller lämnar över en biljett.',
        'Forkop garanterar inte att en annons är korrekt, att en biljett är giltig eller att en affär slutförs.',
      ],
    },
    {
      title: '6. Omdömen',
      paragraphs: [
        'Omdömen ska bygga på en faktisk kontakt eller affär och lämnas sakligt och i god tro. Manipulerade, hotfulla eller på annat sätt otillåtna omdömen får tas bort.',
      ],
    },
    {
      title: '7. Tillgänglighet och ansvar',
      paragraphs: [
        'Forkop tillhandahålls i befintligt skick och tjänsten kan ibland vara otillgänglig eller innehålla fel. I den utsträckning lagen tillåter ansvarar vi inte för användares handlingar, biljettens giltighet, uteblivna affärer, betalningstvister eller indirekta skador. Detta begränsar inte ansvar som följer av tvingande lag.',
      ],
    },
    {
      title: '8. Avstängning och avslut',
      paragraphs: [
        'Du kan när som helst sluta använda Forkop och radera ditt konto i appens inställningar. Vi får ta bort innehåll, begränsa funktioner eller stänga av ett konto vid brott mot villkoren, misstänkt missbruk, säkerhetsrisk eller rättslig skyldighet.',
      ],
    },
    {
      title: '9. Ändringar och tjänstens upphörande',
      paragraphs: [
        'Vi kan utveckla, ändra eller avsluta hela eller delar av Forkop. Om villkoren ändras väsentligt informerar vi i appen eller på annat lämpligt sätt. Fortsatt användning efter att nya villkor börjat gälla innebär att de nya villkoren accepteras.',
      ],
    },
    {
      title: '10. Tillämplig lag och tvist',
      paragraphs: [
        'Svensk lag gäller. Tvister bör i första hand lösas genom kontakt med oss. Du behåller alltid de rättigheter du har enligt tvingande konsumentlagstiftning.',
      ],
    },
    {
      title: '11. Kontakt',
      paragraphs: ['Agaton Westman Prage\nE-post: agaton.westman.prage@gmail.com'],
    },
  ],
};

export const supportInformation: LegalDocument = {
  title: 'Support för Forkop',
  introduction: ['Behöver du hjälp med Forkop, vill rapportera ett problem eller lämna feedback?'],
  sections: [
    {
      title: 'Kontakt',
      paragraphs: [
        'Agaton Westman Prage\nE-post: agaton.westman.prage@gmail.com',
        'Vi försöker svara så snart som möjligt.',
      ],
    },
  ],
};
