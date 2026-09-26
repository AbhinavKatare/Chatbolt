package sandbox

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
)

// DiffHunk represents a targeted code replacement chunk
type DiffHunk struct {
	StartLine          int    `json:"start_line"`
	EndLine            int    `json:"end_line"`
	TargetContent      string `json:"target_content"`
	ReplacementContent string `json:"replacement_content"`
	AllowMultiple      bool   `json:"allow_multiple"`
}

// ApplyDiffRequest defines the payload for patching a file in the sandbox
type ApplyDiffRequest struct {
	FilePath        string     `json:"file_path"`
	OriginalContent string     `json:"original_content,omitempty"`
	Hunks           []DiffHunk `json:"hunks"`
	UnifiedDiff     string     `json:"unified_diff,omitempty"`
	FallbackToFull  bool       `json:"fallback_to_full,omitempty"`
}

// ApplyDiffResult represents the outcome of a diff application
type ApplyDiffResult struct {
	Success          bool   `json:"success"`
	FilePath         string `json:"file_path"`
	HunksApplied     int    `json:"hunks_applied"`
	TotalHunks       int    `json:"total_hunks"`
	PatchedContent   string `json:"patched_content,omitempty"`
	Error            string `json:"error,omitempty"`
	RetryWithContext bool   `json:"retry_with_context"`
	Stage            string `json:"stage"` // "exact", "normalized", "fuzzy_hunk", "fallback"
}

type DiffPatcher struct {
	mu sync.Mutex
}

func NewDiffPatcher() *DiffPatcher {
	return &DiffPatcher{}
}

// ApplyDiff applies targeted diff hunks to a file inside the specified sandbox root
func (p *DiffPatcher) ApplyDiff(sandboxRoot string, req ApplyDiffRequest) (*ApplyDiffResult, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	// 1. Sanitize file path
	cleanPath := filepath.Clean(req.FilePath)
	var fullPath string
	if filepath.IsAbs(cleanPath) {
		fullPath = cleanPath
	} else {
		fullPath = filepath.Join(sandboxRoot, cleanPath)
	}

	// 2. Read or use provided original content
	var originalContent string
	fileExisted := true
	data, err := os.ReadFile(fullPath)
	if err != nil {
		if os.IsNotExist(err) {
			fileExisted = false
			if req.OriginalContent != "" {
				originalContent = req.OriginalContent
			} else if req.FallbackToFull && len(req.Hunks) > 0 {
				// For new files, if replacement is provided
				originalContent = ""
			} else {
				return &ApplyDiffResult{
					Success:  false,
					FilePath: req.FilePath,
					Error:    fmt.Sprintf("Target file does not exist: %s", req.FilePath),
				}, nil
			}
		} else {
			return nil, fmt.Errorf("failed to read target file: %w", err)
		}
	} else {
		originalContent = string(data)
	}

	// Parse unified diff if hunks not provided
	hunks := req.Hunks
	if len(hunks) == 0 && req.UnifiedDiff != "" {
		parsedHunks, parseErr := parseUnifiedDiff(req.UnifiedDiff)
		if parseErr != nil {
			return &ApplyDiffResult{
				Success:  false,
				FilePath: req.FilePath,
				Error:    fmt.Sprintf("Failed to parse unified diff: %v", parseErr),
			}, nil
		}
		hunks = parsedHunks
	}

	// If no hunks and file is new with replacement
	if len(hunks) == 0 {
		if !fileExisted && req.OriginalContent != "" {
			if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
				return nil, err
			}
			if err := os.WriteFile(fullPath, []byte(req.OriginalContent), 0644); err != nil {
				return nil, err
			}
			return &ApplyDiffResult{
				Success:        true,
				FilePath:       req.FilePath,
				HunksApplied:   0,
				TotalHunks:     0,
				PatchedContent: req.OriginalContent,
				Stage:          "new_file_create",
			}, nil
		}
		return &ApplyDiffResult{
			Success:  false,
			FilePath: req.FilePath,
			Error:    "No diff hunks or unified diff provided",
		}, nil
	}

	// 3. Multi-Stage Patch Application
	currentContent := originalContent
	appliedCount := 0
	lastStage := "exact"

	for idx, hunk := range hunks {
		patched, stageUsed, err := applySingleHunk(currentContent, hunk)
		if err != nil {
			// Failed on this hunk - trigger context expansion retry recommendation
			return &ApplyDiffResult{
				Success:          false,
				FilePath:         req.FilePath,
				HunksApplied:     appliedCount,
				TotalHunks:       len(hunks),
				Error:            fmt.Sprintf("Hunk %d/%d failed: %v", idx+1, len(hunks), err),
				RetryWithContext: true,
				Stage:            stageUsed,
			}, nil
		}
		currentContent = patched
		appliedCount++
		lastStage = stageUsed
	}

	// 4. Write verified patched content to disk
	if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
		return nil, fmt.Errorf("failed to create parent directories: %w", err)
	}
	if err := os.WriteFile(fullPath, []byte(currentContent), 0644); err != nil {
		return nil, fmt.Errorf("failed to write patched file: %w", err)
	}

	return &ApplyDiffResult{
		Success:        true,
		FilePath:       req.FilePath,
		HunksApplied:   appliedCount,
		TotalHunks:     len(hunks),
		PatchedContent: currentContent,
		Stage:          lastStage,
	}, nil
}

