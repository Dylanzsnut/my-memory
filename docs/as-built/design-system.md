---
name: Warm Archival Modernism
colors:
  surface: '#fffdf8'
  surface-dim: '#e3d8cc'
  surface-bright: '#fff8f3'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fef2e6'
  surface-container: '#f8ece0'
  surface-container-high: '#f2e6da'
  surface-container-highest: '#ece1d5'
  on-surface: '#201b14'
  on-surface-variant: '#594139'
  inverse-surface: '#352f28'
  inverse-on-surface: '#fbefe3'
  outline: '#8d7167'
  outline-variant: '#e2bfb4'
  surface-tint: '#aa3600'
  primary: '#a63500'
  on-primary: '#ffffff'
  primary-container: '#cd470b'
  on-primary-container: '#fffbff'
  inverse-primary: '#ffb59c'
  secondary: '#096b57'
  on-secondary: '#ffffff'
  secondary-container: '#9ef0d6'
  on-secondary-container: '#136f5b'
  tertiary: '#785600'
  on-tertiary: '#ffffff'
  tertiary-container: '#986d00'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbcf'
  primary-fixed-dim: '#ffb59c'
  on-primary-fixed: '#390c00'
  on-primary-fixed-variant: '#822800'
  secondary-fixed: '#a0f2d9'
  secondary-fixed-dim: '#85d6be'
  on-secondary-fixed: '#002019'
  on-secondary-fixed-variant: '#005141'
  tertiary-fixed: '#ffdea6'
  tertiary-fixed-dim: '#f7bd48'
  on-tertiary-fixed: '#271900'
  on-tertiary-fixed-variant: '#5d4200'
  background: '#fff8f3'
  on-background: '#201b14'
  surface-variant: '#ece1d5'
  bg-base: '#f6f1e7'
  bg-subtle: '#efe6d6'
  surface-raised: '#fbf6ec'
  ink-secondary: '#5c5344'
  ink-tertiary: '#756a58'
  line: '#e2d7c3'
  line-strong: '#cdbd9c'
  accent-deep: '#c74312'
  accent-soft: '#fdeadd'
  teal-soft: '#e0f0ea'
  gold-soft: '#fbf0cd'
  danger: '#b3372a'
  danger-soft: '#fbe7e2'
typography:
  display:
    fontFamily: Be Vietnam Pro
    fontSize: 40px
    fontWeight: '900'
    lineHeight: 44px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Noto Serif
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Noto Serif
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Be Vietnam Pro
    fontSize: 18px
    fontWeight: '800'
    lineHeight: 24px
    letterSpacing: -0.01em
  title-md:
    fontFamily: Be Vietnam Pro
    fontSize: 16px
    fontWeight: '700'
    lineHeight: 22px
    letterSpacing: -0.01em
  body-editorial:
    fontFamily: Noto Serif
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
  body-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Be Vietnam Pro
    fontSize: 13.5px
    fontWeight: '400'
    lineHeight: 21px
  label-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 14px
    fontWeight: '800'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Be Vietnam Pro
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: Be Vietnam Pro
    fontSize: 10.5px
    fontWeight: '800'
    lineHeight: 14px
    letterSpacing: 0.06em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1.25rem
  space-2xs: 0.25rem
  space-xs: 0.5rem
  space-sm: 0.75rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
---

## Brand & Style

This design system expresses "Warm Archival Modernism" — an aesthetic balancing the tactile permanence of archival notebooks and fine stationery with the fluid precision of modern, privacy-first mobile software. It treats memory capture not as cold transactional data entry, but as an intentional, trustworthy, and human repository.

The emotional tone is calm, grounded, and authoritative. Designed for thinkers, creators, and individuals seeking mindful record-keeping, the interface rejects stark, fluorescent digital whites in favor of warm stone, cream parchment, and rich charcoal ink. Crisp editorial serif accents introduce intellectual weight, while an ergonomic sans-serif delivers clear, glanceable utility. Physical cues — pill badges, warm ambient shadows, subtle paper-like borders, and tactile on-device status indicators — create reassurance that personal memories are safely kept on-device.

## Colors

The palette derives from physical archival materials: parchment paper, aged mineral inks, and vibrant accent pigments.

