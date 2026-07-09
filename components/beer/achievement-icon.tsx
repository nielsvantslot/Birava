import type { AchievementIcon } from "@/lib/achievements";

/** Stroke icons for the variety badges — honey via currentColor. */
export function AchievementGlyph({ icon }: { icon: AchievementIcon }) {
  switch (icon) {
    case "star":
      return (
        <svg viewBox="0 0 24 24">
          <path d="M12 3l2.5 5.3 5.8.8-4.2 4 1 5.7L12 16.1 6.9 18.8l1-5.7-4.2-4 5.8-.8z"></path>
        </svg>
      );
    case "pin":
      return (
        <svg viewBox="0 0 24 24">
          <path d="M12 21c4-3.5 6-6.6 6-9.5C18 7 15.5 4 12 4S6 7 6 11.5c0 2.9 2 6 6 9.5z"></path>
          <circle cx="12" cy="11" r="2.5"></circle>
        </svg>
      );
    case "badge":
      return (
        <svg viewBox="0 0 24 24">
          <path d="M12 3l2.2 4.6 5 .7-3.6 3.6.9 5.1L12 14.6 7.5 17l.9-5.1L4.8 8.3l5-.7z"></path>
        </svg>
      );
    case "glass":
      return (
        <svg viewBox="0 0 24 24">
          <path d="M9 3h6M12 3v4"></path>
          <path d="M7 21c-2 0-3-1.6-3-3.5C4 13 7 11 12 11s8 2 8 6.5c0 1.9-1 3.5-3 3.5z"></path>
        </svg>
      );
    case "pen":
      return (
        <svg viewBox="0 0 24 24">
          <path d="M4 20h4l10-10a2.8 2.8 0 00-4-4L4 16z"></path>
          <path d="M13.5 6.5l4 4"></path>
        </svg>
      );
    case "repeat":
      return (
        <svg viewBox="0 0 24 24">
          <path d="M4 12a8 8 0 018-8M20 12a8 8 0 01-8 8"></path>
          <path d="M16 4v4h-4M8 20v-4h4"></path>
        </svg>
      );
  }
}
