import { Moon, Sun, User, CalendarDays, Menu, Languages, MessageCircle, Settings } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import CreateListingDialog from "./CreateListingDialog";
import { Listing } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import logo from "@/assets/logo1.png";
import { useUnreadConversationCount } from "@/hooks/use-unread-messages";

interface HeaderProps {
  onCreateListing: (listing: Listing) => void;
}

export default function Header({ onCreateListing }: HeaderProps) {
  const { lang, setLang } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const unreadCount = useUnreadConversationCount();

  const iconBtn = "h-10 w-10 text-muted-foreground hover:text-foreground";
  const announcement = lang === "sv"
    ? "Appen är på väg och lanseras inom kort."
    : "The app is on the way and launching soon.";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/90 shadow-[0_8px_24px_-24px_rgba(227,158,114,0.95)] backdrop-blur-md">
      <div className="border-b border-border/60 bg-[#e39e72]/10">
        <div className="container py-1.5 text-center text-[11px] font-medium tracking-[0.08em] text-muted-foreground">
          {announcement}
        </div>
      </div>
      <div className="container flex min-h-20 md:min-h-24 items-center justify-between gap-2 py-2 md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-4">
        <Link to="/" className="flex items-center md:justify-self-start shrink-0">
          <img
            src={logo}
            alt="Tixet"
            className="h-10 md:h-18 w-auto max-w-[120px] md:max-w-[220px] object-contain shrink-0"
          />
        </Link>

        <div className="flex-1 flex justify-end md:justify-self-center md:flex-none md:justify-center">
          <CreateListingDialog onCreateListing={onCreateListing} />
        </div>

        {/* Desktop actions */}
        <div className="hidden md:flex items-center justify-self-end gap-1">
          <Link to="/calendar">
            <Button variant="ghost" size="icon" className={iconBtn} title={lang === "sv" ? "Kalender" : "Calendar"}>
              <CalendarDays className="h-5 w-5" />
            </Button>
          </Link>

          {user ? (
            <>
              <Link to="/messages" className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className={iconBtn}
                  title={lang === "sv" ? "Meddelanden" : "Messages"}
                >
                  <MessageCircle className="h-5 w-5" />
                </Button>
                {unreadCount > 0 && (
                  <span
                    aria-label={lang === "sv" ? "Olästa meddelanden" : "Unread messages"}
                    className="absolute top-1.5 right-1.5 min-w-[16px] h-[16px] px-[3px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center ring-2 ring-card"
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
              <Link to="/profile">
                <Button variant="ghost" size="icon" className={iconBtn} title={lang === "sv" ? "Profil" : "Profile"}>
                  <User className="h-5 w-5" />
                </Button>
              </Link>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/auth")}
              className="text-xs font-medium px-3 h-9 text-muted-foreground hover:text-foreground"
            >
              {lang === "sv" ? "Logga in" : "Sign in"}
            </Button>
          )}

          {/* Settings dropdown - far right */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-foreground ml-1"
                aria-label={lang === "sv" ? "Inställningar" : "Settings"}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setLang(lang === "sv" ? "en" : "sv")}>
                <Languages className="mr-2 h-4 w-4" />
                {lang === "sv" ? "English" : "Svenska"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggleTheme}>
                {theme === "dark" ? (
                  <>
                    <Sun className="mr-2 h-4 w-4" />
                    {lang === "sv" ? "Ljust läge" : "Light mode"}
                  </>
                ) : (
                  <>
                    <Moon className="mr-2 h-4 w-4" />
                    {lang === "sv" ? "Mörkt läge" : "Dark mode"}
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Mobile actions */}
        <div className="flex md:hidden items-center justify-self-end gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-foreground relative"
                aria-label={lang === "sv" ? "Meny" : "Menu"}
              >
                <Menu className="h-5 w-5" />
                {user && unreadCount > 0 && (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive ring-2 ring-card" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => navigate("/calendar")}>
                <CalendarDays className="mr-2 h-4 w-4" />
                {lang === "sv" ? "Kalender" : "Calendar"}
              </DropdownMenuItem>
              {user ? (
                <>
                  <DropdownMenuItem onClick={() => navigate("/messages")}>
                    <MessageCircle className="mr-2 h-4 w-4" />
                    {lang === "sv" ? "Meddelanden" : "Messages"}
                    {unreadCount > 0 && (
                      <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/profile")}>
                    <User className="mr-2 h-4 w-4" />
                    {lang === "sv" ? "Profil" : "Profile"}
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem onClick={() => navigate("/auth")}>
                  <User className="mr-2 h-4 w-4" />
                  {lang === "sv" ? "Logga in" : "Sign in"}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setLang(lang === "sv" ? "en" : "sv")}>
                <Languages className="mr-2 h-4 w-4" />
                {lang === "sv" ? "English" : "Svenska"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggleTheme}>
                {theme === "dark" ? (
                  <>
                    <Sun className="mr-2 h-4 w-4" />
                    {lang === "sv" ? "Ljust läge" : "Light mode"}
                  </>
                ) : (
                  <>
                    <Moon className="mr-2 h-4 w-4" />
                    {lang === "sv" ? "Mörkt läge" : "Dark mode"}
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
