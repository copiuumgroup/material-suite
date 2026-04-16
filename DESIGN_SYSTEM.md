# Material Suite: Professional Design System

A high-performance, asset-focused design language for the Material Suite. This system prioritizes technical precision (the "Studio") while maintaining a premium, modern aesthetic (the "Suite").

## 📐 Geometry Hierarchy

To balance modern aesthetics with technical utility, we use a strict radius hierarchy:

- **Section Containers (16px)**: Used for main app areas like the Vault, YTDLP downloader, and the Studio rack background.
  - Tailwind: `rounded-2xl`
- **Interactive Elements (8px)**: Used for buttons, chips, knobs, and inputs. This provides a sharp, professional focus.
  - Tailwind: `rounded-lg`
- **Circular Context**: Only reserved for purely circular metaphors (like the inner center of a knob or the play button).

## 🎨 Color & Theme

The Suite is **Host-Native**. It does not enforce a rigid brand color; instead, it adopts the user's environment.

- **Primary Accent**: Dynamically fetched from the Host OS using Electron's `systemPreferences`.
  - CSS Variable: `--color-primary`
- **Surface**: Pure Black (`#000000`) or Deep Night Gray to allow audio visualizers to pop with maximum contrast.
- **Glassmorphism**: 
  - **Studio Glass**: `backdrop-blur-md` with 30% alpha for subtle depth.
  - **Deep Glass**: `backdrop-blur-3xl` for high-impact overlays.

## 🖱️ Interaction Rules

- **Snappiness**: All transitions are set to **150ms** (`cubic-bezier(0.1, 0.9, 0.2, 1)`) for an industrial feel.
- **Active State**: Use `scale-95` on clicks to provide tactile "mechanical" feedback.
- **Hover State**: Subtle opacity lift and 2px translation for depth.

## 🏗️ Class Naming Convention

We use the `suite-` prefix for all custom project styles to distinguish them from standard tailwind or legacy component libraries.

- **Foundational Styles**:
  - `.suite-glass-subtle`: 10% alpha, medium blur.
  - `.suite-glass-deep`: 20% alpha, max blur.
- **Component Styles**:
  - `.suite-button` / `.suite-button-primary` (8px radius, tight tracking)
  - `.suite-input` (8px radius, monospaced tech)
  - `.suite-chip` (8px radius, high density status)
- **Geometry Tokens**:
  - `--radius-container`: 16px
  - `--radius-element`: 8px
