import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  LayoutDashboard,
  ScrollText,
  Users,
  Home,
} from "lucide-react";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type AdminNavGroup = {
  title: string;
  items: AdminNavItem[];
};

export const adminNavGroups: AdminNavGroup[] = [
  {
    title: "ระบบ",
    items: [
      { href: "/admin", label: "ภาพรวม", icon: LayoutDashboard },
      { href: "/admin/users", label: "บัญชีผู้ใช้", icon: Users },
      { href: "/admin/families", label: "ครอบครัว", icon: Home },
    ],
  },
  {
    title: "ข้อมูล",
    items: [
      { href: "/admin/tax-rules", label: "กฎภาษี", icon: BookOpen },
      { href: "/admin/audit", label: "ประวัติการเปลี่ยนแปลง", icon: ScrollText },
    ],
  },
];

export const adminPageTitles: Record<string, string> = {
  "/admin": "ภาพรวมระบบ",
  "/admin/users": "บัญชีผู้ใช้",
  "/admin/families": "ครอบครัว",
  "/admin/tax-rules": "กฎภาษี",
  "/admin/audit": "ประวัติการเปลี่ยนแปลง",
};