// applySingleHunk tries exact match -> whitespace-normalized match -> fuzzy context window expansion
func applySingleHunk(content string, hunk DiffHunk) (string, string, error) {
	target := hunk.TargetContent
	replacement := hunk.ReplacementContent

	// Stage 1: Exact Match
	if target == "" && content == "" {
		return replacement, "exact", nil
	}

	if target != "" && strings.Contains(content, target) {
		count := strings.Count(content, target)
		if count == 1 || hunk.AllowMultiple {
			if hunk.AllowMultiple {
				return strings.ReplaceAll(content, target, replacement), "exact", nil
			}
			return strings.Replace(content, target, replacement, 1), "exact", nil
		}
	}

	// Stage 2: Whitespace & CRLF/LF Normalization Match
	res, ok := replaceNormalized(content, target, replacement)
	if ok {
		return res, "normalized", nil
	}

	// Stage 3: Context-Widening Fuzzy Hunk Matching
	res, ok = applyFuzzyContextHunk(content, hunk)
	if ok {
		return res, "fuzzy_hunk", nil
	}

	return content, "failed", errors.New("target content could not be located cleanly in file. Context expansion retry recommended")
}

func cleanLines(s string) []string {
	s = strings.ReplaceAll(s, "\r\n", "\n")
	raw := strings.Split(s, "\n")
	for len(raw) > 0 && strings.TrimSpace(raw[len(raw)-1]) == "" {
		raw = raw[:len(raw)-1]
	}
	for len(raw) > 0 && strings.TrimSpace(raw[0]) == "" {
		raw = raw[1:]
	}
	return raw
}

func replaceNormalized(content, target, replacement string) (string, bool) {
	cLines := strings.Split(strings.ReplaceAll(content, "\r\n", "\n"), "\n")
	tLines := cleanLines(target)

	if len(tLines) == 0 {
		return content, false
	}

	// Find starting line
	for i := 0; i <= len(cLines)-len(tLines); i++ {
		match := true
		for j := 0; j < len(tLines); j++ {
			if strings.TrimSpace(cLines[i+j]) != strings.TrimSpace(tLines[j]) {
				match = false
				break
			}
		}
		if match {
			// Found matching block!
			before := cLines[:i]
			after := cLines[i+len(tLines):]
			rLines := strings.Split(strings.ReplaceAll(strings.TrimRight(replacement, "\r\n"), "\r\n", "\n"), "\n")

			newContentLines := append(before, rLines...)
			newContentLines = append(newContentLines, after...)
			return strings.Join(newContentLines, "\n"), true
		}
	}
	return content, false
}

func applyFuzzyContextHunk(content string, hunk DiffHunk) (string, bool) {
	lines := strings.Split(strings.ReplaceAll(content, "\r\n", "\n"), "\n")
	tLines := strings.Split(strings.ReplaceAll(hunk.TargetContent, "\r\n", "\n"), "\n")

	if len(tLines) == 0 {
		return content, false
	}

	// Search around hunk.StartLine with widening window (+/- 20 lines)
	startHint := hunk.StartLine - 1
	if startHint < 0 {
		startHint = 0
	}
	if startHint >= len(lines) {
		startHint = len(lines) - 1
	}

	bestIdx := -1
	minDiff := 999999

	for offset := 0; offset <= 30; offset++ {
		candidates := []int{startHint + offset, startHint - offset}
		for _, idx := range candidates {
			if idx < 0 || idx+len(tLines) > len(lines) {
				continue
			}
			matchScore := 0
			for j := 0; j < len(tLines); j++ {
				if strings.TrimSpace(lines[idx+j]) == strings.TrimSpace(tLines[j]) {
					matchScore++
				}
			}
			// If at least 75% of lines match
			if float64(matchScore)/float64(len(tLines)) >= 0.75 {
				dist := offset
				if dist < minDiff {
					minDiff = dist
					bestIdx = idx
				}
			}
		}
		if bestIdx != -1 {
			break
		}
	}

	if bestIdx != -1 {
		before := lines[:bestIdx]
		after := lines[bestIdx+len(tLines):]
		rLines := strings.Split(strings.ReplaceAll(hunk.ReplacementContent, "\r\n", "\n"), "\n")
		newLines := append(before, rLines...)
		newLines = append(newLines, after...)
		return strings.Join(newLines, "\n"), true
	}

	return content, false
}

var hunkHeaderRegex = regexp.MustCompile(`^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@`)

func parseUnifiedDiff(diffText string) ([]DiffHunk, error) {
	var hunks []DiffHunk
	lines := strings.Split(diffText, "\n")
	var currentHunk *DiffHunk
	var origLines []string
	var newLines []string

	for _, line := range lines {
		if hunkHeaderRegex.MatchString(line) {
			if currentHunk != nil {
				currentHunk.TargetContent = strings.Join(origLines, "\n")
				currentHunk.ReplacementContent = strings.Join(newLines, "\n")
				hunks = append(hunks, *currentHunk)
			}
			matches := hunkHeaderRegex.FindStringSubmatch(line)
			origStart, _ := strconv.Atoi(matches[1])
			origLen := 1
			if len(matches) > 2 && matches[2] != "" {
				origLen, _ = strconv.Atoi(matches[2])
			}
			currentHunk = &DiffHunk{
				StartLine: origStart,
				EndLine:   origStart + origLen - 1,
			}
			origLines = []string{}
			newLines = []string{}
			continue
		}

		if currentHunk != nil {
			if strings.HasPrefix(line, "-") {
				origLines = append(origLines, strings.TrimPrefix(line, "-"))
			} else if strings.HasPrefix(line, "+") {
				newLines = append(newLines, strings.TrimPrefix(line, "+"))
			} else if strings.HasPrefix(line, " ") {
				origLines = append(origLines, strings.TrimPrefix(line, " "))
				newLines = append(newLines, strings.TrimPrefix(line, " "))
			}
		}
	}

	if currentHunk != nil {
		currentHunk.TargetContent = strings.Join(origLines, "\n")
		currentHunk.ReplacementContent = strings.Join(newLines, "\n")
		hunks = append(hunks, *currentHunk)
	}

	return hunks, nil
}
