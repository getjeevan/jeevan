# VPNWatch Design Guidelines

## Design Approach: Material Design System
**Rationale**: Data-heavy operational dashboard requiring clear visual feedback, structured layouts, and professional presentation for network operations teams.

## Core Design Principles
- **Information Density First**: Maximize data visibility while maintaining clarity
- **Status-Driven Design**: Visual hierarchy emphasizes tunnel health states
- **Operational Efficiency**: Reduce clicks, enable quick scanning, support rapid decision-making
- **Professional Restraint**: Clean, technical aesthetic appropriate for NOC environments

## Typography System

**Font Stack**: Roboto (via Google Fonts CDN)
- **Page Headers**: Roboto Medium, 28px (text-2xl)
- **Section Headers**: Roboto Medium, 20px (text-xl)
- **Data Tables**: Roboto Regular, 14px (text-sm) for rows, Roboto Medium 14px for headers
- **Status Badges**: Roboto Medium, 12px (text-xs), uppercase tracking
- **Metrics/Numbers**: Roboto Mono, 16px (text-base) for numerical data
- **Body Text**: Roboto Regular, 16px (text-base)

## Layout System

**Spacing Scale**: Tailwind units of 2, 4, 6, 8, 12, 16
- Component padding: p-4 to p-6
- Section spacing: py-8 to py-12
- Card gaps: gap-4 to gap-6
- Table cell padding: px-4 py-3

**Grid Structure**:
- Main dashboard: Full-width container with max-w-7xl
- Header: Fixed top navigation (h-16)
- Sidebar (if multi-firewall): w-64, collapsible to w-16
- Content area: Responsive with proper margins (px-6 to px-8)

## Component Library

### Navigation
**Top App Bar**:
- Fixed header with application name, firewall selector dropdown, refresh controls
- Height: h-16
- Contains: Logo/app name (left), firewall selector (center), manual refresh + settings (right)
- Elevated shadow for depth separation

### Data Display Components

**Primary Table (VPN Tunnel List)**:
- Sticky header row
- Alternating row treatment for readability
- Columns: Status indicator (icon), Tunnel Name, Peer IP, IKE State, IPsec State, Encryption, Traffic (Bytes In/Out), Last Checked
- Row height: 52px minimum for touch-friendly interaction
- Sortable columns with arrow indicators
- Row hover state for interactivity

**Status Indicators**:
- Circular badges (w-3 h-3) inline with tunnel name
- Icon + text combinations for states (checkmark for UP, alert for DOWN, warning for flapping)
- Consistent positioning in leftmost column

**Metric Cards** (Dashboard Overview):
- Grid layout: 4 cards on desktop (grid-cols-4), 2 on tablet (md:grid-cols-2), 1 on mobile
- Card structure: Large number (metric value), label below, status trend indicator
- Cards show: Total Tunnels, Active (UP), Down, Flapping
- Card padding: p-6, rounded corners

**Filters Panel**:
- Horizontal bar above table
- Contains: Search input (tunnel name), status filter chips, firewall filter dropdown
- Compact height to preserve vertical space for data

### Action Components

**Buttons**:
- Primary action (Manual Refresh): Elevated, medium size
- Secondary actions (Export, Settings): Outlined or text style
- Icon-only buttons for compact spaces (refresh in header)
- Button heights: h-10 for primary, h-9 for secondary

**Loading States**:
- Skeleton loaders for table rows during fetch
- Indeterminate progress bar at top of screen during polling
- Spinner for initial load

### Information Display

**Firewall Connection Card** (Settings/Config):
- Shows: Firewall name, management IP, PAN-OS version, API type, polling interval
- Edit controls inline
- Status indicator for connectivity

**Empty States**:
- Centered message with illustrative icon
- "No tunnels configured" or "No firewalls connected" messaging
- Call-to-action button to add configuration

## Animations

**Minimal Motion**:
- Smooth status transitions: 200ms ease for badge changes
- Table row updates: Subtle highlight flash (500ms) when data refreshes
- Loading spinners: Continuous rotation
- No scroll-based animations
- Page transitions: Simple fade (150ms)

## Responsive Behavior

**Desktop (lg: 1024px+)**:
- Full table with all columns visible
- 4-column metric card grid
- Side-by-side layouts where applicable

**Tablet (md: 768px)**:
- Table scrolls horizontally if needed
- 2-column metric grid
- Collapsed navigation to icons only

**Mobile (base)**:
- Stack cards vertically
- Table becomes card-based list view with expandable rows
- Prioritize status visibility and tunnel name
- Hamburger menu for navigation

## Icons

**Library**: Material Icons (via CDN)
- Status: check_circle, error, warning, sync
- Actions: refresh, settings, filter_list, search
- Navigation: menu, close, expand_more
- Data: vpn_lock, network_check, security

## Data Visualization

**Traffic Metrics**:
- Compact bar representations for bytes in/out within table cells
- Numerical values with appropriate units (KB, MB, GB)

**Timestamp Display**:
- Relative time for "Last Checked" (e.g., "2 minutes ago")
- Tooltip shows absolute timestamp on hover

## Accessibility

- ARIA labels for all status indicators
- Keyboard navigation through table rows
- Focus indicators on interactive elements
- Sufficient contrast ratios for status badges
- Screen reader announcements for status changes

## Images

**No hero images required** - This is a functional dashboard application focused on operational data display. All visual interest comes from structured data presentation and status indicators.