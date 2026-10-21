
import { Home, UserRound } from "lucide-react";

export type MainTab = "rooms" | "profile";

type BottomNavProps = {
  activeTab: MainTab;
  onTabChange: (tab: MainTab) => void;
};

const tabs = [
  { id: "rooms" as const,Icon: Home },
  { id: "profile" as const,Icon: UserRound },
];

export default function BottomNav({
  activeTab,
  onTabChange,
}: BottomNavProps) {
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
      <div className="mx-auto grid h-[50px] w-full max-w-[520px] grid-cols-2 px-5">
        {tabs.map(({ id, Icon }) => {
          const active = activeTab === id;

          return (
            <button
              key={id}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => onTabChange(id)}
              className={`
                relative flex min-h-[48px] flex-col
                items-center justify-center gap-1
                rounded-xl text-xs font-medium
                transition-colors duration-200
                focus-visible:outline-none
                focus-visible:ring-2 focus-visible:ring-primary
                ${
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }
              `}
            >
              {active && (
                <span className="absolute top-0 h-[3px] w-10 rounded-b-full bg-primary" />
              )}

              <Icon
                size={23}
                strokeWidth={active ? 2.5 : 1.8}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
