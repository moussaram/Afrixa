# Afrixa responsive application layout

## Purpose

The desktop and tablet experience uses one persistent application frame, inspired by the multi-column organization of Facebook on desktop. The mobile experience remains the existing mobile-first interface.

## Breakpoints

| Viewport | Layout |
| --- | --- |
| Below 768 px | Mobile navigation and mobile page layout |
| 768–1023 px | Fixed top bar, compact icon-only left navigation, central page |
| 1024–1439 px | Fixed top bar, expanded left navigation with labels, central page |
| 1440 px and above | Expanded left navigation, central page, contextual right rail |

## Shared frame

- Top bar: Afrixa identity, search, create shortcut, messages, and account entry.
- Left navigation: primary destinations and creator, seller, wallet, order, advertising, and settings areas.
- Center: active route content. Route changes replace this content without removing the persistent application frame.
- Right rail: quick links and contextual information on wide displays.
- Notification unread count is loaded once in the authenticated application frame and shared with the mobile and desktop navigation components.

## Mobile preservation

The desktop top bar and side rails are hidden below 768 px. The shell removes its desktop top offset and side margins on mobile. The original bottom navigation remains active on mobile and is hidden on tablet/desktop.

## Validation matrix

Manually inspect at 390, 768, 1024, 1366, and 1920 CSS pixels:
- Home/video feed, stories rail, player controls, comments/share/product overlays.
- Discover and marketplace grids.
- Profile and profile menu.
- Messages list and conversation.
- Notifications, settings, verification screens.
- Live setup, broadcast and viewer.
- Create/upload flows and dialogs.

Check for fixed/sticky elements that need to be offset from the persistent top bar or side navigation. Do not assume the layout is production-ready until build/lint checks and this visual matrix pass.
