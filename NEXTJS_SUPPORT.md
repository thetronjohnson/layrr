# Next.js Support Documentation

## Overview

Layrr now has first-class support for Next.js projects, including both **App Router** (Next.js 13+) and **Pages Router** (traditional). This optimization ensures that Claude generates Next.js-specific code with proper conventions, server/client component awareness, and framework-specific components.

## What's New

### 1. Automatic Next.js Detection

Layrr automatically detects Next.js projects by checking for the `next` dependency in `package.json`. When detected, it will:

- Set framework to `"nextjs"` instead of generic `"react"`
- Detect which router type is being used (App Router vs Pages Router)
- Apply Next.js-specific code generation rules

### 2. Router Type Detection

**App Router Detection:**
- Checks for `app/` or `src/app/` directory
- Looks for `page.tsx`, `page.jsx`, `page.ts`, or `page.js` files
- Sets `NextJSRouter` to `"app"`

**Pages Router Detection:**
- Checks for `pages/` or `src/pages/` directory
- Sets `NextJSRouter` to `"pages"`

**Example project structures:**

```
Next.js App Router:
my-app/
├── app/
│   ├── page.tsx          ← Homepage
│   ├── layout.tsx        ← Root layout
│   ├── about/
│   │   └── page.tsx      ← /about route
│   └── blog/
│       └── [slug]/
│           └── page.tsx  ← /blog/:slug route

Next.js Pages Router:
my-app/
├── pages/
│   ├── index.tsx         ← Homepage
│   ├── about.tsx         ← /about route
│   ├── _app.tsx          ← Global layout
│   └── blog/
│       └── [slug].tsx    ← /blog/:slug route
```

### 3. Next.js File Locator

New helper class `NextJSFileLocator` helps locate the correct files to edit:

```go
locator := analyzer.NewNextJSFileLocator(projectDir, "app", true)

// Find homepage file
homePage := locator.GetHomePageFile()
// Returns: "app/page.tsx" or "src/app/page.tsx"

// Find route-specific page
aboutPage := locator.FindPageFile("/about")
// Returns: "app/about/page.tsx" or "pages/about.tsx"

// Find layout file
layout := locator.GetRootLayoutFile()
// Returns: "app/layout.tsx" or "pages/_app.tsx"
```

### 4. Enhanced Claude Prompts

Claude now receives Next.js-specific instructions based on the router type:

#### App Router Instructions:
- **Server Components by default** - Only add `'use client'` when needed
- **When to add 'use client'**:
  - Component uses React hooks (useState, useEffect, etc.)
  - Component uses browser APIs (window, document, localStorage)
  - Component has event handlers (onClick, onChange, onSubmit)
  - Component uses third-party libraries that depend on browser/hooks

- **Next.js Components**:
  - Use `Image` from 'next/image' instead of `<img>`
  - Use `Link` from 'next/link' instead of `<a>` for internal navigation
  - Use Next.js font optimization from 'next/font/google'

- **File Structure Rules**:
  - Page files must be named `page.tsx`
  - Export `const metadata = {...}` for page titles/descriptions
  - Can use async Server Components for data fetching

#### Pages Router Instructions:
- **Next.js Components**:
  - Use `Image` from 'next/image' with width/height props
  - Use `Link` from 'next/link' for navigation
  - Use `Head` from 'next/head' for metadata

- **File Structure Rules**:
  - Homepage is `index.tsx` in pages/
  - Global layout in `_app.tsx`
  - HTML structure in `_document.tsx`

- **Data Fetching**:
  - Use `getServerSideProps` for SSR
  - Use `getStaticProps` for SSG

## How It Works

### Project Analysis Flow

```
1. Read package.json
   ↓
2. Detect "next" in dependencies?
   ├─ Yes → Framework = "nextjs"
   │        ↓
   │        Check for app/ or pages/ directory
   │        ↓
   │        Set NextJSRouter = "app" or "pages"
   │
   └─ No → Check for react/vue/svelte
```

### Code Generation Flow

```
1. User selects element and provides instruction
   ↓
2. Analyzer detects project type:
   - Framework: nextjs
   - Router: app
   - Styling: tailwind
   - TypeScript: true
   ↓
3. Generator builds prompt with Next.js instructions:
   - Server component by default
   - Use Next.js Image/Link components
   - Add 'use client' only if interactive
   ↓
4. Claude generates Next.js-specific code
   ↓
5. Code saved to correct file (app/page.tsx)
   ↓
6. File watcher triggers browser reload
```

## Benefits for Non-Developers

### Automatic Intelligence

Non-developers don't need to understand Next.js concepts. Layrr handles everything:

| What User Sees | What Layrr Does Behind the Scenes |
|----------------|-----------------------------------|
| "Make this button blue" | Detects if component is server/client, adds 'use client' if needed, updates styling |
| "Add a photo here" | Uses Next.js Image component with proper props |
| "Link to about page" | Uses Next.js Link component for fast navigation |
| "Change page title" | Updates metadata export (App Router) or Head component (Pages Router) |

### Error Prevention

Layrr prevents common Next.js mistakes:

❌ **Without Next.js Support:**
- Claude might forget `'use client'` directive
- Uses `<img>` instead of optimized `<Image>`
- Uses `<a>` instead of `<Link>` (slower navigation)
- Wrong file structure (index.tsx in App Router)

✅ **With Next.js Support:**
- Automatic `'use client'` when needed
- Always uses Next.js `<Image>` for optimization
- Always uses `<Link>` for internal navigation
- Correct file structure for router type

