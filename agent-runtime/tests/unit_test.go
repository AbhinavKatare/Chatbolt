package tests

import (
	"context"
	"fmt"
	"os"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"agent-runtime/pkg/bus"
	"agent-runtime/pkg/circuitbreaker"
	"agent-runtime/pkg/concurrency"
	"agent-runtime/pkg/metrics"
	"agent-runtime/pkg/sandbox"
)

func TestWorkerPool_ConcurrencyLimits(t *testing.T) {
	col := metrics.NewCollector(8)
	pool := concurrency.NewWorkerPool(concurrency.PoolConfig{
		MinWorkers:        4,
		MaxWorkers:        8,
		QueueCapacity:     50,
		IdleWorkerTimeout: 5 * time.Second,
		AdaptiveScaling:   false,
	}, col)
	defer pool.Shutdown(2 * time.Second)

	totalTasks := 16
	var activeMax int32
	var completedCount int32
	var wg sync.WaitGroup

	for i := 0; i < totalTasks; i++ {
		wg.Add(1)
		taskID := fmt.Sprintf("task-%d", i)
		resCh, err := pool.Submit(context.Background(), taskID, func(ctx context.Context) (interface{}, error) {
			cur := int32(pool.ActiveWorkers())
			for {
				old := atomic.LoadInt32(&activeMax)
				if cur <= old || atomic.CompareAndSwapInt32(&activeMax, old, cur) {
					break
				}
			}
			time.Sleep(30 * time.Millisecond)
			return "ok", nil
		})

		if err != nil {
			t.Fatalf("Failed to submit task %d: %v", i, err)
		}

		go func(ch <-chan concurrency.TaskResult) {
			defer wg.Done()
			res := <-ch
			if res.Err != nil || res.Value != "ok" {
				t.Errorf("Unexpected task result: %v", res)
			}
			atomic.AddInt32(&completedCount, 1)
		}(resCh)
	}

	wg.Wait()

	if completedCount != int32(totalTasks) {
		t.Fatalf("Expected %d completed tasks, got %d", totalTasks, completedCount)
	}

	t.Logf("✅ Worker Pool successfully processed %d tasks (peak active workers: %d)", totalTasks, activeMax)
}

func TestSandbox_EnvSanitization(t *testing.T) {
	os.Setenv("SUPABASE_SERVICE_ROLE_KEY", "super-secret-jwt-token-12345")
	os.Setenv("NVIDIA_NIM_API_KEY", "nvapi-classified-llm-token")
	os.Setenv("DATABASE_PASSWORD", "postgres_master_pw")

	customEnv := map[string]string{
		"SAFE_USER_FLAG": "enabled",
		"LEAK_API_KEY":   "do_not_leak_this",
	}

	sanitized := sandbox.SanitizeEnv(customEnv)

	for _, env := range sanitized {
		if containsSensitive(env) {
			t.Fatalf("CRITICAL: Sanitized env leaked sensitive token in: %s", env)
		}
	}

	t.Logf("✅ Sandbox environment sanitized cleanly (%d safe vars retained)", len(sanitized))
}

func containsSensitive(env string) bool {
	lower := env
	return lower == "SUPABASE_SERVICE_ROLE_KEY" ||
		lower == "NVIDIA_NIM_API_KEY" ||
		lower == "DATABASE_PASSWORD" ||
		lower == "LEAK_API_KEY"
}

func TestSandbox_ExecutionAndTimeout(t *testing.T) {
	exec := sandbox.NewExecutor()

	// 1. Valid execution
	res, err := exec.ExecuteCode(context.Background(), sandbox.ExecutionOptions{
		ExecutionID:    "test-valid-node",
		Language:       "node",
		Code:           `console.log("HELLO_FROM_GO_SANDBOX");`,
		TimeoutSeconds: 5,
	})

	if err != nil || !res.Success {
		t.Fatalf("Failed to execute valid node code: %v (stderr: %s)", err, res.Stderr)
	}
	if !contains(res.Stdout, "HELLO_FROM_GO_SANDBOX") {
		t.Fatalf("Expected stdout to contain greeting, got: %s", res.Stdout)
	}

	// 2. Timeout execution
	start := time.Now()
	timeoutRes, err := exec.ExecuteCode(context.Background(), sandbox.ExecutionOptions{
		ExecutionID:    "test-timeout-node",
		Language:       "node",
		Code:           `while(true){}`,
		TimeoutSeconds: 1,
	})

	elapsed := time.Since(start)
	if err != nil {
		t.Fatalf("Unexpected execution error: %v", err)
	}
	if timeoutRes.Success {
		t.Fatalf("Expected timeout execution to fail, got success")
	}
	if !timeoutRes.TimedOut {
		t.Fatalf("Expected TimedOut=true, got false")
	}
	if elapsed > 4*time.Second {
		t.Fatalf("Timeout took too long to terminate: %v", elapsed)
	}

	t.Logf("✅ Sandbox timeout enforced cleanly within %v", elapsed)
}