- **Primary (`#e4571e`)**: Vibrant terracotta orange. Serves as the primary brand touchpoint, dominant interactive triggers (FABs, primary actions), and focal highlights.
- **Secondary (`#14705c`)**: Soft pine/sage teal. Used exclusively for verification, on-device intelligence affirmations, audio/voice notes, and trusted citations.
- **Tertiary / gold (`#785600`)**: Deep ochre gold. Reserved for contextual notes, expiry states, and non-blocking warnings. Darkened from `#b8860b` on 2026-11-20 so text reaches ≥4.5:1 on `gold-soft`; do not revert for a warmer look.
- **Neutral (`#1c1710`)**: Deep charcoal ink. Replaces harsh blacks for core typography, active icons, and crisp outlines.
- **Semantic Pairing Principle**: Every functional chromatic color (`accent`, `teal`, `gold`, `danger`) pairs with a dedicated `*-soft` tint for pills, badges, and selected card states. This preserves text contrast and avoids visual fatigue on warm surfaces.
- **Dark Mode Adaptation**: In dark environments, backgrounds invert to deep charred wood (`#131009`, `#1a160e`), while text shifts to warm milk parchment (`#f4ecdc`), retaining the warm paper metaphor without stark contrast.

## Typography

The typographic hierarchy combines **Be Vietnam Pro** for structural interface elements with **Noto Serif** for editorial moments and memory quotes.

- **Primary UI & Mechanics (`Be Vietnam Pro`)**: Powers functional interactions, navigation labels, input fields, timestamps, and dense list text. Its contemporary geometric proportions ensure instant legibility at mobile densities.
- **Editorial Voice (`Noto Serif`)**: Brings reflective warmth to user-generated memory reflections, search quotes, empty states, and section headings. It grounds the UI in physical book craft.
- **Micro Tags & Eyebrows**: Set in all-caps using `label-sm` with deliberate tracking (`0.06em`) and extra-bold weights (`800`) to anchor scanning eyes.
- **Italic Treatment**: Reserve `Noto Serif` italic strictly for pull-quotes, system interpretations, and search recaps.

## Layout & Spacing

This design system uses a fluid mobile-first column model framed by an 8-point baseline grid with a 4-point sub-rhythm for micro-components.

- **Mobile Viewport Structure**: Outer canvas margins are fixed at `1.25rem` (20px) to maximize readability on narrow screens while preventing accidental edge taps. Grid gutters sit at `1rem` (16px).
- **Vertical Flow Rhythm**:
  - `space-2xs` (4px) to `space-xs` (8px) define tight component clustering (badge internal padding, icon-to-label gaps).
  - `space-sm` (12px) to `space-md` (16px) separate list items, inputs, and internal card compartments.
  - `space-lg` (24px) establishes the rhythm between memory clusters, day groups, and contextual modules.
  - `space-xl` (32px) and `space-2xl` (48px) separate global views and header hero blocks.
- **Safe Area Insets**: Floating elements (like navigation bars and primary FABs) maintain a mandatory `space-lg` buffer above the device home indicator.

## Elevation & Depth

Visual hierarchy does not use harsh artificial drops. Instead, it relies on soft tactile stacking, warm ambient occlusion, and delicate framing outlines.

- **Tonal Layering**: Depth is primarily established through surface transitions: Base background (`bg-base` / `#f6f1e7`) sits beneath primary cards (`surface` / `#fffdf8`), which in turn host nested elements on raised surfaces (`surface-raised` / `#fbf6ec`).
- **Low-Contrast Archival Outlines**: All interactive containers and floating surfaces possess a `1px` border using `line` (`#e2d7c3`). Focused controls, pills, and selected states transition to `line-strong` (`#cdbd9c`).
- **Warm Ambient Shadows**: Where physical separation is required (e.g., floating action buttons, elevated modals, and hero memory cards), shadows use a warm sepia tint:
  - *Resting card*: `0 4px 12px -2px rgba(60, 40, 10, 0.08)`
  - *Floating overlay / FAB*: `0 16px 36px -12px rgba(60, 40, 10, 0.22)`
  - *Dark mode equivalent*: Shadows transition to deep soot: `0 16px 36px -12px rgba(0, 0, 0, 0.65)`
