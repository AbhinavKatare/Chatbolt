package sandbox

import (
	"os"
	"strings"
)

// Whitelisted minimal system environment variable keys
var defaultAllowedEnvKeys = map[string]bool{
	"PATH":        true,
	"SYSTEMROOT":  true,
	"WINDIR":      true,
	"TEMP":        true,
	"TMP":         true,
	"USERPROFILE": true,
	"HOME":        true,
	"NODE_PATH":   true,
	"PYTHONPATH":  true,
}

// Disallowed sensitive substrings that must NEVER be passed to sandboxed child processes
var sensitiveKeywords = []string{
	"KEY", "SECRET", "TOKEN", "PASSWORD", "AUTH", "CREDENTIAL",
	"SUPABASE", "NVIDIA", "OPENAI", "DATABASE", "POSTGRES", "REDIS",
	"JWT", "STRIPE", "TWILIO", "RESEND", "RAZORPAY", "VAULT",
}

// SanitizeEnv returns a strictly scrubbed environment slice with host secrets removed
func SanitizeEnv(customEnv map[string]string) []string {
	sanitized := make([]string, 0)

	// 1. Include only safe system environment variables
	for _, envVar := range os.Environ() {
		parts := strings.SplitN(envVar, "=", 2)
		if len(parts) == 0 {
			continue
		}
		key := strings.ToUpper(parts[0])

		if defaultAllowedEnvKeys[key] {
			// Check that value doesn't accidentally contain sensitive substrings
			if !containsSensitiveSubstring(key) {
				sanitized = append(sanitized, envVar)
			}
		}
	}

	// 2. Include user-specified custom environment variables only if safe
	for k, v := range customEnv {
		upperKey := strings.ToUpper(k)
		if !containsSensitiveSubstring(upperKey) {
			sanitized = append(sanitized, k+"="+v)
		}
	}

	return sanitized
}

func containsSensitiveSubstring(key string) bool {
	upper := strings.ToUpper(key)
	for _, word := range sensitiveKeywords {
		if strings.Contains(upper, word) {
			return true
		}
	}
	return false
}
