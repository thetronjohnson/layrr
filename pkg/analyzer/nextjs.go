package analyzer

import (
	"path/filepath"
)

// NextJSFileLocator helps locate Next.js-specific files based on router type
type NextJSFileLocator struct {
	ProjectDir string
	RouterType string
	TypeScript bool
}

// NewNextJSFileLocator creates a new Next.JS file locator
func NewNextJSFileLocator(projectDir string, routerType string, typescript bool) *NextJSFileLocator {
	return &NextJSFileLocator{
		ProjectDir: projectDir,
		RouterType: routerType,
		TypeScript: typescript,
	}
}

// FindPageFile finds the page file for a given route
// Examples:
//   - "/" returns "app/page.tsx" or "pages/index.tsx"
//   - "/about" returns "app/about/page.tsx" or "pages/about.tsx"
func (n *NextJSFileLocator) FindPageFile(route string) string {
	ext := ".js"
	if n.TypeScript {
		ext = ".tsx"
	}

	if n.RouterType == "app" {
		// App Router: routes are directories with page files
		// Check both root app/ and src/app/
		if route == "/" || route == "" {
			// Check src/app/page.tsx first, then app/page.tsx
			srcPath := filepath.Join(n.ProjectDir, "src", "app", "page"+ext)
			if fileExists(srcPath) {
				return srcPath
			}
			return filepath.Join(n.ProjectDir, "app", "page"+ext)
		}

		// Remove leading slash
		route = filepath.Clean(route)

		// Check src/app/route/page.tsx first
		srcPath := filepath.Join(n.ProjectDir, "src", "app", route, "page"+ext)
		if fileExists(srcPath) {
			return srcPath
		}

		// Then app/route/page.tsx
		return filepath.Join(n.ProjectDir, "app", route, "page"+ext)
	}

	// Pages Router: routes are files
	if route == "/" || route == "" {
		// Check src/pages/index.tsx first
		srcPath := filepath.Join(n.ProjectDir, "src", "pages", "index"+ext)
		if fileExists(srcPath) {
			return srcPath
		}
		return filepath.Join(n.ProjectDir, "pages", "index"+ext)
	}

	// Remove leading slash for file name
	route = filepath.Clean(route)

	// Check src/pages first
	srcPath := filepath.Join(n.ProjectDir, "src", "pages", route+ext)
	if fileExists(srcPath) {
		return srcPath
	}

	return filepath.Join(n.ProjectDir, "pages", route+ext)
}

// FindLayoutFile finds the layout file for a given route
// App Router: Walks up from route to find nearest layout.tsx
// Pages Router: Returns _app.tsx
func (n *NextJSFileLocator) FindLayoutFile(route string) string {
	ext := ".js"
	if n.TypeScript {
		ext = ".tsx"
	}

	if n.RouterType == "app" {
		// For App Router, find the nearest layout.tsx
		// Start from the route and walk up
		if route == "/" || route == "" {
			// Root layout
			srcPath := filepath.Join(n.ProjectDir, "src", "app", "layout"+ext)
			if fileExists(srcPath) {
				return srcPath
			}
			return filepath.Join(n.ProjectDir, "app", "layout"+ext)
		}

		// Walk up the route path to find layout
		route = filepath.Clean(route)
		parts := filepath.SplitList(route)

		// Try each level from deepest to root
		for i := len(parts); i >= 0; i-- {
			var layoutPath string
			if i == 0 {
				// Root level
				layoutPath = filepath.Join(n.ProjectDir, "src", "app", "layout"+ext)
				if fileExists(layoutPath) {
					return layoutPath
				}
				layoutPath = filepath.Join(n.ProjectDir, "app", "layout"+ext)
			} else {
				// Intermediate level
				subPath := filepath.Join(parts[:i]...)
				layoutPath = filepath.Join(n.ProjectDir, "src", "app", subPath, "layout"+ext)
				if fileExists(layoutPath) {
					return layoutPath
				}
				layoutPath = filepath.Join(n.ProjectDir, "app", subPath, "layout"+ext)
			}

			if fileExists(layoutPath) {
				return layoutPath
			}
		}

		// Default to root layout
		return filepath.Join(n.ProjectDir, "app", "layout"+ext)
	}

	// Pages Router: Use _app.tsx
	srcPath := filepath.Join(n.ProjectDir, "src", "pages", "_app"+ext)
	if fileExists(srcPath) {
		return srcPath
	}
	return filepath.Join(n.ProjectDir, "pages", "_app"+ext)
}

// GetRootLayoutFile returns the root layout file path
func (n *NextJSFileLocator) GetRootLayoutFile() string {
	return n.FindLayoutFile("/")
}

// GetHomePageFile returns the homepage file path
func (n *NextJSFileLocator) GetHomePageFile() string {
	return n.FindPageFile("/")
}

// fileExists checks if a file exists
func fileExists(path string) bool {
	return hasFile(filepath.Dir(path), filepath.Base(path))
}
