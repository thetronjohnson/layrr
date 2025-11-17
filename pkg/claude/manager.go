package claude

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"sync"
)

// Manager manages Claude Code execution using --print mode
type Manager struct {
	claudePath string
	projectDir string
	mu         sync.Mutex
	verbose    bool
	currentCmd *exec.Cmd
	cmdMu      sync.Mutex
}

// NewManager creates a new manager for Claude Code
func NewManager(projectDir, claudePath string, verbose bool) (*Manager, error) {
	return &Manager{
		claudePath: claudePath,
		projectDir: projectDir,
		verbose:    verbose,
	}, nil
}

// SendMessage sends a message to Claude Code using --print mode with streaming JSON output
func (m *Manager) SendMessage(message string) error {
	fmt.Printf("\n[Claude Manager] 📍 SendMessage called, attempting to acquire lock...\n")
	m.mu.Lock()
	defer m.mu.Unlock()
	fmt.Printf("[Claude Manager] 📍 Lock acquired!\n")

	fmt.Printf("\n[Claude Manager] 🚀 === EXECUTING CLAUDE CODE ===\n")
	fmt.Printf("[Claude Manager] Working directory: %s\n", m.projectDir)
	fmt.Printf("[Claude Manager] Claude path: %s\n", m.claudePath)
	fmt.Printf("[Claude Manager] Message: %s\n", message)

	// Run Claude Code with streaming JSON output
	// --output-format stream-json: Outputs JSONL (one JSON object per line)
	// --verbose: Required when using stream-json with --print
	// --dangerously-skip-permissions: Skip permission prompts for automation
	cmd := exec.Command(m.claudePath,
		"--print", message,
		"--output-format", "stream-json",
		"--verbose",
		"--dangerously-skip-permissions")
	cmd.Dir = m.projectDir
	cmd.Env = os.Environ()

	fmt.Printf("[Claude Manager] Command: %s %v\n", m.claudePath, cmd.Args[1:])
	fmt.Printf("[Claude Manager] Working dir set to: %s\n", cmd.Dir)

	// Pipe stdout to read line-by-line JSONL output
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to create stdout pipe: %w", err)
	}

	// Discard stderr to keep terminal clean (only TUI output)
	cmd.Stderr = nil

	// Store reference to current command so it can be stopped
	m.cmdMu.Lock()
	m.currentCmd = cmd
	m.cmdMu.Unlock()

	// Start the command
	if err := cmd.Start(); err != nil {
		m.cmdMu.Lock()
		m.currentCmd = nil
		m.cmdMu.Unlock()
		return fmt.Errorf("failed to start Claude Code: %w", err)
	}

	// Read and parse JSONL output line by line
	scanner := bufio.NewScanner(stdout)
	lineCount := 0
	for scanner.Scan() {
		lineCount++
		line := scanner.Text()
		if m.verbose {
			fmt.Printf("[Claude Manager] Output line %d: %s\n", lineCount, line)
		}
		_ = m.handleStreamLine(line) // Silently skip unparseable lines
	}

	// Wait for command to complete
	waitErr := cmd.Wait()

	// Clear current command reference
	m.cmdMu.Lock()
	m.currentCmd = nil
	m.cmdMu.Unlock()

	if waitErr != nil {
		fmt.Printf("[Claude Manager] ❌ Command failed with error: %v\n", waitErr)
		return fmt.Errorf("Claude Code execution failed: %w", waitErr)
	}

	fmt.Printf("[Claude Manager] ✅ Command completed successfully\n")
	fmt.Printf("[Claude Manager] 📊 Processed %d output lines\n", lineCount)
	fmt.Printf("[Claude Manager] 🎉 === CLAUDE CODE EXECUTION COMPLETE ===\n\n")
	return nil
}

// Stop kills the currently running Claude Code process
func (m *Manager) Stop() error {
	m.cmdMu.Lock()
	defer m.cmdMu.Unlock()

	if m.currentCmd == nil || m.currentCmd.Process == nil {
		return fmt.Errorf("no Claude Code process is currently running")
	}

	fmt.Printf("[Claude Manager] 🛑 Stopping Claude Code process (PID: %d)...\n", m.currentCmd.Process.Pid)

	// Kill the process
	if err := m.currentCmd.Process.Kill(); err != nil {
		return fmt.Errorf("failed to kill process: %w", err)
	}

	fmt.Printf("[Claude Manager] ✅ Claude Code process stopped\n")
	m.currentCmd = nil
	return nil
}

// handleStreamLine parses a single line of JSONL output from Claude Code and logs it
func (m *Manager) handleStreamLine(line string) error {
	// Parse the JSON line
	var event map[string]interface{}
	if err := json.Unmarshal([]byte(line), &event); err != nil {
		return fmt.Errorf("failed to parse JSON: %w", err)
	}

	// Extract event type
	eventType, ok := event["type"].(string)
	if !ok {
		return fmt.Errorf("missing or invalid 'type' field")
	}

	// Log different event types
	switch eventType {
	case "content":
		if content, ok := event["content"].(string); ok {
			fmt.Printf("[Claude] 💭 %s\n", content)
		}
	case "tool_use":
		if toolName, ok := event["name"].(string); ok {
			fmt.Printf("[Claude] 🔧 Using tool: %s\n", toolName)
		}
	case "tool_result":
		if result, ok := event["content"].(string); ok {
			fmt.Printf("[Claude] ✅ Tool result: %s\n", result)
		}
	case "error":
		if errMsg, ok := event["error"].(string); ok {
			fmt.Printf("[Claude] ❌ Error: %s\n", errMsg)
		}
	default:
		if m.verbose {
			fmt.Printf("[Claude] 📋 Event type: %s\n", eventType)
		}
	}

	return nil
}
