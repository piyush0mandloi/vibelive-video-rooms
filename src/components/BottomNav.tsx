import { Home, MessageCircle, UserRound } from "lucide-react";

export type MainTab = "rooms" | "messages" | "profile";

type BottomNavProps = {
  activeTab: MainTab;
  onTabChange: (tab: MainTab) => void;
  unread?: number;
};

const tabs = [
  { id: "rooms" as const, Icon: Home, label: "Rooms" },
  { id: "messages" as const, Icon: MessageCircle, label: "Messages" },
  { id: "profile" as const, Icon: UserRound, label: "Profile" },
];

export default function BottomNav({ activeTab, onTabChange, unread = 0 }: BottomNavProps) {
  return (
    <nav
      aria-label="Main navigation"
      className="
        fixed inset-x-0 bottom-0 z-50
        border-t border-border/70
        bg-background/95
        backdrop-blur-xl
        pb-[env(safe-area-inset-bottom)]
      "
    >
      <div className="mx-auto grid h-[50px] w-full max-w-[520px] grid-cols-3 px-5">
        {tabs.map(({ id, Icon, label }) => {
          const active = activeTab === id;

          return (
            <button
              key={id}
              type="button"
              aria-label={label}
              aria-current={active ? "page" : undefined}
              onClick={() => onTabChange(id)}
              className={`
                relative flex min-h-[48px] flex-col
                items-center justify-center gap-1
                rounded-xl text-xs font-medium
                transition-colors duration-200
                focus-visible:outline-none
                focus-visible:ring-2 focus-visible:ring-primary
                ${active ? "text-primary" : "text-muted-foreground hover:text-foreground"}
              `}
            >
              {active && <span className="absolute top-0 h-[3px] w-10 rounded-b-full bg-primary" />}

              <span className="relative">
                <Icon size={23} strokeWidth={active ? 2.5 : 1.8} aria-hidden="true" />
                {id === "messages" && unread > 0 && (
                  <span className="absolute -right-2 -top-1 min-w-4 rounded-full bg-primary px-1 text-center text-[9px] font-bold leading-4 text-primary-foreground">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
