import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Boxes,
  Users,
  Clock3,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    title: "ภาพรวม",
    items: [
      { href: "/members", label: "สมาชิกครอบครัว", icon: Users },
      { href: "/dashboard", label: "ภาพรวมทรัพย์สิน", icon: LayoutDashboard },
      { href: "/assets", label: "รายการทรัพย์สิน", icon: Boxes },
    ],
  },
  {
    title: "การวางแผน",
    items: [
      { href: "/timeline", label: "Wealth Transfer Plan", icon: Clock3 },
    ],
  },
];

export const pageTitles: Record<string, string> = {
  "/dashboard": "ภาพรวมทรัพย์สิน",
  "/assets": "รายการทรัพย์สิน",
  "/members": "สมาชิกครอบครัว",
  "/timeline": "Wealth Transfer Plan",
};
