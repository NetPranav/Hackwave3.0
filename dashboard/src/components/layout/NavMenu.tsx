"use client";

import { cn } from "@/lib/utils";
import {
  MotionNavigationMenu,
  MotionNavigationMenuList,
  MotionNavigationMenuItem,
  MotionNavigationMenuTrigger,
  MotionNavigationMenuContent,
  MotionNavigationMenuLink,
} from "@/components/unlumen-ui";
import { NAV_MENUS, type NavItem, type NavMenuDef, type NavTone } from "./navConfig";

const TAG_TONE: Record<NavTone, string> = {
  accent: "text-accent",
  warn: "text-warn dark:text-warn-bright",
  ok: "text-ok dark:text-ok-bright",
  muted: "text-text-primary/50 dark:text-white/45",
};

const HIGHLIGHT = "bg-dash-bg/70 dark:bg-white/[0.04] rounded";

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = item.isActive?.(pathname) ?? false;
  return (
    <MotionNavigationMenuLink
      href={item.href}
      target={item.external ? "_blank" : undefined}
      rel={item.external ? "noreferrer" : undefined}
      className="group flex flex-col rounded p-2 text-left transition-colors cursor-pointer"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-aeonik text-xs font-medium text-text-primary group-hover:text-accent dark:text-white">
          {item.title}
        </span>
        {active ? (
          <span className="font-aeonik-mono text-[10px] font-medium text-text-primary dark:text-white">YOU ARE HERE</span>
        ) : (
          item.tag && (
            <span className={cn("font-aeonik-mono text-[10px] font-medium", TAG_TONE[item.tag.tone])}>
              {item.tag.label}
            </span>
          )
        )}
      </div>
      <p className="mt-0.5 font-aeonik-light text-[11px] text-text-primary/60 dark:text-white/60">{item.desc}</p>
    </MotionNavigationMenuLink>
  );
}

function NavMenuItem({ menu, pathname }: { menu: NavMenuDef; pathname: string }) {
  const active = menu.groups.some((g) => g.items.some((i) => i.isActive?.(pathname)));
  return (
    <MotionNavigationMenuItem value={menu.value}>
      <MotionNavigationMenuTrigger className="font-aeonik-mono text-[11px] uppercase tracking-wider text-text-primary/70 hover:text-text-primary dark:text-white/70 dark:hover:text-white h-7 px-2.5">
        <span className="flex items-center gap-1.5">
          <span>{menu.label}</span>
          {menu.attention && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />}
          {active && !menu.attention && <span className="h-1.5 w-1.5 rounded-full bg-text-primary dark:bg-white" />}
        </span>
      </MotionNavigationMenuTrigger>
      <MotionNavigationMenuContent highlightClassName={HIGHLIGHT}>
        <div className="grid w-[360px] grid-cols-1 gap-1 p-1">
          {menu.groups.map((group, i) => (
            <div key={group.heading} className={cn(i > 0 && "mt-1 border-t border-box-outline/60 pt-1 dark:border-dark-border/60")}>
              <p className="px-2 pb-0.5 pt-1.5 font-aeonik-mono text-[9px] uppercase tracking-[0.2em] text-text-primary/40 dark:text-white/40">
                {group.heading}
              </p>
              {group.items.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} />
              ))}
            </div>
          ))}
        </div>
      </MotionNavigationMenuContent>
    </MotionNavigationMenuItem>
  );
}

/** The centred menu: four sections, each with named groups inside its dropdown. */
export default function NavMenu({ pathname }: { pathname: string }) {
  return (
    <MotionNavigationMenu
      viewportClassName="border border-box-outline bg-section text-text-primary dark:border-dark-border dark:bg-dark-dash-section dark:text-white shadow-none rounded-md"
      springStiffness={320}
      springDamping={28}
    >
      <MotionNavigationMenuList highlightClassName="bg-dash-bg dark:bg-white/[0.06] rounded">
        {NAV_MENUS.map((menu) => (
          <NavMenuItem key={menu.value} menu={menu} pathname={pathname} />
        ))}
      </MotionNavigationMenuList>
    </MotionNavigationMenu>
  );
}
