# Desktop OS MCP Server — Research & Design Notes

This document captures the rationale, design considerations, and platform capabilities for a future **Desktop OS MCP Server** — an MCP server that exposes OS-level automation tools to AI agents (GitHub Copilot, Claude, etc.), bridging the gap between browser automation (Playwright) and full desktop control.

---

## Motivation

Playwright MCP covers browser DOM. There is no widely adopted, well-maintained, MCP-native equivalent for **desktop OS automation**. This gap becomes visible when testing OS integration points such as:

- Web push notification bubbles (outside the browser window)
- System dialogs (file pickers, permission prompts)
- Tray icons and system menu interactions
- Cross-app flows (browser → Explorer → target app)
- Installer/uninstaller flows
- OS-level accessibility compliance audits

For this project specifically, the gap surfaces in **Phase 7 (Import & Sync)**: the Chrome web push notification that deep-links to `/mfa?jobId=…` cannot be observed or clicked by Playwright because it renders outside the browser viewport as an OS-level toast.

---

## Agent Architecture (with Desktop MCP)

```
GitHub Copilot / Claude (MCP client)
        │
        ├── playwright/*            ← browser DOM, network, screenshots
        ├── desktop/*               ← new OS MCP server (this project)
        │     ├── screenshot()          full desktop or window capture
        │     ├── click(x, y)           OS-level mouse injection
        │     ├── send_keys(text)        OS-level keyboard injection
        │     ├── find_window(title)     enumerate open windows
        │     ├── read_notification()    read queued OS notifications
        │     ├── ocr_region(x,y,w,h)   extract text from screen region
        │     └── get_accessibility_tree(hwnd)  UIA / AXUIElement tree
        └── filesystem / terminal   ← already available
```

---

## Platform Coverage

### Windows

#### Capability Pyramid (fall-through strategy)

```
WinRT UserNotificationListener   ← structured notification data (title, body, app)
        │
UIA / MSAA (UIAutomationClient)  ← accessible apps: standard controls, XAML, web
        │
Win32 HWND + SendMessage         ← apps with no accessibility provider
        │
SendInput (user32.dll)           ← raw mouse/keyboard injection, works on anything
        │
BitBlt / PrintWindow             ← screen capture, even occluded windows
        │
Vision / OCR (tesseract-node)    ← last resort, fully visual, no API dependency
```

#### Key Win32 APIs

| Capability | API |
|---|---|
| Screen capture | `BitBlt`, `PrintWindow` (`PW_RENDERFULLCONTENT` for hardware-accelerated) |
| Mouse injection | `SendInput` with `MOUSEINPUT` |
| Keyboard injection | `SendInput` with `KEYBDINPUT` |
| Window enumeration | `EnumWindows`, `FindWindow`, `GetWindowText` |
| Click a specific HWND | `PostMessage(hwnd, WM_LBUTTONDOWN, ...)` |
| Read window text | `GetWindowText`, `WM_GETTEXT` |
| UIA tree traversal | `UIAutomationClient.h` COM interface |
| Notification content | `Windows.UI.Notifications.Management.UserNotificationListener` (WinRT) |
| Process management | `CreateProcess`, `OpenProcess` |

#### Language Recommendation

- **Python + `pywin32` + `winrt`** — most complete Win32/WinRT coverage; `ctypes`/`cffi` for anything missing; fastest to build a broad surface
- **Node.js + `ffi-napi` + `nut-js`** — keeps the MCP server in the same ecosystem as the finance-tracker backend; `nut-js` wraps `SendInput` and screen capture

#### Known Limitations (Windows)

- **SIP equivalent**: none by default — Win32 has broad process access at user level
- **DRM-protected surfaces**: `PrintWindow` returns black for DRM content — OS-level block, not solvable from user space
- **Qt with OpenGL/RHI**: all content drawn into one opaque HWND; UIA sees nothing inside — fall through to coordinate/OCR approach
- **Elevated processes**: interacting with admin-elevated windows from a non-elevated process requires COM elevation or UAC

---

### macOS

#### Capability Pyramid

```
UserNotifications (UNUserNotificationCenter)  ← structured notification data
        │
Accessibility API (AXUIElement)               ← equivalent to UIA
        │
CGEvent / ApplicationServices                 ← equivalent to SendInput
        │
CGWindowListCreateImage                       ← screen capture, window enumeration
        │
Vision framework (Apple OCR)                  ← built-in on-device OCR, no Tesseract
```

#### Key macOS APIs

| Capability | API |
|---|---|
| Screen capture | `CGWindowListCreateImage` |
| Window enumeration | `CGWindowListCopyWindowInfo` |
| Mouse injection | `CGEventCreateMouseEvent` + `CGEventPost` |
| Keyboard injection | `CGEventCreateKeyboardEvent` + `CGEventPost` |
| Accessibility tree | `AXUIElement` (requires Accessibility permission grant) |
| Read element text | `AXValue` attribute on `AXUIElementRef` |
| Notification content | `UNUserNotificationCenter` |
| OCR | `VNRecognizeTextRequest` (Vision framework, built-in) |

#### Language Recommendation

- **Python + `pyobjc`** — clean access to all Cocoa/CoreGraphics/Accessibility/Vision APIs; direct equivalent of `pywin32` on Windows

#### Known Limitations (macOS)

