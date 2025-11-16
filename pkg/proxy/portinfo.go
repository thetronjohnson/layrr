package proxy

import (
	"fmt"
	"net"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"
)

// PortInfo contains information about a port and its associated process
type PortInfo struct {
	Port        int    `json:"port"`
	ProcessName string `json:"processName"`
	WorkDir     string `json:"workDir"`
	PID         int    `json:"pid"`
}

// DetectPortsWithInfo detects all running dev servers and returns detailed info about each
func DetectPortsWithInfo() []PortInfo {
	commonPorts := []int{5173, 3000, 8080, 4200, 8000, 5000, 8888, 3001, 4000, 9000}
	portInfos := []PortInfo{}

	for _, port := range commonPorts {
		// First check if port is open
		addr := fmt.Sprintf("localhost:%d", port)
		conn, err := net.DialTimeout("tcp", addr, 500*time.Millisecond)
		if err != nil {
			continue // Port not open
		}
		conn.Close()

		// Port is open, try to get process info
		info := getProcessInfo(port)
		if info != nil {
			portInfos = append(portInfos, *info)
		} else {
			// Port is open but couldn't get process info
			portInfos = append(portInfos, PortInfo{
				Port:        port,
				ProcessName: "unknown",
				WorkDir:     "",
				PID:         0,
			})
		}
	}

	return portInfos
}

// getProcessInfo retrieves process information for a given port
func getProcessInfo(port int) *PortInfo {
	switch runtime.GOOS {
	case "darwin", "linux":
		return getProcessInfoUnix(port)
	case "windows":
		return getProcessInfoWindows(port)
	default:
		return nil
	}
}

// getProcessInfoUnix retrieves process info on macOS and Linux using lsof
func getProcessInfoUnix(port int) *PortInfo {
	// Use lsof to find the process listening on the port
	cmd := exec.Command("lsof", "-i", fmt.Sprintf(":%d", port), "-sTCP:LISTEN", "-n", "-P")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil
	}

	// Parse lsof output
	// Format: COMMAND  PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
	lines := strings.Split(string(output), "\n")
	if len(lines) < 2 {
		return nil
	}

	// Skip header line and get first data line
	for _, line := range lines[1:] {
		if line == "" {
			continue
		}

		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}

		processName := fields[0]
		pidStr := fields[1]
		pid, err := strconv.Atoi(pidStr)
		if err != nil {
			continue
		}

		// Get working directory for the process
		workDir := getWorkingDirectory(pid)

		// Clean up the working directory path
		if workDir != "" {
			workDir = cleanPath(workDir)
		}

		return &PortInfo{
			Port:        port,
			ProcessName: processName,
			WorkDir:     workDir,
			PID:         pid,
		}
	}

	return nil
}

// getProcessInfoWindows retrieves process info on Windows using netstat
func getProcessInfoWindows(port int) *PortInfo {
	// Use netstat to find the process
	cmd := exec.Command("netstat", "-ano")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil
	}

	// Parse netstat output to find PID
	lines := strings.Split(string(output), "\n")
	var pid int
	for _, line := range lines {
		if strings.Contains(line, fmt.Sprintf(":%d", port)) && strings.Contains(line, "LISTENING") {
			fields := strings.Fields(line)
			if len(fields) > 0 {
				pidStr := fields[len(fields)-1]
				pid, _ = strconv.Atoi(pidStr)
				break
			}
		}
	}

	if pid == 0 {
		return nil
	}

	// Use tasklist to get process name
	cmd = exec.Command("tasklist", "/FI", fmt.Sprintf("PID eq %d", pid), "/FO", "CSV", "/NH")
	output, err = cmd.CombinedOutput()
	if err != nil {
		return nil
	}

	// Parse tasklist output
	fields := strings.Split(string(output), ",")
	if len(fields) < 1 {
		return nil
	}

	processName := strings.Trim(fields[0], "\"")
	workDir := getWorkingDirectory(pid)

	return &PortInfo{
		Port:        port,
		ProcessName: processName,
		WorkDir:     cleanPath(workDir),
		PID:         pid,
	}
}

// getWorkingDirectory gets the working directory for a process by PID
func getWorkingDirectory(pid int) string {
	switch runtime.GOOS {
	case "darwin":
		// On macOS, use lsof to get the current working directory
		cmd := exec.Command("lsof", "-a", "-p", strconv.Itoa(pid), "-d", "cwd", "-Fn")
		output, err := cmd.CombinedOutput()
		if err != nil {
			return ""
		}

		// Parse lsof output (format: n<path>)
		lines := strings.Split(string(output), "\n")
		for _, line := range lines {
			if strings.HasPrefix(line, "n") {
				return strings.TrimPrefix(line, "n")
			}
		}
		return ""

	case "linux":
		// On Linux, read /proc/<pid>/cwd symlink
		cwdPath := fmt.Sprintf("/proc/%d/cwd", pid)
		cmd := exec.Command("readlink", cwdPath)
		output, err := cmd.CombinedOutput()
		if err != nil {
			return ""
		}
		return strings.TrimSpace(string(output))

	case "windows":
		// On Windows, use wmic to get working directory
		cmd := exec.Command("wmic", "process", "where", fmt.Sprintf("ProcessId=%d", pid), "get", "ExecutablePath", "/format:list")
		output, err := cmd.CombinedOutput()
		if err != nil {
			return ""
		}

		// Parse wmic output
		lines := strings.Split(string(output), "\n")
		for _, line := range lines {
			if strings.HasPrefix(line, "ExecutablePath=") {
				exePath := strings.TrimPrefix(line, "ExecutablePath=")
				exePath = strings.TrimSpace(exePath)
				return filepath.Dir(exePath)
			}
		}
		return ""

	default:
		return ""
	}
}

// cleanPath cleans the path (returns full path, not shortened)
func cleanPath(path string) string {
	if path == "" {
		return ""
	}

	// Clean the path and return full path (don't shorten with ~)
	return filepath.Clean(path)
}

// getEnvVar is a helper to get environment variables (for testing)
func getEnvVar(key string) string {
	cmd := exec.Command("sh", "-c", fmt.Sprintf("echo $%s", key))
	if runtime.GOOS == "windows" {
		cmd = exec.Command("cmd", "/c", fmt.Sprintf("echo %%%s%%", key))
	}
	output, err := cmd.CombinedOutput()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(output))
}
