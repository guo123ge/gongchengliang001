---
name: Industrial Precision System
colors:
  surface: '#051424'
  surface-dim: '#051424'
  surface-bright: '#2c3a4c'
  surface-container-lowest: '#010f1f'
  surface-container-low: '#0d1c2d'
  surface-container: '#122131'
  surface-container-high: '#1c2b3c'
  surface-container-highest: '#273647'
  on-surface: '#d4e4fa'
  on-surface-variant: '#c2c6d6'
  inverse-surface: '#d4e4fa'
  inverse-on-surface: '#233143'
  outline: '#8c909f'
  outline-variant: '#424754'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e6a'
  primary-container: '#4d8eff'
  on-primary-container: '#00285d'
  inverse-primary: '#005ac2'
  secondary: '#ffb95f'
  on-secondary: '#472a00'
  secondary-container: '#ee9800'
  on-secondary-container: '#5b3800'
  tertiary: '#4edea3'
  on-tertiary: '#003824'
  tertiary-container: '#00a572'
  on-tertiary-container: '#00311f'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#ffddb8'
  secondary-fixed-dim: '#ffb95f'
  on-secondary-fixed: '#2a1700'
  on-secondary-fixed-variant: '#653e00'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#051424'
  on-background: '#d4e4fa'
  surface-variant: '#273647'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  title-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-code:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.05em
  button:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin-page: 24px
  panel-padding: 12px
  stack-gap: 8px
---

## Brand & Style
This design system is engineered for the high-stakes environment of industrial engineering and BIM (Building Information Modeling). The brand personality is authoritative, precise, and technologically advanced, designed to instill confidence in structural integrity and data accuracy. 

The aesthetic is **Enterprise Tech with Glassmorphic accents**. It balances the stability of a corporate "dark mode" with the futuristic feel of a high-end visualization tool. This is achieved through high-contrast accents against deep monochromatic backgrounds, subtle translucency in floating panels, and razor-sharp UI borders. The target audience—engineers and surveyors—requires a tool that feels like a professional instrument rather than a consumer app.

## Colors
The palette is rooted in deep structural tones to minimize eye strain during long periods of 3D modeling. 
- **Core Neutrals:** We use `#0F172A` (Deep Navy) for the primary application canvas and `#1E293B` (Charcoal) for interactive surfaces and panels.
- **Construction Blue:** Used as the primary action color, signifying selection, primary buttons, and structural "ready" states.
- **Industrial Orange:** Reserved for critical highlights, alerts, and quantity warnings.
- **Semantic Accents:** Success states use a vibrant Emerald green, while system-level borders use a semi-transparent white to create a "etched" look on the dark background.

## Typography
The typography system prioritizes legibility in data-dense environments. **Inter** is the primary typeface for its exceptional readability on digital displays. 

- **Technical Data:** For numerical quantities, rebar specifications (e.g., HRB400), and coordinates, use **JetBrains Mono** to ensure character differentiation (e.g., distinguishing '0' from 'O').
- **Hierarchy:** We use a strict weight hierarchy. Headlines are bold and tight-tracked, while body text uses regular weights with ample line height to prevent "text crowding" in property panels.
- **Labels:** Small labels use uppercase with slight letter spacing to maintain clarity at 11px.

## Layout & Spacing
The design system utilizes a **Functional Grid** approach. The primary workspace is an expansive 3D viewport, flanked by collapsible sidebars for object trees and property inspectors.

- **Desktop (1440px+):** A 12-column grid is used for overlaying modals, but the main layout uses a "Panel-Driven" model. Sidebars are fixed at 280px-320px.
- **Density:** High information density is required. Gutters are kept to a tight 16px to maximize visualization space. 
- **Reflow:** On smaller screens, sidebars transition into off-canvas drawers to preserve the 3D viewport's aspect ratio.

## Elevation & Depth
Depth is created through **Tonal Layering** and **Glassmorphism** rather than traditional heavy shadows.

- **Surface Level 0:** The 3D viewport and main background (#0F172A).
- **Surface Level 1:** Fixed sidebars and header (#1E293B) with a 1px border.
- **Surface Level 2 (Floating):** Modals, tooltips, and floating toolbars use a background-blur effect (backdrop-filter: blur(12px)) and a background color of `rgba(30, 41, 59, 0.7)`.
- **Outlines:** All containers feature a subtle `1px` border of `rgba(255, 255, 255, 0.1)`. Active states use a glow effect with the primary blue color rather than an offset shadow.

## Shapes
The shape language reflects modern industrial precision. We avoid perfectly square corners to keep the UI from feeling dated, but avoid "bubble" shapes that feel consumer-oriented.

- **Standard Containers:** Cards, panels, and input fields use a `8px` radius.
- **Interactive Elements:** Buttons and tags use a `6px` radius for a sharper, more technical feel.
- **Selections:** Selected items in a list or tree view use a `4px` radius to indicate precise focus.

## Components
- **Buttons:** Primary buttons are solid Blue (#3B82F6) with white text. Secondary buttons are ghost-style with a subtle white border. Action buttons in the viewport should use the glassmorphic style.
- **Inputs:** Darker than the surface level (#0F172A) with a focus ring in Primary Blue. Labels should be positioned above the field in `label-code` typography.
- **Quantity Chips:** Small badges used to show counts (e.g., rebar weight). Use a background of `rgba(245, 158, 11, 0.1)` with Orange text for warnings.
- **The Tree View:** Used for "Component Trees." Indentation should be 12px per level, using thin guide lines to show hierarchy.
- **Property Cards:** Grouped attributes within a sidebar. Use a header with a `1px` bottom border to separate sections.
- **3D Gizmos:** Use high-saturation Red (X), Green (Y), and Blue (Z) for coordinate manipulation, consistent with industry standards.