# Website Design Overhaul Plan - Retro Early Internet Aesthetic

## Overview

Transform the personal website into a retro early-internet (1990s-early 2000s) aesthetic while maintaining modern functionality and usability. The design will use basic HTML/CSS principles from the early web era but polished for contemporary viewing.

## Design Philosophy

- **Retro but Polished**: Capture the charm of early web design without the broken elements
- **Basic HTML First**: Rely primarily on semantic HTML with minimal CSS
- **Consistent Styling**: Unified design language across main site and webdisplay
- **Functional**: Maintain all current functionality while updating aesthetics

---

## Phase 1: Design System & Color Palette

### Color Scheme (Early Web Inspired)

- **Primary Background**: `#000080` (Navy Blue) or `#000000` (Black)
- **Secondary Background**: `#C0C0C0` (Silver/Gray) or `#FFFFFF` (White)
- **Accent Colors**:
  - `#00FF00` (Lime Green)
  - `#FF00FF` (Magenta/Fuchsia)
  - `#FFFF00` (Yellow)
  - `#00FFFF` (Cyan)
- **Text Colors**:
  - `#FFFFFF` (White on dark)
  - `#000000` (Black on light)
  - `#00FF00` (Green for links)
- **Link Colors**:
  - Unvisited: `#00FF00` (Bright Green)
  - Visited: `#00CC00` (Darker Green)
  - Hover: `#FFFF00` (Yellow)

### Typography

- **Primary Font**: `Courier New`, `monospace` (retro terminal feel)
- **Secondary Font**: `Times New Roman`, `serif` (classic web)
- **Headings**: Bold, larger sizes, possibly `<blink>` effect (CSS animation)
- **Body Text**: Standard serif or monospace

### Visual Elements

- **Borders**: Simple 2-3px solid borders, often with `inset`/`outset` effects
- **Backgrounds**:
  - Solid colors
  - Simple tiled patterns (checkerboard, dots)
  - Basic gradients (if any, very simple)
- **Buttons**:
  - 3D beveled appearance (`inset`/`outset` borders)
  - Simple hover states
  - Basic colors
- **Images**:
  - Simple borders
  - Alt text emphasized
  - Possibly pixelated/low-res aesthetic

---

## Phase 2: Main Website (`/public/`) Redesign

### 2.1 HTML Structure Simplification

- **Remove**: Complex flexbox/grid layouts (replace with tables or simple divs)
- **Simplify**: Navigation to basic horizontal list
- **Add**:
  - `<marquee>` elements (or CSS animation equivalent)
  - Simple `<hr>` dividers
  - Basic table layouts where appropriate
  - Visitor counter (optional, CSS-based)
  - "Under Construction" banner (optional, subtle)

### 2.2 Navigation Bar

- **Style**: Simple horizontal bar with basic links
- **Colors**: High contrast (e.g., navy background, bright text)
- **Hover**: Simple color change or underline
- **Mobile**: Basic dropdown or vertical list

### 2.3 Hero Section

- **Layout**: Centered, simple
- **Text**: Large, bold, possibly animated (blink/marquee)
- **Images**: Simple borders, basic styling
- **Background**: Solid color or simple pattern

### 2.4 Sections (About, Experience, Projects, etc.)

- **Layout**: Simple vertical stacking
- **Headers**: Large, bold, possibly with decorative borders
- **Content**: Basic paragraphs, simple lists
- **Cards/Boxes**: Simple borders, basic backgrounds
- **Timeline**: Simple vertical line with basic markers

### 2.5 Drawing Section (MNIST)

- **Canvas**: Simple border, basic styling
- **Controls**: Retro-styled buttons
- **Prediction Display**: Large, bold, possibly blinking

### 2.6 Contact Section

- **Layout**: Simple list or table
- **Links**: Bright colors, underlined
- **Icons**: Simple or text-based

### 2.7 Footer

- **Style**: Simple bar with basic text
- **Links**: Bright colors

---

## Phase 3: Webdisplay Integration & Styling

### 3.1 Integration Strategy

- **Option A**: Link from main site navigation (recommended)
- **Option B**: Embed as iframe (not recommended for retro aesthetic)
- **Option C**: Separate page with consistent styling

### 3.2 Webdisplay Styling Updates

- **Header**: Match main site header style
- **Background**: Consistent color scheme
- **Controls**: Retro-styled buttons and panels
- **Charts/Map**: Keep functionality, update colors to match palette
- **3D Viewer**: Maintain functionality, update container styling
- **Status Indicators**: Simple text-based or basic colored boxes

### 3.3 Navigation Between Sites

- **From Main Site**: Add "Flight Test Display" link in navigation
- **From Webdisplay**: Add "Back to Home" link
- **Consistent**: Same navigation style across both

---

## Phase 4: CSS Architecture

### 4.1 CSS Structure

- **Minimal CSS**: Basic styling only
- **No Frameworks**: Remove Font Awesome, use simple text/icons
- **Basic Animations**: Simple blink, marquee (CSS-based)
- **No Complex Transitions**: Basic hover states only

### 4.2 Key CSS Features

