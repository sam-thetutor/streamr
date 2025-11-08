# Streamr Theme System

## Overview
A unified, modern theme system with glassmorphism effects for the Streamr application.

## Color Palette

### Primary Colors
- **Primary**: `#667eea` (Purple-Blue)
- **Secondary**: `#f5576c` (Pink-Red)
- **Accent**: `#4facfe` (Cyan-Blue)

### Gradients
- `--gradient-primary`: Purple to Blue
- `--gradient-secondary`: Pink to Red
- `--gradient-accent`: Cyan to Blue
- `--gradient-success`: Green gradient
- `--gradient-warning`: Orange gradient

## Glassmorphism Classes

### Glass Cards
```css
.glass              /* Basic glass effect */
.glass-strong       /* Stronger blur effect */
.glass-hover        /* Adds hover animation */
```

### Glass Buttons
```css
.btn-glass          /* Basic glass button */
.btn-glass-primary  /* Primary gradient button */
.btn-glass-secondary /* Secondary gradient button */
.btn-glass-accent   /* Accent gradient button */
```

### Glass Cards
```css
.card-glass         /* Basic glass card */
.card-glass-strong  /* Stronger blur card */
```

## Typography

### Title Classes
```css
.title-primary      /* Bold primary title */
.title-secondary    /* Semibold secondary title */
.title-gradient     /* Gradient text effect */
```

### Text Gradients
```css
.text-gradient-primary   /* Primary gradient text */
.text-gradient-secondary /* Secondary gradient text */
.text-gradient-accent    /* Accent gradient text */
```

## Usage Examples

### Glass Card
```jsx
<div className="card-glass">
  <h2 className="title-primary">Card Title</h2>
  <p>Card content</p>
</div>
```

### Glass Button
```jsx
<button className="btn-glass btn-glass-primary">
  Click Me
</button>
```

### Gradient Title
```jsx
<h1 className="title-gradient">Streamr</h1>
```

## CSS Variables

All theme variables are available via CSS custom properties:
- `--color-*` - Colors
- `--glass-*` - Glassmorphism variables
- `--font-*` - Typography
- `--spacing-*` - Spacing
- `--radius-*` - Border radius
- `--shadow-*` - Shadows
- `--transition-*` - Transitions
- `--gradient-*` - Gradients

## Dark Mode

The theme automatically adapts to dark mode using `prefers-color-scheme: dark`.