## Technical Details

### Files Modified

1. **pkg/analyzer/project.go**
   - Added `NextJSRouter` field to `ProjectContext`
   - Added `detectNextJSRouter()` function
   - Added `hasFile()` helper function
   - Updated framework detection to check for Next.js first
   - Updated `String()` method to display router type

2. **pkg/analyzer/nextjs.go** (NEW)
   - Created `NextJSFileLocator` struct
   - `FindPageFile()` - Locates page files for routes
   - `FindLayoutFile()` - Locates layout files
   - `GetRootLayoutFile()` - Gets root layout
   - `GetHomePageFile()` - Gets homepage file
   - Handles both `app/` and `src/app/` structures

3. **pkg/generator/prompts.go**
   - Updated `getFrameworkInstructions()` to accept full `ProjectContext`
   - Added comprehensive Next.js App Router instructions
   - Added comprehensive Next.js Pages Router instructions
   - Includes server/client component guidance
   - Includes Next.js component usage instructions

### API Changes

#### ProjectContext Structure

```go
type ProjectContext struct {
    Framework    string // "react", "vue", "svelte", "html", "nextjs"
    Styling      string // "tailwind", "css-modules", etc.
    TypeScript   bool
    NextJSRouter string // "app", "pages", "none"
}
```

#### New Helper Methods

```go
// Create locator for finding Next.js files
locator := analyzer.NewNextJSFileLocator(projectDir, routerType, typescript)

// Find files
homePage := locator.GetHomePageFile()
aboutPage := locator.FindPageFile("/about")
layout := locator.GetRootLayoutFile()
```

## Testing

### Manual Testing Checklist

To test Next.js support:

1. **Create or open a Next.js project**:
   ```bash
   npx create-next-app@latest my-test-app
   cd my-test-app
   npm run dev
   ```

2. **Start Layrr**:
   - Open Layrr desktop app
   - Select the Next.js project directory
   - Detect dev server on port 3000
   - Start proxy

3. **Test Detection**:
   - Check logs for: "Next.js (app router)" or "Next.js (pages router)"
   - Verify correct router type is detected

4. **Test Visual Editing**:
   - Select an element on the page
   - Give instruction: "Make this button larger and blue"
   - Verify Claude generates Next.js-appropriate code
   - Check if `'use client'` is added when needed

5. **Test Image Handling**:
   - Select an image
   - Give instruction: "Replace with a placeholder image"
   - Verify Claude uses `<Image from='next/image'>` component

6. **Test Navigation**:
   - Select a link
   - Give instruction: "Link to /about page"
   - Verify Claude uses `<Link from='next/link'>` component

### Expected Outputs

**App Router Project (with interactive element):**
```tsx
'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

export default function Page() {
  const [count, setCount] = useState(0)

  return (
    <div className="p-4">
      <Image
        src="/hero.jpg"
        width={800}
        height={600}
        alt="Hero image"
      />
      <button
        onClick={() => setCount(count + 1)}
        className="bg-blue-500 text-white px-6 py-3 rounded-lg"
      >
        Count: {count}
      </button>
      <Link href="/about">About Us</Link>
    </div>
  )
}
```

**App Router Project (static content - server component):**
```tsx
import Image from 'next/image'
import Link from 'next/link'

export const metadata = {
  title: 'Homepage',
  description: 'Welcome to our site'
}

export default function Page() {
  return (
    <div className="p-4">
      <h1 className="text-4xl font-bold">Welcome</h1>
      <Image
        src="/hero.jpg"
        width={800}
        height={600}
        alt="Hero image"
      />
      <Link href="/about">Learn More</Link>
    </div>
  )
}
```

## Future Enhancements (Phase 2 & 3)

### Phase 2: Advanced Next.js Features
- [ ] Auto-detect existing `'use client'` directive
- [ ] Warn when adding interactivity to server components
- [ ] Handle metadata API more intelligently
- [ ] Support loading.tsx, error.tsx, not-found.tsx
- [ ] Handle route groups and parallel routes

### Phase 3: Non-Developer UX Polish
- [ ] Display "Homepage" instead of "app/page.tsx" in UI
- [ ] Show "Server Component" vs "Client Component" badges
- [ ] Smart suggestions: "Converting to client component for interactivity"
- [ ] Better error messages: Avoid technical jargon
- [ ] Component type hints in element inspector

## Troubleshooting

### Issue: Next.js not detected

**Symptom**: Layrr shows "React" instead of "Next.js"

**Solution**:
- Check that `next` is in package.json dependencies
- Verify project has either `app/` or `pages/` directory
- Try restarting Layrr

### Issue: Wrong router type detected

**Symptom**: Shows "app router" but project uses pages/

**Solution**:
- Check directory structure
- App Router requires `app/page.tsx` to be detected
- If ambiguous, Pages Router is preferred

### Issue: Claude doesn't add 'use client'

**Symptom**: Code has hooks but no 'use client' directive

**Solution**:
- Claude should add it automatically based on prompt instructions
- Manually add `'use client'` at the top of the file
- Report issue with example for prompt improvement

## Summary

Layrr now intelligently handles Next.js projects with:

✅ Automatic Next.js and router type detection
✅ Correct file location for pages and layouts
✅ Server vs client component awareness
✅ Next.js-specific component usage (Image, Link)
✅ Router-specific best practices
✅ Non-developer friendly (complexity hidden)

This Phase 1 implementation provides 80% of the value with minimal disruption to existing functionality. Future phases will add more advanced features and UX polish.
