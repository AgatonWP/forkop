import { Mail } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const CONTACT_EMAIL = "tixet.info@gmail.com";

export default function Footer() {
  const { lang } = useI18n();

  const copy =
    lang === "sv"
      ? {
          aboutTitle: "Om TIXET",
          aboutText:
            "Här kan du köpa, sälja och byta biljetter till nationsevent, spex, baler och andra studentevenemang - smidigt, tryggt och enkelt.",
          contactLabel: "Kontakt",
          contactCta: "Mejla oss",
          rights: "Alla rättigheter förbehållna.",
        }
      : {
          aboutTitle: "About TIXET",
          aboutText:
            "Here you can buy, sell and trade tickets to nation events, spex, balls and other student happenings - smoothly, safely and simply.",
          contactLabel: "Contact",
          contactCta: "Email us",
          rights: "All rights reserved.",
        };

  return (
    <footer className="mt-16 border-t border-border/60 bg-gradient-footer">
      <div className="container py-10">
        <section className="mx-auto max-w-2xl space-y-3 text-center">
          <h2 className="font-display text-lg font-semibold text-foreground">{copy.aboutTitle}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{copy.aboutText}</p>
          <div className="flex flex-col items-center gap-2 pt-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
              {copy.contactLabel}
            </span>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="inline-flex items-center gap-2 rounded-full border border-[#e39e72]/25 bg-background/70 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-[#e39e72]/45 hover:bg-background"
              >
                <Mail className="h-4 w-4 text-[#e39e72]" />
                {copy.contactCta}
              </a>
            </div>
          </div>
        </section>
      </div>
      <div className="border-t border-border/40">
        <div className="container py-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} TIXET · {copy.rights}
        </div>
      </div>
    </footer>
  );
}