- **SIP (System Integrity Protection)**: restricts DLL-equivalent injection and access to protected processes — more restrictive than Windows by default
- **Permission gates**: Screen Recording, Accessibility, and Input Monitoring each require explicit user grants in System Settings; cannot be bypassed programmatically
- **No `PostMessage` equivalent**: `CGEventPost` targets the application, not a specific subwindow — less surgical than Win32 `SendMessage`
- **Qt with hardware acceleration**: same as Windows — `QOpenGLWidget`/QML collapses to a single `CALayer`; `AXUIElement` sees nothing inside; fall through to coordinate/OCR

---

## UIA / AXUIElement — Inaccessible Elements

Not all apps expose a UIA/AXUIElement tree. Common offenders:

| App type | Why inaccessible | Workaround |
|---|---|---|
| Qt with OpenGL/RHI | Hardware-accelerated, single opaque surface | Screenshot + OCR, or enable `QT_ACCESSIBILITY=1` + implement `QAccessibleInterface` |
| DirectX / OpenGL games | Custom-drawn, no provider | Screenshot + coordinate |
| Legacy Win32 owner-drawn | No `IAccessible` registration | `FindWindow` + `PostMessage` |
| Java Swing/AWT | Uses Java Accessibility Bridge (separate) | Install + enable JAB |
| WPF custom controls | Developer overrode `AutomationPeer` | Source fix or coordinate fallback |
| Electron inner DOM | WebView2 UIA provider must be enabled | Enable renderer accessibility or use CDP |

### Qt-specific fix (source access required)

```cpp
// Enable accessibility globally
QAccessible::setActive(true);
// or set env var: QT_ACCESSIBILITY=1

// For custom owner-drawn widgets, implement an accessible interface:
class MyWidgetAccessible : public QAccessibleWidget {
    QString text(QAccessible::Text t) const override { ... }
    QAccessible::Role role() const override { return QAccessible::Button; }
};
QAccessible::installFactory(myAccessibleFactory);
```

---

## Real-Time Limitations

MCP is a **request/response protocol** — tool calls are RPC, not event streams. The agent cannot watch the screen continuously; it must explicitly poll.

### Timing constraints

| Scenario | Feasible now? |
|---|---|
| Take screenshot, analyze, act | ✅ Yes — one round trip (~1-4s) |
| Poll every N seconds for a change | ✅ Yes — slow but works |
| React to toast notification (5s window) before dismiss | ❌ Unreliable — round-trip too slow |
| Watch a video / animation | ❌ No temporal stream |

### Solution: event buffering inside the MCP server

The MCP server itself (not the LLM) runs a background watcher:

```
MCP server spawns native OS watcher thread
    → subscribes to WinRT NotificationListener / UNUserNotificationCenter (event-driven, instant)
    → queues events internally with timestamp
    → agent calls get_notification() at any point after triggering push
    → server returns buffered result
```

The OS-level detection is **instant and event-driven**. The LLM only needs to drain the buffer at some point after triggering the condition — sub-second reaction time is not required.

### Future: interruptible agents

True real-time reaction (agent interrupted by an OS event mid-turn) is not supported by current MCP or LLM infrastructure. Early work exists (Anthropic interruptible agents, OpenAI background tasks) but nothing production-ready as of early 2026.

---

## How This Unblocks Phase 7 Notification Testing

With the Desktop MCP server available to the `frontend-tester` agent, the current manual checklist in `test-plan/import-sync/implementation-plan.md` Section 10 becomes fully automated:

1. Playwright triggers the `mfa_required` sync state
2. Agent calls `desktop.read_notification()` → server returns buffered WinRT notification (title, body, app) — no polling race condition
3. Agent asserts title/body content
4. Agent calls `desktop.click(notif_x, notif_y)` → OS mouse injection clicks the toast
5. Playwright resumes — asserts browser navigated to `/mfa?jobId=…`
6. Remainder of MFA flow tested via standard DOM assertions

The CDP push simulation (documented in the plan) remains the fallback for environments without the Desktop MCP server.

---

## Recommended Stack

| Layer | Windows | macOS |
|---|---|---|
| Notification reading | `winrt` (`UserNotificationListener`) | `pyobjc` (`UNUserNotificationCenter`) |
| Accessibility tree | `comtypes` + UIAutomationClient COM | `pyobjc` + `ApplicationServices` |
| Mouse/keyboard | `pywin32` `SendInput` or `nut-js` | `pyobjc` `CGEvent` |
| Screen capture | `pywin32` `BitBlt` / `PrintWindow` or `mss` | `pyobjc` `CGWindowListCreateImage` or `mss` |
| OCR | `pytesseract` / `tesseract-node` | Apple `Vision` framework via `pyobjc` |
| MCP server layer | `@modelcontextprotocol/sdk` (Node.js) or `mcp` (Python) | same |

A shared interface layer (tool names, argument shapes) with platform-specific backends underneath allows the same agent prompts to work on both OS platforms.

---

## Relation to Existing MCP Ecosystem

- **Playwright MCP** (Microsoft, 2025) — browser-only, well-maintained, clear precedent
- **Windows Copilot Runtime** — Microsoft building AI agent capabilities into Windows; official OS-level tool APIs likely within 12–18 months
- **Computer Use (Anthropic) / Operator (OpenAI)** — use screenshot + click loops at OS level using vision models; a structured MCP server is more reliable and faster
- **Windows UI Automation (UIA)** — Microsoft's existing framework; building over UIA (rather than raw Win32) future-proofs against Microsoft shipping an official wrapper

The niche this fills: **desktop OS automation, MCP-native, cross-platform, structured (not vision-only)** — this gap exists as of early 2026.
