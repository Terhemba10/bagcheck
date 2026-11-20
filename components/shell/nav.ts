import {
  IconBell,
  IconChat,
  IconDatabase,
  IconHome,
  IconLifebuoy,
  IconList,
  IconPlug,
  IconSearch,
} from "@/components/ui/icons";

/** One nav model for the sidebar, the icon rail, the drawer, the bottom bar and the command palette. */
export interface NavItem {
  id: string;
  label: string;
  Icon: (p: { className?: string }) => React.ReactNode;
  /** A page… */
  href?: string;
  /** …or an action. */
  action?: "palette" | "chat";
  /** Shown in the phone bottom bar (4 main actions). */
  bottom?: boolean;
  /** Extra words the command palette matches. */
  keywords?: string;
}

export const NAV: NavItem[] = [
  { id: "home", label: "Home", Icon: IconHome, href: "/", keywords: "start" },
  { id: "check", label: "Check a coin", Icon: IconSearch, action: "palette", bottom: true, keywords: "search report risk" },
  { id: "watchlist", label: "Watchlist", Icon: IconList, href: "/watchlist", bottom: true, keywords: "watch hold monitor" },
  { id: "alerts", label: "Alerts", Icon: IconBell, href: "/alerts", keywords: "warnings notifications" },
  { id: "rescue", label: "Rescue", Icon: IconLifebuoy, href: "/rescue", bottom: true, keywords: "help sell drained scam" },
  { id: "ask", label: "Ask Covex", Icon: IconChat, action: "chat", bottom: true, keywords: "chat question" },
  { id: "connect", label: "Connect", Icon: IconPlug, href: "/connect", keywords: "telegram mcp claude assistant" },
  { id: "evidence", label: "API evidence", Icon: IconDatabase, href: "/evidence", keywords: "coinmarketcap calls credits" },
];

/** Which nav item a path belongs to. */
export function activeNavId(pathname: string): string | null {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/coin/")) return "check";
  if (pathname.startsWith("/alerts")) return "alerts";
  if (pathname.startsWith("/rescue")) return "rescue";
  if (pathname.startsWith("/watchlist")) return "watchlist";
  if (pathname.startsWith("/connect")) return "connect";
  if (pathname.startsWith("/evidence")) return "evidence";
  return null;
}