- **Atmospheric Warm Glows**: Key hero areas may feature soft radial gradient tints behind surfaces (`rgba(228, 87, 30, 0.06)` combined with `rgba(20, 112, 92, 0.05)`) to replicate natural light falling on paper.

## Shapes

The shape system is rounded and organic, balancing structural utility with comfortable handheld interaction.

- **Base Radius (Roundedness 2)**: Core cards, dialogs, and panels use `0.5rem` to `1rem` (8px–16px) corner rounding. This creates a softened, non-aggressive card metaphor.
- **Specialized Pill Shapes (`999px`)**: Interactive buttons, input search shells, filter chips, and category tags (`Photo`, `Voice`, `Note`) utilize full pill rounding (`rounded-full` / `999px`) to emphasize touch targets.
- **Asymmetric Memory Bubbles**: User inquiries and search queries feature directional asymmetric corners (`16px 16px 16px 4px`), while archival system answers invert the asymmetry (`16px 16px 4px 16px`), visually denoting conversational origin.
- **Tactile Waveforms**: Audio visualization bars inside voice notes use `2px` rounded capsule corners.

## Components

### Buttons
- **Primary Action (Terracotta)**: Pill-shaped (`rounded-full`), background `accent` (`#e4571e`), text `#ffffff`. Padding: `12px 22px`. Pressed state scales down smoothly (`scale(0.97)`).
- **Secondary / Ghost**: Pill-shaped, background `surface` (`#fffdf8`), border `1px solid var(--line-strong)`, text `neutral` (`#1c1710`).
- **Floating Action Button (FAB)**: Deep terracotta pill or circular button anchored to the bottom right with warm ambient shadow.

### Badges & Pill Chips
- **Photo Badge**: Background `accent-soft` (`#fdeadd`), text `accent-deep` (`#c74312`), uppercase `label-sm` font, pill radius.
- **Voice Badge**: Background `teal-soft` (`#e0f0ea`), text `secondary` (`#14705c`), paired with miniature animated or static audio waveforms.
- **Note Badge**: Background `gold-soft` (`#fbf0cd`), text `tertiary` (`#785600`).
- **Interactive Chips**: Tap-to-filter pills with `1px solid var(--line-strong)` border. Selected state switches background to `accent-soft` with `accent-deep` text and border.

### Memory Cards
- **Base Structure**: Surface `surface` (`#fffdf8`), border `1px solid var(--line)`, radius `16px`, internal padding `16px`.
- **Content Hierarchy**: Date/time and category pill at top; editorial serif headline; optional thumbnail or waveform; subtle citation/verification badge at bottom.
- **Ephemeral Actions**: Swipe-to-action or card footers featuring dual-action "Keep" (teal accent) and "Trash" (`danger` soft `#fbe7e2` background with `#b3372a` icon/text).

### Inputs & Search Bars
- **Pill Search Shell**: Fully rounded (`999px`), background `surface-raised` (`#fbf6ec`), border `1.5px solid var(--line-strong)`. Placeholder styled in `ink-tertiary` (`#756a58`, ≥4.5:1 on `surface`);
inputs use 16px text so iOS Safari does not zoom the viewport on focus.
- **Form Text Fields**: Minimum height `44px` for touch accessibility, subtle bottom border or rounded frame with soft focus ring tinted in `accent`.

### Tactile On-Device Indicators
- **Local Vault Status**: Dedicated micro-capsule featuring an `8px` pulsating green-teal indicator dot, `teal-soft` fill, and text reading "ON-DEVICE ARCHIVE". Denotes privacy and local storage.

### Touch & Legibility Floor (2026-11-20)

- Every interactive control reviewed in `src/components/` has at least a 44px
  touch target, including filter chips, card menus, tag remove buttons and
  inline dismiss buttons.
- Body and status labels are at least 11px; inputs and textareas are 16px.
- `ink-tertiary` and `tertiary`/gold were darkened to meet WCAG AA (4.5:1) on
  their soft surfaces. Contrast is calculated, not yet axe-audited on device.

### Clean Bottom Tabs
- **Tab Bar**: Floating dock or docked bottom bar with `surface` background, top border `1px solid var(--line)`.
- **Tab Items**: Vertical stack of minimal stroke icon (2.2px line-width) and caption label (`label-sm`). Active item takes `accent` color with a subtle dot indicator below.