- **Borders**: `border: 3px outset #C0C0C0;` for 3D effect
- **Backgrounds**: Solid colors or simple patterns
- **Text**: Basic font families, simple sizing
- **Links**: Bright colors, underline on hover
- **Buttons**: 3D beveled appearance
- **Tables**: Basic borders, simple styling

### 4.3 Responsive Design

- **Approach**: Simple media queries
- **Mobile**: Vertical stacking, larger text
- **No Complex Breakpoints**: 2-3 breakpoints max

---

## Phase 5: JavaScript Simplification

### 5.1 Maintain Functionality

- **Keep**: All interactive features (drawing, predictions, navigation)
- **Simplify**: Remove complex animations
- **Update**: Event handlers to match retro aesthetic

### 5.2 Remove/Simplify

- **Complex Animations**: Replace with simple show/hide
- **Smooth Scrolling**: Keep but simplify
- **Intersection Observers**: Keep but simplify effects

---

## Phase 6: Assets & Content Updates

### 6.1 Images

- **Style**: Add simple borders
- **Alt Text**: Ensure all images have descriptive alt text
- **Optimization**: Maintain quality but consider retro aesthetic filters

### 6.2 Resume Integration

- **Link**: Add prominent link to Resume.pdf
- **Style**: Simple download button or link
- **Location**: Header or contact section

### 6.3 Icons

- **Replace**: Font Awesome with simple text or ASCII art
- **Style**: Basic symbols or text labels

---

## Phase 7: Testing & Refinement

### 7.1 Cross-Browser Testing

- **Modern Browsers**: Chrome, Firefox, Safari, Edge
- **Basic Compatibility**: Ensure core functionality works

### 7.2 Responsive Testing

- **Desktop**: Primary focus
- **Tablet**: Basic responsive adjustments
- **Mobile**: Simple vertical layout

### 7.3 Accessibility

- **Contrast**: Ensure text is readable
- **Keyboard Navigation**: Maintain functionality
- **Screen Readers**: Ensure semantic HTML

---

## Implementation Checklist

### Phase 1: Foundation

- [ ] Define final color palette
- [ ] Choose typography system
- [ ] Create base CSS file structure
- [ ] Set up design tokens/variables

### Phase 2: Main Site HTML

- [ ] Simplify HTML structure
- [ ] Update navigation
- [ ] Redesign hero section
- [ ] Update all sections (About, Experience, Projects, Drawing, Contact)
- [ ] Update footer
- [ ] Add resume link

### Phase 3: Main Site CSS

- [ ] Create retro color scheme
- [ ] Style navigation
- [ ] Style hero section
- [ ] Style all content sections
- [ ] Style drawing section
- [ ] Style contact section
- [ ] Style footer
- [ ] Add basic animations (blink, marquee)

### Phase 4: Webdisplay Integration

- [ ] Add navigation link from main site
- [ ] Update webdisplay HTML structure
- [ ] Apply retro styling to webdisplay
- [ ] Update webdisplay CSS
- [ ] Style controls and panels
- [ ] Add back navigation to main site
- [ ] Ensure consistent styling

### Phase 5: JavaScript Updates

- [ ] Review and simplify JavaScript
- [ ] Update event handlers for retro styling
- [ ] Test all interactive features
- [ ] Ensure smooth scrolling works

### Phase 6: Assets & Polish

- [ ] Update image styling
- [ ] Add resume link prominently
- [ ] Replace icons with text/simple symbols
- [ ] Test all links
- [ ] Verify all assets load correctly

### Phase 7: Testing

- [ ] Test in multiple browsers
- [ ] Test responsive design
- [ ] Test all interactive features
- [ ] Verify accessibility
- [ ] Check performance
- [ ] Final polish and adjustments

---

## Design Examples & Inspiration

### Early Web Characteristics to Include

1. **Simple Layouts**: Tables or basic divs, no complex grids
2. **Bright Colors**: High contrast, saturated colors
3. **Basic Typography**: Serif or monospace fonts
4. **Simple Borders**: 3D beveled effects
5. **Basic Animations**: Blinking text, scrolling marquees
6. **Simple Navigation**: Horizontal lists or basic menus
7. **Visitor Counters**: Optional, CSS-based
8. **"Under Construction"**: Optional, subtle banner
9. **Simple Forms**: Basic input styling
10. **ASCII Art**: Optional decorative elements

### Modern Elements to Keep

1. **Semantic HTML**: Proper structure for accessibility
2. **Responsive Design**: Basic mobile support
3. **Modern JavaScript**: Keep functionality, simplify presentation
4. **Performance**: Optimized loading
5. **Accessibility**: Maintain keyboard navigation, screen reader support

---

## Success Criteria

1. ✅ Consistent retro aesthetic across entire site
2. ✅ All functionality maintained
3. ✅ Responsive design works on mobile
4. ✅ Fast loading times
5. ✅ Accessible and keyboard navigable
6. ✅ Webdisplay integrated seamlessly
7. ✅ Resume easily accessible
8. ✅ Professional appearance despite retro styling

---

## Notes

- **Balance**: Retro aesthetic but polished and professional
- **Functionality First**: Don't sacrifice features for style
- **Consistency**: Same design language throughout
- **Accessibility**: Ensure contrast and readability
- **Performance**: Keep site fast and responsive
