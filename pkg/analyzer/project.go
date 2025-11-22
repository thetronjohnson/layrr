package analyzer

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// ProjectContext contains information about the project's framework and styling approach
type ProjectContext struct {
	Framework    string // "react", "vue", "svelte", "html", "nextjs"
	Styling      string // "tailwind", "css-modules", "styled-components", "emotion", "css"
	TypeScript   bool
	NextJSRouter string // "app", "pages", "none" - only set if Framework is "nextjs"
}

// AnalyzeProject detects the project's framework and styling approach
func AnalyzeProject(projectDir string) (*ProjectContext, error) {
	ctx := &ProjectContext{
		Framework:  "html",
		Styling:    "css",
		TypeScript: false,
	}

	// Read package.json
	pkgPath := filepath.Join(projectDir, "package.json")
	data, err := os.ReadFile(pkgPath)
	if err != nil {
		// No package.json = plain HTML project
		return ctx, nil
	}

	var pkg struct {
		Dependencies    map[string]string `json:"dependencies"`
		DevDependencies map[string]string `json:"devDependencies"`
	}

	if err := json.Unmarshal(data, &pkg); err != nil {
		// Invalid package.json, return defaults
		return ctx, nil
	}

	// Combine all dependencies
	allDeps := make(map[string]bool)
	for k := range pkg.Dependencies {
		allDeps[k] = true
	}
	for k := range pkg.DevDependencies {
		allDeps[k] = true
	}

	// Detect framework (check Next.js first since it includes React)
	if allDeps["next"] {
		ctx.Framework = "nextjs"
		ctx.NextJSRouter = detectNextJSRouter(projectDir)
	} else if allDeps["react"] || allDeps["react-dom"] {
		ctx.Framework = "react"
	} else if allDeps["vue"] {
		ctx.Framework = "vue"
	} else if allDeps["svelte"] {
		ctx.Framework = "svelte"
	} else if allDeps["@angular/core"] {
		ctx.Framework = "angular"
	}

	// Detect styling approach
	if allDeps["tailwindcss"] {
		ctx.Styling = "tailwind"
	} else if allDeps["styled-components"] {
		ctx.Styling = "styled-components"
	} else if allDeps["@emotion/react"] || allDeps["@emotion/styled"] {
		ctx.Styling = "emotion"
	} else if hasFileWithSuffix(projectDir, ".module.css") || hasFileWithSuffix(projectDir, ".module.scss") {
		ctx.Styling = "css-modules"
	}

	// Detect TypeScript
	ctx.TypeScript = allDeps["typescript"] ||
		hasFileWithSuffix(projectDir, ".tsx") ||
		hasFileWithSuffix(projectDir, ".ts")

	return ctx, nil
}

// detectNextJSRouter detects whether Next.js project uses App Router or Pages Router
func detectNextJSRouter(projectDir string) string {
	// Check for App Router (Next.js 13+)
	appDir := filepath.Join(projectDir, "app")
	if stat, err := os.Stat(appDir); err == nil && stat.IsDir() {
		// Look for page.tsx or page.jsx in app directory
		if hasFile(appDir, "page.tsx") || hasFile(appDir, "page.jsx") ||
			hasFile(appDir, "page.ts") || hasFile(appDir, "page.js") {
			return "app"
		}
	}

	// Check for Pages Router (traditional)
	pagesDir := filepath.Join(projectDir, "pages")
	if stat, err := os.Stat(pagesDir); err == nil && stat.IsDir() {
		return "pages"
	}

	// Check for src/app or src/pages
	srcAppDir := filepath.Join(projectDir, "src", "app")
	if stat, err := os.Stat(srcAppDir); err == nil && stat.IsDir() {
		if hasFile(srcAppDir, "page.tsx") || hasFile(srcAppDir, "page.jsx") {
			return "app"
		}
	}

	srcPagesDir := filepath.Join(projectDir, "src", "pages")
	if stat, err := os.Stat(srcPagesDir); err == nil && stat.IsDir() {
		return "pages"
	}

	return "none"
}

// hasFile checks if a specific file exists in a directory
func hasFile(dir, filename string) bool {
	path := filepath.Join(dir, filename)
	if _, err := os.Stat(path); err == nil {
		return true
	}
	return false
}

// hasFileWithSuffix checks if the project has any file with the given suffix
func hasFileWithSuffix(projectDir, suffix string) bool {
	found := false

	// Walk the project directory (limit depth to avoid node_modules)
	filepath.Walk(projectDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}

		// Skip common directories
		if info.IsDir() {
			name := info.Name()
			if name == "node_modules" || name == ".git" || name == "dist" ||
				name == "build" || name == ".next" || name == "coverage" {
				return filepath.SkipDir
			}
		}

		// Check if file has the suffix
		if !info.IsDir() && strings.HasSuffix(info.Name(), suffix) {
			found = true
			return filepath.SkipDir // Stop walking once found
		}

		return nil
	})

	return found
}

// GetFileExtension returns the appropriate file extension for the project
func (ctx *ProjectContext) GetFileExtension() string {
	switch ctx.Framework {
	case "nextjs", "react":
		if ctx.TypeScript {
			return ".tsx"
		}
		return ".jsx"
	case "vue":
		return ".vue"
	case "svelte":
		return ".svelte"
	case "angular":
		return ".component.ts"
	default:
		if ctx.TypeScript {
			return ".ts"
		}
		return ".js"
	}
}

// String returns a human-readable description of the project context
func (ctx *ProjectContext) String() string {
	lang := "JavaScript"
	if ctx.TypeScript {
		lang = "TypeScript"
	}

	framework := ctx.Framework
	if ctx.Framework == "nextjs" && ctx.NextJSRouter != "none" {
		framework = fmt.Sprintf("Next.js (%s router)", ctx.NextJSRouter)
	}

	return fmt.Sprintf("%s + %s (%s)", framework, ctx.Styling, lang)
}
