package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"
)

// RecentProject represents a recently opened project
type RecentProject struct {
	Path       string    `json:"path"`
	Name       string    `json:"name"`
	LastOpened time.Time `json:"lastOpened"`
	TargetPort int       `json:"targetPort"`
}

// RecentProjectsData stores the list of recent projects
type RecentProjectsData struct {
	RecentProjects []RecentProject `json:"recentProjects"`
	MaxRecent      int             `json:"maxRecent"`
}

// GetRecentProjectsPath returns the path to the recent projects config file
func GetRecentProjectsPath() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}

	configDir := filepath.Join(homeDir, ".claude")
	// Ensure directory exists
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return "", err
	}

	return filepath.Join(configDir, "layrr-recent-projects.json"), nil
}

// GetRecentProjects reads the recent projects list from disk
func GetRecentProjects() ([]RecentProject, error) {
	configPath, err := GetRecentProjectsPath()
	if err != nil {
		return []RecentProject{}, err
	}

	// If file doesn't exist, return empty list
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return []RecentProject{}, nil
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		return []RecentProject{}, err
	}

	var projectsData RecentProjectsData
	if err := json.Unmarshal(data, &projectsData); err != nil {
		return []RecentProject{}, err
	}

	return projectsData.RecentProjects, nil
}

// AddRecentProject adds or updates a project in the recent projects list
func AddRecentProject(path, name string, targetPort int) error {
	projects, err := GetRecentProjects()
	if err != nil {
		// If we can't read, start fresh
		projects = []RecentProject{}
	}

	// Check if project already exists
	existingIndex := -1
	for i, p := range projects {
		if p.Path == path {
			existingIndex = i
			break
		}
	}

	newProject := RecentProject{
		Path:       path,
		Name:       name,
		LastOpened: time.Now(),
		TargetPort: targetPort,
	}

	// If exists, remove it from current position
	if existingIndex != -1 {
		projects = append(projects[:existingIndex], projects[existingIndex+1:]...)
	}

	// Add to front of list
	projects = append([]RecentProject{newProject}, projects...)

	// Limit to max 10 recent projects
	maxRecent := 10
	if len(projects) > maxRecent {
		projects = projects[:maxRecent]
	}

	// Save to disk
	projectsData := RecentProjectsData{
		RecentProjects: projects,
		MaxRecent:      maxRecent,
	}

	return saveRecentProjects(projectsData)
}

// RemoveRecentProject removes a project from the recent projects list
func RemoveRecentProject(path string) error {
	projects, err := GetRecentProjects()
	if err != nil {
		return err
	}

	// Find and remove the project
	filteredProjects := []RecentProject{}
	for _, p := range projects {
		if p.Path != path {
			filteredProjects = append(filteredProjects, p)
		}
	}

	projectsData := RecentProjectsData{
		RecentProjects: filteredProjects,
		MaxRecent:      10,
	}

	return saveRecentProjects(projectsData)
}

// saveRecentProjects writes the recent projects data to disk
func saveRecentProjects(data RecentProjectsData) error {
	configPath, err := GetRecentProjectsPath()
	if err != nil {
		return err
	}

	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(configPath, jsonData, 0644)
}