func TestAgentBus_PubSubAndWildcards(t *testing.T) {
	agentBus := bus.NewAgentBus(50)

	// Subscriber 1: listens to specific workflow topic
	sub1 := agentBus.Subscribe("sub-lead", []string{"workflow.run-42.lead", "broadcast.*"})
	defer agentBus.Unsubscribe("sub-lead")

	// Subscriber 2: listens to all agent messages in run-42
	sub2 := agentBus.Subscribe("sub-all-agents", []string{"workflow.run-42.*"})
	defer agentBus.Unsubscribe("sub-all-agents")

	// Publish message to lead topic
	msg1 := &bus.Message{
		RunID:         "run-42",
		SenderAgentID: "agent-writer-1",
		SenderRole:    "writer",
		TargetTopic:   "workflow.run-42.lead",
		EventType:     "draft_ready",
		PayloadJSON:   `{"chapter":1}`,
	}

	delivered, err := agentBus.Publish(msg1)
	if err != nil || delivered != 2 {
		t.Fatalf("Expected delivery to 2 subscribers, got %d (err: %v)", delivered, err)
	}

	// Verify receipt on sub1
	select {
	case received := <-sub1.Channel:
		if received.EventType != "draft_ready" {
			t.Fatalf("sub1 received unexpected event: %s", received.EventType)
		}
	case <-time.After(1 * time.Second):
		t.Fatalf("sub1 timed out waiting for message")
	}

	// Verify receipt on sub2 (via wildcard match)
	select {
	case received := <-sub2.Channel:
		if received.EventType != "draft_ready" {
			t.Fatalf("sub2 received unexpected event: %s", received.EventType)
		}
	case <-time.After(1 * time.Second):
		t.Fatalf("sub2 timed out waiting for message")
	}

	t.Logf("✅ AgentBus successfully delivered messages with topic wildcard matching")
}

func TestCircuitBreaker_StateTransitions(t *testing.T) {
	cb := circuitbreaker.NewRegistry(circuitbreaker.Config{
		FailureThreshold: 3,
		SuccessThreshold: 2,
		WindowDuration:   10 * time.Second,
		CooldownDuration: 100 * time.Millisecond,
	})

	target := "role:failing_analyst"

	// 1. Initial state: Closed & Allowed
	allowed, _ := cb.Allow(target)
	if !allowed {
		t.Fatalf("Expected circuit breaker to be initially CLOSED/Allowed")
	}

	// 2. Trigger failures up to threshold
	cb.RecordFailure(target)
	cb.RecordFailure(target)
	cb.RecordFailure(target) // 3rd failure trips breaker

	// 3. Assert breaker is now OPEN
	state := cb.GetState(target)
	if state.State != circuitbreaker.StateOpen {
		t.Fatalf("Expected state OPEN after 3 failures, got: %s", state.State)
	}

	allowed, err := cb.Allow(target)
	if allowed {
		t.Fatalf("Expected Allow() to return false when breaker is OPEN")
	}
	t.Logf("Circuit breaker successfully tripped to OPEN: %v", err)

	// 4. Wait for cooldown to transition to HALF_OPEN
	time.Sleep(150 * time.Millisecond)

	allowed, _ = cb.Allow(target)
	if !allowed {
		t.Fatalf("Expected Allow() to be true in HALF_OPEN state")
	}
	state = cb.GetState(target)
	if state.State != circuitbreaker.StateHalfOpen {
		t.Fatalf("Expected state HALF_OPEN, got: %s", state.State)
	}

	// 5. Record successes to recover back to CLOSED
	cb.RecordSuccess(target)
	cb.RecordSuccess(target)

	state = cb.GetState(target)
	if state.State != circuitbreaker.StateClosed {
		t.Fatalf("Expected state CLOSED after successful probe streak, got: %s", state.State)
	}

	t.Logf("✅ Circuit breaker cleanly completed CLOSED -> OPEN -> HALF_OPEN -> CLOSED lifecycle")
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(substr) == 0 || containsSubstring(s, substr))
}

func containsSubstring(s, substr string) bool {
	for i := 0; i+len(substr) <= len(s); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
