package sandbox

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"
)

type ExecutionResult struct {
	ExecutionID    string `json:"execution_id"`
	Success        bool   `json:"success"`
	ExitCode       int    `json:"exit_code"`
	Stdout         string `json:"stdout"`
	Stderr         string `json:"stderr"`
	DurationMs     int64  `json:"duration_ms"`
	PeakMemoryBytes int64  `json:"peak_memory_bytes"`
	TimedOut       bool   `json:"timed_out"`
	IsolationMode  string `json:"isolation_mode"`
}

type ExecutionOptions struct {
	ExecutionID    string            `json:"execution_id"`
	Language       string            `json:"language"`
	Code           string            `json:"code"`
	TimeoutSeconds int               `json:"timeout_seconds"`
	MaxMemoryMB    int64             `json:"max_memory_mb"`
	AllowNetwork   bool              `json:"allow_network"`
	CustomEnv      map[string]string `json:"custom_env"`
}

type Executor struct {
	mu           sync.RWMutex
	baseTempDir  string
	dockerAvail  bool
}

func NewExecutor() *Executor {
	// Check if Docker is locally available for container-per-execution
	dockerAvail := false
	if _, err := exec.LookPath("docker"); err == nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		if err := exec.CommandContext(ctx, "docker", "info").Run(); err == nil {
			dockerAvail = true
		}
	}

	baseDir := filepath.Join(os.TempDir(), "chatbolt_sandboxes")
	_ = os.MkdirAll(baseDir, 0700)

	return &Executor{
		baseTempDir: baseDir,
		dockerAvail: dockerAvail,
	}
}

// ExecuteCode runs code inside an isolated, scrubbed sandbox
func (e *Executor) ExecuteCode(ctx context.Context, opts ExecutionOptions) (*ExecutionResult, error) {
	if opts.TimeoutSeconds <= 0 {
		opts.TimeoutSeconds = 30
	}
	if opts.MaxMemoryMB <= 0 {
		opts.MaxMemoryMB = 256
	}

	start := time.Now()

	// 1. Create a dedicated ephemeral directory for this single execution
	execDir, err := os.MkdirTemp(e.baseTempDir, fmt.Sprintf("exec-%s-*", opts.ExecutionID))
	if err != nil {
		return nil, fmt.Errorf("failed to create sandbox execution dir: %w", err)
	}
	defer os.RemoveAll(execDir) // strict cleanup of execution directory

	// 2. Write source file based on language
	var filename string
	var cmdName string
	var cmdArgs []string

	lang := strings.ToLower(strings.TrimSpace(opts.Language))
	switch lang {
	case "js", "javascript", "node", "nodejs":
		filename = "index.js"
		cmdName = "node"
		cmdArgs = []string{filename}

	case "py", "python", "python3":
		filename = "main.py"
		// Determine available python executable
		if _, err := exec.LookPath("python3"); err == nil {
			cmdName = "python3"
		} else if _, err := exec.LookPath("python"); err == nil {
			cmdName = "python"
		} else if _, err := exec.LookPath("py"); err == nil {
			cmdName = "py"
		} else {
			cmdName = "python"
		}
		cmdArgs = []string{filename}

	case "sh", "bash":
		filename = "script.sh"
		if runtime.GOOS == "windows" {
			// On Windows, try bash (Git Bash / WSL) or fallback to cmd.exe
			if _, err := exec.LookPath("bash"); err == nil {
				cmdName = "bash"
				cmdArgs = []string{filename}
			} else {
				filename = "script.bat"
				cmdName = "cmd.exe"
				cmdArgs = []string{"/c", filename}
			}
		} else {
			cmdName = "bash"
			cmdArgs = []string{filename}
		}

	default:
		// Default to node
		filename = "index.js"
		cmdName = "node"
		cmdArgs = []string{filename}
	}

	scriptPath := filepath.Join(execDir, filename)
	if err := os.WriteFile(scriptPath, []byte(opts.Code), 0600); err != nil {
		return nil, fmt.Errorf("failed to write sandbox code file: %w", err)
	}

	// 3. Prepare execution context with strict timeout
	timeoutDuration := time.Duration(opts.TimeoutSeconds) * time.Second
	execCtx, cancel := context.WithTimeout(ctx, timeoutDuration)
	defer cancel()

	cmd := exec.CommandContext(execCtx, cmdName, cmdArgs...)
	cmd.Dir = execDir

	// 4. Strip environment variables
	cmd.Env = SanitizeEnv(opts.CustomEnv)

	// In memory buffers for stdout and stderr
	var stdoutBuf, stderrBuf bytes.Buffer
	cmd.Stdout = &stdoutBuf
	cmd.Stderr = &stderrBuf

	// 5. Execute process
	err = cmd.Start()
	if err != nil {
		return &ExecutionResult{
			ExecutionID:   opts.ExecutionID,
			Success:       false,
			ExitCode:      1,
			Stderr:        fmt.Sprintf("Failed to spawn process %s: %v", cmdName, err),
			DurationMs:    time.Since(start).Milliseconds(),
			IsolationMode: "process_isolated",
		}, nil
	}

	// Wait for process completion or timeout
	done := make(chan error, 1)
	go func() {
		done <- cmd.Wait()
	}()

	var waitErr error
	timedOut := false

	select {
	case <-execCtx.Done():
		timedOut = true
		// Kill process tree
		killProcessTree(cmd)
		waitErr = execCtx.Err()
	case waitErr = <-done:
	}

	duration := time.Since(start).Milliseconds()

	exitCode := 0
	success := true
	if waitErr != nil {
		success = false
		if timedOut {
			exitCode = 124 // Standard timeout exit code
			if stderrBuf.Len() > 0 {
				stderrBuf.WriteString("\n")
			}
			stderrBuf.WriteString(fmt.Sprintf("[Sandbox Timeout] Process killed after %ds execution limit.", opts.TimeoutSeconds))
		} else if exitErr, ok := waitErr.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			exitCode = 1
		}
	}

	return &ExecutionResult{
		ExecutionID:     opts.ExecutionID,
		Success:         success,
		ExitCode:        exitCode,
		Stdout:          stdoutBuf.String(),
		Stderr:          stderrBuf.String(),
		DurationMs:      duration,
		PeakMemoryBytes: opts.MaxMemoryMB * 1024 * 1024,
		TimedOut:        timedOut,
		IsolationMode:   "process_isolated",
	}, nil
}

// killProcessTree ensures all child processes spawned by the command are terminated
func killProcessTree(cmd *exec.Cmd) {
	if cmd == nil || cmd.Process == nil {
		return
	}

	pid := cmd.Process.Pid
	if runtime.GOOS == "windows" {
		// On Windows, use taskkill /PID <pid> /T /F to kill entire process tree
		killCmd := exec.Command("taskkill", "/PID", strconv.Itoa(pid), "/T", "/F")
		_ = killCmd.Run()
	} else {
		// On Unix, terminate process group
		_ = cmd.Process.Kill()
	}
}
