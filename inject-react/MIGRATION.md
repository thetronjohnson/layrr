# Layrr React Migration Progress

## Overview
Migrating the Alpine.js visual editor (3,231 lines) to React with TypeScript for better maintainability and future feature additions.

## Completed ✅

### 1. Project Setup
- ✅ React 18 + TypeScript project structure
- ✅ Vite build configuration
- ✅ Tailwind CSS v3 setup with `vc-` prefix
- ✅ pnpm package manager
- ✅ Build outputs to `../pkg/proxy/inject-react-dist/`

### 2. Type System
- ✅ Complete TypeScript types (60+ interfaces)
- ✅ ElementInfo, AreaInfo, Message types
- ✅ DragHandleState, ReorderModeState types
- ✅ ChangeHistoryItem, DesignUploadState types
- ✅ WebSocket message types

### 3. Utilities
- ✅ Constants extracted from inject-utils.js
- ✅ 20+ DOM utility functions migrated to TypeScript
- ✅ Comprehensive JSDoc comments
- ✅ Layout detection algorithms
- ✅ Reorder logic utilities

## In Progress 🚧

### 4. State Management (Current)
- 🚧 Zustand store setup
- ⏳ Selection slice
- ⏳ Drag & drop slice
- ⏳ History slice
- ⏳ Design slice

## Pending ⏳

### 5. Shadow DOM System
- ⏳ Shadow DOM container setup
- ⏳ Style isolation
- ⏳ Event delegation across shadow boundary

### 6. Core Components

#### Overlay Components
- ⏳ SelectionRect - Visual selection rectangle
- ⏳ SelectionInfo - Element tooltip
- ⏳ HoverHandle - Drag initiation handle
- ⏳ ResizeHandles - 8-direction resize

#### Editor Components
- ⏳ InlineInput - Quick text editing
- ⏳ TextEditor - Full text editor modal
- ⏳ ActionMenu - Context menu

#### History Components
- ⏳ HistoryPanel - Sidebar with change history
- ⏳ HistoryItem - Individual change entry
- ⏳ Undo/Redo keyboard shortcuts

#### Design Components
- ⏳ DesignModal - Image upload interface
- ⏳ ImageUploader - File picker component
- ⏳ DesignAnalyzer - AI analysis UI

#### Toolbar Components
- ⏳ ModeToggle - Edit/Browse mode switcher
- ⏳ StatusIndicator - Processing feedback

#### Drag & Drop Components
- ⏳ ReorderPlaceholder - Visual drop target
- ⏳ DropWarning - Validation messages

### 7. Hooks
- ⏳ useWebSocket - WebSocket management
- ⏳ useKeyboardShortcuts - Global shortcuts
- ⏳ useElementSelection - Selection logic
- ⏳ useDragAndDrop - Drag & drop behavior

### 8. Main App
- ⏳ App.tsx - Root component
- ⏳ index.tsx - Entry point with Shadow DOM

### 9. Integration
- ⏳ Update inject.go to serve React bundle
- ⏳ Remove Alpine.js references
- ⏳ Update inject.css if needed

### 10. Testing
- ⏳ Test all visual selection features
- ⏳ Test drag & drop functionality
- ⏳ Test undo/redo system
- ⏳ Test design upload
- ⏳ Test WebSocket communication
- ⏳ Test across different host apps

## Architecture Decisions

### Why Zustand over Redux?
- Lighter bundle size (~1KB vs 3KB)
- Simpler API, less boilerplate
- Better TypeScript support out of the box
- Easier to split into slices

### Why Shadow DOM?
- Complete style isolation from host app
- Prevents CSS conflicts
- Host app can't accidentally break our UI
- We can't accidentally break host app styles

### Why Tailwind with `vc-` Prefix?
- Consistent with existing Wails frontend
- Prefix prevents class name conflicts
- JIT mode keeps bundle small
- Utility-first matches rapid development needs

### Why Vite?
- Extremely fast build times
- Built-in TypeScript support
- Tree-shaking for smaller bundles
- Hot module replacement during dev

## Bundle Size Goals

### Target Sizes (gzipped)
- React + ReactDOM: ~40KB
- Zustand: ~1KB
- Our code: ~30-50KB
- Tailwind (purged): ~10KB
- **Total target: ~80-100KB** (vs Alpine ~500KB current)

### Comparison
- Current Alpine.js setup: ~500KB total
  - inject.js: 3,231 lines
  - inject-utils.js: 791 lines
  - alpine.min.js: ~15KB
  - tailwind.min.js: ~300KB (CDN)

- React migration: ~100KB total
  - Better DX with TypeScript
  - More maintainable architecture
  - Easier to add complex features

## Future Features Enabled by React

These were difficult/impossible with Alpine.js:

1. **Component Library Browser** - Browse and insert UI components
2. **Style Inspector** - Chrome DevTools-like style editor
3. **Real-time Collaboration** - Multi-user editing
4. **Plugin System** - Third-party extensions
5. **AI Chat Interface** - Conversational design mode
6. **Design System Manager** - Visual theme editor
7. **Version Control Integration** - Visual git diff
8. **Component Tree View** - Navigate component hierarchy

## Next Steps

1. **Complete Zustand store** (1-2 hours)
2. **Build Shadow DOM system** (2-3 hours)
3. **Migrate overlay components** (4-6 hours)
4. **Migrate editor components** (3-4 hours)
5. **Migrate drag & drop** (4-6 hours)
6. **Migrate history panel** (2-3 hours)
7. **Migrate design upload** (2-3 hours)
8. **Integration & testing** (3-4 hours)

**Total estimated time: 21-32 hours** (~3-4 days of full-time work)

## Running the Migration

```bash
# Development
cd inject-react
pnpm dev

# Build for production
pnpm build

# Output location
../pkg/proxy/inject-react-dist/inject-react.js
```

## Testing Plan

1. **Unit Tests** - Test utility functions
2. **Component Tests** - Test each React component
3. **Integration Tests** - Test in actual Layrr app
4. **Host App Compatibility** - Test with React, Vue, Svelte apps
5. **Performance Tests** - Measure bundle size, load time, runtime

## Rollback Plan

If React migration has critical issues:
1. Keep Alpine.js files in pkg/proxy/ as backup
2. inject.go can serve either version via flag
3. Gradual rollout: Test internally before release

---

**Status**: Build pipeline complete, starting state management
**Last Updated**: 2025-11-14
