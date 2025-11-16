# Visual Claude - Complete Feature & UX Interaction List

## 1. SELECTION FEATURES

### 1.1 Single Element Selection
- **Click Selection**: Single-click on any DOM element to select it for editing
- **Selection Timeout**: 250ms delay to distinguish between single and double-click
- **Visual Feedback**: Selected element gets blue outline (2px solid #2563eb) with 2px offset
- **Deselection**: Click on empty space or press Escape to deselect

### 1.2 Area Selection (Drag Selection)
- **Drag-to-Select**: Click and drag to create rectangular selection area
- **Minimum Distance**: Requires 5px movement to trigger selection (MIN_DRAG_DISTANCE)
- **Visual Feedback**:
  - Real-time blue rectangle showing drag bounds
  - Tooltip showing dimensions in "WxH" format
  - Updates position with cursor movement (throttled at 16ms)
- **Multi-Element**: Selects all elements within the drag bounds
- **Element Count Badge**: Shows "N elements · WxH" in inline input

### 1.3 Hover Highlighting
- **Hover Detection**: Automatically highlights element under cursor when not dragging/editing
- **Throttled Updates**: Hover checking throttled at 60ms intervals for performance
- **Visual Feedback**: Element gets `.vc-element-highlight` class
- **Tooltip Label**: Shows element tag name near cursor with small yellow tooltip
- **Disabled States**: Hover disabled during:
  - Drag operations
  - Text editing
  - Inline input open
  - Element already selected
  - Processing/AI analysis

## 2. EDITING FEATURES

### 2.1 Text Editing
- **Double-Click to Edit**: Double-click text-editable elements (p, span, h1-h6, li, a, div, etc.)
- **Text Editor Modal**: Floating modal appears near the element
  - Label shows "Edit [tag] text"
  - Textarea with full current text pre-filled
  - Preview shows: "Current: '[first 100 chars]...'"
  - Save on Ctrl/Cmd+Enter or click Save button
  - Cancel on Escape or click Cancel button
- **Instant Feedback**: DOM updates immediately upon save
- **History Tracking**: Changes added to history as "Text Edit" with old→new preview
- **Minimum Changes**: Saves only if text differs from original

### 2.2 AI Instructions (Visual)
- **Selection + AI**: After selecting elements, can choose "AI" action from menu
- **Inline AI Input**: Opens inline input modal for typing AI instruction
- **Instruction Types**:
  - Style changes: "Make background darker"
  - Layout changes: "Center the content"
  - Content changes: "Add icons to this list"
  - Interaction changes: "Add hover effect"
- **AI Instruction Storage**: Instead of live preview, stores instruction as comment annotation
- **Comment Annotations**: Figma-style comment bubbles appear on element:
  - Fixed-position speech bubble icon
  - Tooltip shows full instruction text
  - Auto-positioned to right of element
  - Stored with full context (screenshot, bounds, element info)

### 2.3 Direct DOM Manipulation
- **Deprecated Live Preview**: Old preview system no longer used
- **Backend Processing**: AI instructions processed by Claude Code backend
- **Batch Processing**: Supports batching large change sets (max 6000 tokens)
- **DOM Changes Applied**: Backend applies changes, code changes committed to repo

## 3. VISUAL MANIPULATION

### 3.1 Drag & Move Element
- **Drag Handle**: Left-side Notion-style drag handle appears when element selected
  - 24x24px visible handle with 6-dot icon
  - Larger invisible hitbox (±8px) to prevent flickering
  - Positioned left of element, vertically centered
  - `cursor-grab` on hover, `cursor-grabbing` when dragging
- **Move Start**: Click drag handle and drag element
- **Visual Feedback During Drag**:
  - Element becomes semi-transparent (0.8 opacity)
  - Fixed positioning applied for precise control
  - z-index raised to 999999
  - pointer-events: none to prevent interference

### 3.2 Reorder Mode (Intelligent)
- **Auto-Detection**: System detects if drag is horizontal or vertical sibling reordering
- **Trigger**: When dragging in aligned layout with siblings, enters reorder mode
- **Visual Feedback**:
  - Cursor changes to directional indicator (vertical/horizontal)
  - Placeholder slot shows where element will drop
  - Sibling elements animate with smooth easing (200ms) to make space
  - "vc-reordering" class added to element
- **Insert Positioning**: Shows insertion point (before or after target)
- **Layout Context Detection**:
  - Detects flexbox or grid layout
  - Determines if layout is vertical or horizontal
  - Measures gap spacing between siblings
- **Shift Override**: Hold Shift to force free-drag mode instead of reorder

### 3.3 Reorder Snap-Back
- **Invalid Drop**: If user releases outside valid sibling, element snaps back to original position
- **Original DOM Restoration**: Element repositioned to original parent/sibling
- **Original Styles Restored**: All transform, position, z-index restored
- **Not Added to History**: Invalid operations don't create history entries

### 3.4 Free-Drag Mode (Transform)
- **Apply Transform**: Uses CSS translate() transform instead of reordering
- **Boundary Constraints**:
  - Element constrained to parent container boundaries
  - Prevents dragging element outside valid area
  - Calculated from parent's padding/margin
- **Cursor Feedback**:
  - `cursor-move` when hovering over element
  - Crosshair cursor when Shift held to indicate free-drag override
- **Drop Target Validation**:
  - Shows green highlight on valid drop zones
  - Shows warning icon on invalid drop zones
  - Displays validation reason in tooltip
- **Prevents**:
  - Dropping into itself or its children
  - Dropping into incompatible parent elements

### 3.5 Resize Element
- **Resize Handles**: 8-point resize system when element selected
  - 4 corner handles (NW, NE, SW, SE)
  - 4 edge handles (N, S, E, W)
  - All appear as blue circles (3x3px) with white borders
  - Positioned around element border
- **Resize Types**:
  - Corner dragging: Resize in both dimensions
  - Edge dragging: Resize in one dimension
  - Aspect Ratio Maintained**: Always maintains for images, can be forced with Shift key
- **Minimum/Maximum Constraints**:
  - Minimum size based on content (text width, etc.)
  - Maximum size based on parent container
  - Content-aware sizing prevents collapsing
- **Live Updates**: Resize handles position updates during drag

### 3.6 Transform History
- **Move Change**: Added as "transform" type with preview "Moved element"
- **Resize Change**: Added as "transform" type with preview "Resized to WxH"
- **Reorder Change**: Added as "reorder" type with preview "Reordered from index X to Y"
- **Stored Data**: Includes selector, old styles, new styles for undo/redo

## 4. TOOLBAR/UI ELEMENTS

### 4.1 Control Bar (Bottom Right Pill)
- **Design Upload Button**: Opens design-to-code modal
  - Icon: Image icon
  - Tooltip: "Create from Design"
- **History Panel Toggle**: Shows/hides change history sidebar
  - Icon: Clock with counter-clockwise arrows
  - Badge: Shows count of changes (red badge)
  - Highlight: Blue background when panel open
  - Tooltip: "Change History (Cmd+Shift+H)"
- **Edit/View Mode Toggle**: Switches between edit and view modes
  - Icon: Pencil (edit mode) or Eye (view mode)
  - Background: Blue when in edit mode, transparent in view mode
  - Tooltip: "Edit Mode - Click to switch to View Mode" (or vice versa)
  - Position: Rightmost button, rounded-right corners
- **Dividers**: Gray vertical divider lines between button groups
- **Styling**: Cream background (#fffefc), subtle shadow, pill-shaped (rounded-full)
- **Hover Effects**: Smooth transitions, active state scales to 0.95

### 4.2 Action Menu (Floating Context Menu)
- **Trigger**: Appears when element is clicked/selected
- **Position**: Floats above/below element, horizontally centered
- **Actions**:
  - **Edit** (E key): Opens text editor if element is text-editable
  - **AI** (A key): Opens inline input for AI instructions
- **Auto-Position**: Moves below element if insufficient space above
- **Button Style**: Icon + label, rounded, smooth transitions
- **Keyboard Shortcuts**: E for Edit, A for AI (when menu visible)

### 4.3 Status Indicator (Bottom Left)
- **Processing State**:
  - Shows spinner icon with "Processing..."
  - Blue background (#2563eb)
  - Appears in bottom-left corner
  - Auto-hides after 120s with page reload
- **Complete State**:
  - Shows "Done ✓" with green background (#22c55e)
  - Auto-fades out after 2 seconds
  - Triggers page reload for fresh content
- **Error State**:
  - Shows "Error - Reloading..." message
  - Auto-reloads page after 500ms
- **Animations**: Smooth fade transitions

## 5. KEYBOARD SHORTCUTS

### 5.1 Global Shortcuts
- **Cmd/Ctrl+Shift+E**: Toggle between Edit Mode and View Mode
- **Cmd/Ctrl+Shift+H**: Toggle change history panel open/closed
- **Cmd/Ctrl+Z**: Undo last change
- **Cmd/Ctrl+Shift+Z**: Redo last undone change

### 5.2 Edit Mode Shortcuts
- **Escape**:
  - Close any open modals (inline input, text editor, design modal, action menu)
  - Deselect selected element
  - Remove hover highlights
  - Exit reorder mode
  - Force cleanup of stuck floating elements
  - Cancel any in-progress drags
  - Full system reset

### 5.3 Action Menu Shortcuts (When Menu Visible)
- **E**: Execute Edit action (open text editor or fallback to AI)
- **A**: Execute AI action (open inline input for instructions)

### 5.4 Text Editor Shortcuts
- **Cmd/Ctrl+Enter**: Save text changes
- **Escape**: Cancel editing and close modal

### 5.5 Inline Input Shortcuts
- **Enter**: Send AI instruction (Shift+Enter for newline)
- **Escape**: Cancel and close modal

### 5.6 Design Modal Shortcuts
- **Cmd/Ctrl+Enter**: Submit design analysis (if prompt entered)
- **Escape**: Close modal

## 6. MODALS & PANELS

### 6.1 Inline Input Modal
- **Trigger**: Appears after area selection (drag to select multiple elements)
- **Position**: Fixed position, auto-positioned to stay in viewport
- **Content**:
  - Badge showing "N elements · WxH"
  - Textarea with placeholder: "What would you like Visual Claude to do?"
  - Cancel and Send buttons
- **Behavior**:
  - Auto-focused textarea
  - Send on Enter (Shift+Enter for newline)
  - Dismissible with Escape or Cancel button
- **Styling**: White background, gray border, shadow, rounded corners
- **Min/Max Width**: 300px-400px

### 6.2 Text Editor Modal
- **Trigger**: Double-click on text-editable element or click "Edit" action menu item
- **Position**: Fixed, positioned below element, stays in viewport
- **Content**:
  - Label: "Edit [tag] text"
  - Textarea with current text
  - Preview box: "Current: '[first 100 chars]...'"
  - Cancel and Save buttons
- **Behavior**:
  - Auto-focused, text pre-selected
  - Save on Cmd/Ctrl+Enter or Save button
  - Cancel with Escape or Cancel button
  - Supports multi-line editing (3 rows minimum)
- **Styling**: White background, monospace preview, resizable textarea
- **Min/Max Width**: 320px-500px

### 6.3 Design-to-Code Modal
- **Trigger**: Click image upload button in control bar
- **Layout**: Centered modal with max 4x height
- **Header**:
  - "Create Component from Design" title
  - Close button (X icon)
- **States**:
  - **Upload State**: Drag-drop zone, file picker, paste support
  - **Preview State**: Image thumbnail, remove button
  - **Input State**: Textarea for design description, analysis error display
  - **Processing State**: Multi-step progress indicator with spinners
  - **Complete State**: Success message, auto-close after 1.5s
- **Upload Options**:
  - Drag-drop image onto zone
  - Click "Browse Files" button
  - Paste image with Cmd/Ctrl+V
- **Image Support**: All image types (JPEG, PNG, etc.)
- **Styling**: Modern card design, blue accents, shadows
- **Animations**: Smooth transitions between states

### 6.4 History Panel Sidebar
- **Trigger**: Click history clock button or Cmd/Ctrl+Shift+H
- **Position**: Fixed left sidebar, animates in from left
- **Dimensions**: 384px (w-96) width, full height
- **Header**:
  - History icon + "Change History" title
  - Change count badge (blue)
  - Close button (X)
- **Action Buttons**:
  - Select All
  - Deselect All
  - Clear All (red text, right-aligned)
- **Change List**:
  - Empty state: "No changes yet" with icon
  - Change items: Scrollable list with:
    - Checkbox for selection
    - Type badge (colored: text/green, AI/orange, transform/blue, reorder/purple)
    - Timestamp ("Just now", "5m ago", "2h ago", etc.)
    - Element selector (monospace, truncated)
    - Change preview (human-readable description)
    - Delete button (red on hover)
- **Footer**:
  - "X of N selected" counter
  - "Commit Selected" button (outline, blue text)
  - "Commit All" button (filled, blue background)
- **Behavior**:
  - Checkbox toggling updates selection
  - Delete removes individual change
  - Can commit subset or all changes
  - Auto-closes on commit
- **Styling**: Cream background (#fffefc), subtle shadows, smooth animations
- **Scroll**: Full-height scrollable content area

## 7. VISUAL FEEDBACK & INDICATORS

### 7.1 Selection Indicators
- **Element Highlight**: Yellow/amber background on hover elements
- **Selected Outline**: 2px solid blue outline on selected element
- **Selection Rectangle**: Animated blue rectangle during drag selection
- **Selection Info Tooltip**: Real-time dimension display during drag
- **Element Label Tooltip**: Shows tag name/type above hovered element

### 7.2 Drag & Drop Feedback
- **Valid Drop Zone**: Green highlight border/glow on compatible parents
- **Invalid Drop Zone**: Red warning icon with validation reason
- **Reorder Slot**: Visual placeholder showing drop position with "Drop here" label
- **Sibling Animation**: Smooth 200ms slide animation when siblings make space
- **Cursor Changes**:
  - `cursor-grab` on drag handle
  - `cursor-grabbing` while dragging
  - `cursor-move` on element center
  - `cursor-[direction]-resize` on resize handles
  - Crosshair when Shift held for free-drag override

### 7.3 Element State Styling
- **Hovering**: `.vc-element-highlight` class applied
- **Selected**: `.vc-visual-edit-selected` class with blue outline
- **Reordering**: `.vc-reordering` class applied, semi-transparent
- **Being Dragged**: opacity: 0.8, position: fixed, z-index: 999999

### 7.4 Loading & Processing
- **Processing**: Blue spinner indicator with "Processing..." text
- **Complete**: Green checkmark "Done ✓"
- **Error**: Red warning message "Error - Reloading..."
- **Design Analysis**: Multi-step progress with spinners for each stage
- **Batch Operations**: Numbered progress (e.g., "Batch 1/3")

### 7.5 Comment Annotations
- **Speech Bubble Icon**: Positioned to right of element
- **Fixed Positioning**: Stays visible during page scroll
- **Tooltip**: Full instruction text visible on hover
- **Visual Design**: White icon, subtle shadow, comment-style appearance
- **Auto-Cleanup**: All annotations removed when history cleared

## 8. MODES & CONTEXTS

### 8.1 Edit Mode
- **Activation**:
  - Default on page load (if not previously disabled)
  - Toggle with Cmd/Ctrl+Shift+E
  - Click Edit/View toggle button
- **Enabled Features**:
  - Element selection (click, drag, hover)
  - Double-click text editing
  - Action menu (Edit, AI)
  - Element dragging and resizing
  - Reorder mode
  - Inline AI instructions
  - Change history tracking
  - Keyboard shortcuts active
- **Visual Indicator**: Blue pencil icon in control bar
- **Storage**: Persisted in localStorage as `vc-edit-mode`
- **Event Listeners**:
  - mousedown, mousemove, mouseup, mouseleave
  - dblclick, click
  - keydown (for shortcuts)

### 8.2 View Mode
- **Activation**:
  - Toggle from Edit Mode
  - Click Edit/View toggle button
- **Disabled Features**:
  - No element selection
  - No dragging/resizing
  - No text editing
  - No keyboard shortcuts (except mode toggle)
  - All UI elements hidden except control bar
- **Behavior**: Page behaves normally, like a regular website
- **Visual Indicator**: Eye icon in control bar
- **Event Listeners Removed**: All edit mode listeners removed for clean interaction
- **Cleanup**: Inline inputs, text editor, hover highlights removed

### 8.3 Reorder Mode
- **Entry**: Triggered when dragging in direction aligned with siblings
- **Exit**:
  - On mouseup (drop complete or invalid)
  - On Escape key (forced cleanup)
  - Automatic cleanup after operation
- **Active During**: Element moving between siblings
- **Visual State**:
  - Cursor shows directional indicator
  - Placeholder slot visible
  - Siblings animated with translation
  - "vc-reordering" class applied

### 8.4 Free-Drag Mode (Transform)
- **Entry**: When shift-held or non-reorderable element dragged
- **Override**: Shift+Drag overrides reorder mode
- **Visual State**: Crosshair cursor when applicable
- **Exit**: On mouseup or Escape

### 8.5 Design-to-Code Analysis Mode
- **Entry**: Click design upload button
- **States**:
  - Image upload/selection
  - Prompt input
  - Analysis in progress
  - Complete
- **Processing Steps**:
  1. Analyzing design (50% progress)
  2. Generating component (75% progress)
  3. Complete (100% progress)

## 9. DESIGN & CUSTOMIZATION FEATURES

### 9.1 Design Upload & Analysis
- **Supported Formats**: All image types (JPEG, PNG, WebP, etc.)
- **Upload Methods**:
  - Drag and drop into modal
  - File picker dialog ("Browse Files" button)
  - Paste from clipboard (Cmd/Ctrl+V)
- **Image Processing**:
  - FileReader converts to base64 data URL
  - Type stored for backend processing
  - Base64 extracted and sent to backend
- **Design Prompt**: Free-text description of what to create/modify
- **Example Prompts**:
  - "Create a new Card component based on this design"
  - "Update the existing Button component to match this style"
  - "Implement this navigation bar design"

### 9.2 AI Analysis Pipeline
- **Design Analysis**: Backend analyzes design image
- **Code Generation**: Creates/modifies HTML/CSS based on analysis
- **Progress Tracking**: Multi-step progress with spinner animations
- **Success Indicator**: Green checkmark when complete
- **Error Handling**: Shows error message if analysis fails
- **Auto-Complete**: Modal closes 1.5s after completion

### 9.3 Design Token Extraction
- **Automatic Detection**: Extracts design tokens from page
- **Tokens Analyzed**:
  - Colors (background, text, accent)
  - Spacing (margins, padding, gaps)
  - Typography (fonts, sizes, weights)
  - Border radius
  - Shadows
  - Z-index scales
- **Context Provided**: Tokens sent to AI for consistent styling

## 10. HISTORY & UNDO/REDO SYSTEM

### 10.1 Change Types
- **Text Edit**: Text content changes on elements
- **Transform**: Position or size changes via dragging/resizing
- **Reorder**: DOM element reordering within siblings
- **AI**: AI-generated changes from instructions

### 10.2 Change Tracking
- **Automatic**: Changes automatically added to history
- **Stored Data**:
  - Change ID (incrementing)
  - Type (text/transform/reorder/ai)
  - Element (DOM reference)
  - Selector (for serialization)
  - Timestamp (for age display)
  - Selected flag (for batch operations)
  - Data (change-specific data)
  - Preview (human-readable summary)
- **Immutable**: Each change is independent, no merging
- **Timestamp Format**:
  - "Just now" (< 60s ago)
  - "Xm ago" (< 60m ago)
  - "Xh ago" (< 24h ago)
  - Date string (1+ day ago)

### 10.3 Undo/Redo
- **Keyboard**:
  - Undo: Cmd/Ctrl+Z
  - Redo: Cmd/Ctrl+Shift+Z
- **Stacks**:
  - Undone changes moved to redo stack
  - New changes clear redo stack
  - Undo/redo sync with history panel
- **Visual Feedback**: History panel updates immediately
- **Revert Logic**:
  - Text: Restores old text content
  - Transform: Clears transform styles
  - Reorder: (Not yet implemented) Would re-insert at original position
  - AI: Reverts all DOM changes from instruction

### 10.4 History Panel UI
- **Visible**: Toggle with Cmd/Ctrl+Shift+H or button click
- **Operations**:
  - Select All: Check all changes
  - Deselect All: Uncheck all changes
  - Clear All: Delete entire history
  - Delete Individual: X button on each change
- **Commit Selected**: Send selected changes to backend
- **Commit All**: Send all changes to backend
- **Selection Persistence**: Checkboxes maintain state while panel open

### 10.5 Batch Commit & Token Estimation
- **Token Estimation**: Rough calculation (4 chars ≈ 1 token)
- **Smart Batching**: Splits large commit into multiple batches if > 6000 tokens
- **Batch Grouping**: Orders changes (text → AI → transform → reorder)
- **Sequential Processing**: Batches sent one at a time with 1s delay between
- **Monitoring**: Each batch gets unique message ID
- **Promise Resolution**: Backend response resolves batch promise
- **Timeout**: 120s timeout per batch with automatic reload on error

## 11. WEBSOCKET COMMUNICATION

### 11.1 Reload WebSocket
- **Purpose**: Receives reload signals from backend
- **Path**: `/.well-known/visual-claude/ws/reload`
- **Message Format**: `{ type: 'reload' }`
- **Handler**: Triggers window.location.reload()
- **Reconnection**: Auto-reconnects with 2s delay on close

### 11.2 Message WebSocket
- **Purpose**: Two-way communication for edits and AI analysis
- **Path**: `/.well-known/visual-claude/ws/message`
- **Statuses**: received, complete, error
- **Message Types**:
  - `apply-visual-edits`: Sends changes to backend
  - `analyze-design`: Sends design image for AI analysis
- **Batch Support**: Tracks batch operations with Promise resolvers
- **Timeout**: 120s per batch, auto-reload on timeout

### 11.3 WebSocket Error Handling
- **Connection Errors**: Logs to console, attempts reconnection
- **Message Errors**: Displays error message, triggers reload
- **Processing Errors**: Catches JSON parse errors, triggers reload if processing active
- **Recovery**: Auto-reload on critical errors (500ms-1s delay)

## 12. PERFORMANCE OPTIMIZATIONS

### 12.1 Throttling & Debouncing
- **Hover Check**: Throttled at 60ms (16fps) to prevent excessive DOM queries
- **Scroll/Resize Events**: Captured for drag handle and menu repositioning
- **Click Timeout**: 250ms delay to distinguish single vs. double-click
- **Selection Rectangle Updates**: Only updates when drag distance > 5px

### 12.2 DOM Queries
- **Caching**: Element references stored for reuse during operations
- **Lazy Evaluation**: Only queries DOM when necessary
- **Cleanup**: Removes event listeners when not in use

### 12.3 Memory Management
- **Listener Cleanup**: All event listeners removed in disableEditMode()
- **Timeout Cleanup**: Processing timeouts cleared on completion
- **Scope Limitation**: Bound handlers reused, not recreated per event

## 13. BROWSER COMPATIBILITY & FALLBACKS

### 13.1 CSS Features Used
- **CSS Grid & Flexbox**: For layout control
- **CSS Transform**: For drag/translate operations
- **CSS Transitions**: For smooth animations
- **Fixed Positioning**: For floating UI elements
- **z-index Layering**: For proper element stacking

### 13.2 Modern JavaScript Features
- **Arrow Functions**: Used throughout
- **Destructuring**: For parameter extraction
- **Template Literals**: For dynamic HTML/styling
- **Promise/Async**: For batch operations
- **WebSocket API**: For backend communication

### 13.3 Icon System
- **Phosphor Icons v2.1.1**: Modern icon library via CDN
- **Fallback**: Uses icon code if CSS not loaded

### 13.4 Typography
- **Inter Font**: Via Google Fonts, loaded via link tag
- **System Font Stack**: Fallback chain included

## 14. STATE MANAGEMENT

### 14.1 Alpine.js Component State
- **Reactive Properties**: All UI state tracked in component data
- **Computed Properties**:
  - `modeIcon`: Returns appropriate icon based on mode
  - `modeTitle`: Returns tooltip text
  - `modeClass`: Returns CSS class for styling
- **Watchers**: x-model bindings handle auto-update

### 14.2 LocalStorage
- **Edit Mode Persistence**: Saves mode preference across page reloads
- **Key**: `vc-edit-mode`
- **Values**: 'true' (edit) or 'false' (view)

### 14.3 WebSocket State
- **Message ID Tracking**: Current message awaiting response
- **Batch ID Mapping**: Maps message IDs to batch numbers
- **Pending Resolvers**: Maps batch numbers to Promise resolvers
- **Design Message ID**: Tracks current design analysis operation

## 15. VALIDATION & CONSTRAINTS

### 15.1 Element Validation
- **Drop Target**: Validates parent-child compatibility
- **Reasons for Rejection**:
  - Attempting to drop into self or children
  - Incompatible element types
  - Exceeds nesting limits
- **Fallback**: Traverses up to 10 levels to find valid parent

### 15.2 Sizing Constraints
- **Minimum Size**: Based on content (text width, inner HTML dimensions)
- **Maximum Size**: Based on parent boundaries
- **Aspect Ratio**: Always maintained for images, optional for other elements

### 15.3 Selection Constraints
- **Click Detection**: Requires < 5px movement and < 250ms duration
- **Drag Selection**: Requires > 5px distance to show rectangle
- **Area Size**: Requires > 25x25px for selection to register

## 16. CLEANUP & ERROR RECOVERY

### 16.1 Escape Key Comprehensive Cleanup
- **Closes All UIs**: Modals, panels, menus
- **Deselects Elements**: Removes highlight, selection, hover
- **Cancels Operations**: Stops drag, resize, reorder
- **Force Cleanup**: Removes any lingering position: fixed styles
- **Resets DOM**: Restores element to original position if stuck
- **Clears Cursors**: Removes override cursor classes
- **Defensive**: Works even if isActive flags out of sync

### 16.2 Error States
- **Processing Timeout**: 120s timeout with page reload
- **WebSocket Error**: Auto-reload on critical errors
- **Stale Messages**: Ignores messages for wrong message ID
- **JSON Parse Errors**: Caught and logged, triggers reload if processing

### 16.3 Invalid Operations
- **Invalid Drop**: Element snaps back to original position
- **Invalid Reorder**: Doesn't add to history
- **Invalid Selection**: Shows no feedback, prevents action

---

## IMPLEMENTATION NOTES

### Architecture
- **Alpine.js v3**: Reactive component system with directives
- **CSS Utility Classes**: Tailwind CSS for styling
- **Icons**: Phosphor Icons library for consistent iconography
- **WebSocket**: Real-time bidirectional communication with backend
- **LocalStorage**: Client-side persistence for preferences

### Key Design Patterns
1. **Progressive Enhancement**: Works with degraded features if JS unavailable
2. **Event Delegation**: Uses document-level listeners for efficiency
3. **State Machine**: Clear state transitions between modes
4. **Promise-based Async**: Batch operations use Promise/async patterns
5. **Defensive Programming**: Escape key has comprehensive cleanup logic

### Notable Limitations
- Reorder undo/redo not fully implemented
- Circular reference detection in token estimation
- No cross-frame element selection
- Single element clipboard (no copy/paste)
- No collaborative editing

### Performance Targets
- Hover detection: 60ms throttle (16fps)
- Drag updates: Continuous with transform optimization
- Modal appearance: Instant with CSS transition
- Page reload: 500ms-2s delay for user feedback
