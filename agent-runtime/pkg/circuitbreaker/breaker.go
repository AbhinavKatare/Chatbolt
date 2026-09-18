package circuitbreaker

import (
	"fmt"
	"sync"
	"time"
)

type State string

const (
	StateClosed   State = "CLOSED"
	StateOpen     State = "OPEN"
	StateHalfOpen State = "HALF_OPEN"
)

type Config struct {
	FailureThreshold int           // Number of failures before opening breaker
	SuccessThreshold int           // Number of successes in half-open before closing breaker
	WindowDuration   time.Duration // Time window for failure tracking
	CooldownDuration time.Duration // Time to remain open before transitioning to half-open
}

func DefaultConfig() Config {
	return Config{
		FailureThreshold: 5,
		SuccessThreshold: 2,
		WindowDuration:   30 * time.Second,
		CooldownDuration: 20 * time.Second,
	}
}

type breakerState struct {
	target        string
	state         State
	failures      []time.Time
	successStreak int
	lastFailure   time.Time
	openedAt      time.Time
}

type Registry struct {
	mu     sync.RWMutex
	config Config
	states map[string]*breakerState
}

func NewRegistry(cfg Config) *Registry {
	return &Registry{
		config: cfg,
		states: make(map[string]*breakerState),
	}
}

func (r *Registry) getOrCreate(target string) *breakerState {
	if b, ok := r.states[target]; ok {
		return b
	}
	b := &breakerState{
		target:   target,
		state:    StateClosed,
		failures: make([]time.Time, 0),
	}
	r.states[target] = b
	return b
}

// Allow checks whether a request to the given target is allowed to proceed
func (r *Registry) Allow(target string) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	b := r.getOrCreate(target)
	now := time.Now()

	switch b.state {
	case StateClosed:
		return true, nil

	case StateOpen:
		// Check if cooldown has elapsed
		if now.Sub(b.openedAt) >= r.config.CooldownDuration {
			b.state = StateHalfOpen
			b.successStreak = 0
			return true, nil
		}
		remaining := r.config.CooldownDuration - now.Sub(b.openedAt)
		return false, fmt.Errorf("circuit breaker is OPEN for %s (cooldown remaining: %v)", target, remaining.Round(time.Millisecond))

	case StateHalfOpen:
		// In half-open, allow single-flight/probe requests
		return true, nil
	}

	return true, nil
}

// RecordSuccess marks a successful execution for the target
func (r *Registry) RecordSuccess(target string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	b := r.getOrCreate(target)
	if b.state == StateHalfOpen {
		b.successStreak++
		if b.successStreak >= r.config.SuccessThreshold {
			b.state = StateClosed
			b.failures = make([]time.Time, 0)
			b.successStreak = 0
		}
	} else if b.state == StateClosed {
		// Clean up old failures outside the window
		r.pruneFailures(b, time.Now())
	}
}

// RecordFailure marks a failed execution for the target
func (r *Registry) RecordFailure(target string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	b := r.getOrCreate(target)
	now := time.Now()
	b.lastFailure = now

	if b.state == StateHalfOpen {
		// Single failure in half-open trips back to open
		b.state = StateOpen
		b.openedAt = now
		b.successStreak = 0
		return
	}

	// In closed state, record failure and check threshold in sliding window
	r.pruneFailures(b, now)
	b.failures = append(b.failures, now)

	if len(b.failures) >= r.config.FailureThreshold {
		b.state = StateOpen
		b.openedAt = now
		b.successStreak = 0
	}
}

func (r *Registry) pruneFailures(b *breakerState, now time.Time) {
	cutoff := now.Add(-r.config.WindowDuration)
	valid := make([]time.Time, 0, len(b.failures))
	for _, t := range b.failures {
		if t.After(cutoff) {
			valid = append(valid, t)
		}
	}
	b.failures = valid
}

type StateSummary struct {
	Target               string `json:"target"`
	State                State  `json:"state"`
	FailureCount         int    `json:"failure_count"`
	SuccessStreak        int    `json:"success_streak"`
	LastFailureMs        int64  `json:"last_failure_ms"`
	CooldownRemainingMs  int64  `json:"cooldown_remaining_ms"`
}

func (r *Registry) GetState(target string) StateSummary {
	r.mu.RLock()
	defer r.mu.RUnlock()

	b, ok := r.states[target]
	if !ok {
		return StateSummary{
			Target: target,
			State:  StateClosed,
		}
	}

	now := time.Now()
	var cooldownMs int64
	if b.state == StateOpen {
		rem := r.config.CooldownDuration - now.Sub(b.openedAt)
		if rem > 0 {
			cooldownMs = rem.Milliseconds()
		}
	}

	var lastFailMs int64
	if !b.lastFailure.IsZero() {
		lastFailMs = b.lastFailure.UnixMilli()
	}

	return StateSummary{
		Target:              target,
		State:               b.state,
		FailureCount:        len(b.failures),
		SuccessStreak:       b.successStreak,
		LastFailureMs:       lastFailMs,
		CooldownRemainingMs: cooldownMs,
	}
}

func (r *Registry) GetAllStates() map[string]StateSummary {
	r.mu.RLock()
	defer r.mu.RUnlock()

	result := make(map[string]StateSummary)
	for target := range r.states {
		result[target] = r.GetState(target)
	}
	return result
}
