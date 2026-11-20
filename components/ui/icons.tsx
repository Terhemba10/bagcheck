import type { SVGProps } from "react";

/** Small inline icon set (stroke icons, 24-px grid). Decorative by default. */
type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function Base({ title, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      {...props}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

export const IconCheck = (p: IconProps) => (
  <Base {...p}><circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.5 2.5L16 9.5" /></Base>
);
export const IconWatch = (p: IconProps) => (
  <Base {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5l3 2" /></Base>
);
export const IconTriangle = (p: IconProps) => (
  <Base {...p}><path d="M10.3 4.2 2.8 17.5A2 2 0 0 0 4.5 20.5h15a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" /><path d="M12 9.5v4" /><path d="M12 17h.01" /></Base>
);
export const IconOctagon = (p: IconProps) => (
  <Base {...p}><path d="M8.2 2.8h7.6l5.4 5.4v7.6l-5.4 5.4H8.2l-5.4-5.4V8.2Z" /><path d="M12 8v5" /><path d="M12 16.5h.01" /></Base>
);
export const IconQuestion = (p: IconProps) => (
  <Base {...p}><circle cx="12" cy="12" r="9" /><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6" /><path d="M12 17h.01" /></Base>
);
export const IconShield = (p: IconProps) => (
  <Base {...p}><path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6Z" /><path d="m9 12 2 2 4-4" /></Base>
);
export const IconSearch = (p: IconProps) => (
  <Base {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Base>
);
export const IconLive = (p: IconProps) => (
  <Base {...p}><circle cx="12" cy="12" r="3" fill="currentColor" /><path d="M6.3 6.3a8 8 0 0 0 0 11.4M17.7 6.3a8 8 0 0 1 0 11.4" /></Base>
);
export const IconClock = (p: IconProps) => (
  <Base {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5h4" /></Base>
);
export const IconArchive = (p: IconProps) => (
  <Base {...p}><rect x="3" y="4" width="18" height="5" rx="1" /><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" /><path d="M10 13h4" /></Base>
);
export const IconLock = (p: IconProps) => (
  <Base {...p}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></Base>
);
export const IconRecord = (p: IconProps) => (
  <Base {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.5" fill="currentColor" /></Base>
);
export const IconInfo = (p: IconProps) => (
  <Base {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" /></Base>
);
export const IconArrowRight = (p: IconProps) => (
  <Base {...p}><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></Base>
);
export const IconBell = (p: IconProps) => (
  <Base {...p}><path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9Z" /><path d="M10 20a2 2 0 0 0 4 0" /></Base>
);
export const IconLifebuoy = (p: IconProps) => (
  <Base {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.5" /><path d="m5.6 5.6 3.9 3.9M14.5 14.5l3.9 3.9M18.4 5.6l-3.9 3.9M9.5 14.5l-3.9 3.9" /></Base>
);
export const IconRefresh = (p: IconProps) => (
  <Base {...p}><path d="M20 11a8 8 0 0 0-14.3-4.6L4 8" /><path d="M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14.3 4.6L20 16" /><path d="M20 20v-4h-4" /></Base>
);
export const IconExternal = (p: IconProps) => (
  <Base {...p}><path d="M14 4h6v6" /><path d="m20 4-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></Base>
);
export const IconHome = (p: IconProps) => (
  <Base {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h5v-6h4v6h5V9.5" /></Base>
);
export const IconList = (p: IconProps) => (
  <Base {...p}><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" /></Base>
);
export const IconChat = (p: IconProps) => (
  <Base {...p}><path d="M4 5h16v11H9l-5 4z" /><path d="M8 10h8M8 13h5" /></Base>
);
export const IconPlug = (p: IconProps) => (
  <Base {...p}><path d="M9 3v5M15 3v5" /><path d="M6 8h12v3a6 6 0 0 1-12 0z" /><path d="M12 17v4" /></Base>
);
export const IconDatabase = (p: IconProps) => (
  <Base {...p}><ellipse cx="12" cy="5.5" rx="7.5" ry="2.5" /><path d="M4.5 5.5v6c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5v-6" /><path d="M4.5 11.5v6c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5v-6" /></Base>
);
export const IconPanelLeft = (p: IconProps) => (
  <Base {...p}><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M9 4v16" /></Base>
);
export const IconMenu = (p: IconProps) => (
  <Base {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Base>
);
export const IconX = (p: IconProps) => (
  <Base {...p}><path d="M6 6l12 12M18 6 6 18" /></Base>
);
export const IconCoin = (p: IconProps) => (
  <Base {...p}><circle cx="12" cy="12" r="8.5" /><path d="M14.5 9.2c-.6-.8-1.5-1.2-2.5-1.2-1.4 0-2.5.8-2.5 2s1.1 1.6 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-1.9-.4-2.5-1.2M12 6.5V8M12 16v1.5" /></Base>
);
