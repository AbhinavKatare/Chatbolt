package tests

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"agent-runtime/pkg/bus"
	"agent-runtime/pkg/circuitbreaker"
	"agent-runtime/pkg/concurrency"
	"agent-runtime/pkg/metrics"
	"agent-runtime/pkg/sandbox"
	"agent-runtime/pkg/service"
)

func TestLoad_20PlusConcurrentAgentExecutions(t *testing.T) {
	const concurrentAgents = 25

	t.Logf("🚀 Starting Load Test: %d Concurrent Agent Executions...", concurrentAgents)

	// 1. Initialize subsystems
	metricsCol := metrics.NewCollector(int32(concurrentAgents))
	cbRegistry := circuitbreaker.NewRegistry(circuitbreaker.DefaultConfig())
	agentBus := bus.NewAgentBus(500)
	sandboxExec := sandbox.NewExecutor()

	poolCfg := concurrency.PoolConfig{
		MinWorkers:        8,
		MaxWorkers:        concurrentAgents,
		QueueCapacity:     100,
		IdleWorkerTimeout: 10 * time.Second,
		AdaptiveScaling:   true,
	}
	workerPool := concurrency.NewWorkerPool(poolCfg, metricsCol)
	defer workerPool.Shutdown(5 * time.Second)

	runtimeSvc := service.NewRuntimeService(
		workerPool,
		sandboxExec,
		agentBus,
		cbRegistry,
		metricsCol,
	)

	// 2. Set up AgentBus listener
	sub := agentBus.Subscribe("load-test-lead", []string{"workflow.*"})
	defer agentBus.Unsubscribe("load-test-lead")

	var busMessagesReceived int32
	busStop := make(chan struct{})
	go func() {
		for {
			select {
			case <-busStop:
				return
			case _, ok := <-sub.Channel:
				if !ok {
					return
				}
				atomic.AddInt32(&busMessagesReceived, 1)
			}
		}
	}()

	// 3. Launch concurrent agent tasks
	var wg sync.WaitGroup
	var successCount int32
	var failureCount int32
	latencies := make([]int64, concurrentAgents)

	overallStart := time.Now()

	for i := 0; i < concurrentAgents; i++ {
		wg.Add(1)
		agentIdx := i

		go func(idx int) {
			defer wg.Done()
			taskStart := time.Now()
			runID := fmt.Sprintf("run-load-%d", idx)
			stepID := fmt.Sprintf("step-%d", idx)

			// Alternate task types across agents:
			// 0 = Code execution (Node)
			// 1 = Code execution (Python / Simple script)
			// 2 = AgentBus message fanout
			// 3 = Fast compute / analysis step
			taskType := idx % 4

			var err error
			switch taskType {
			case 0:
				// Node sandbox execution
				code := fmt.Sprintf(`const a = %d; const b = %d; console.log("RESULT:" + (a * b));`, idx, idx+1)
				res, execErr := runtimeSvc.ExecuteSandboxCode(context.Background(), sandbox.ExecutionOptions{
					ExecutionID:    fmt.Sprintf("load-node-%d", idx),
					Language:       "node",
					Code:           code,
					TimeoutSeconds: 10,
				})
				if execErr != nil || (res != nil && !res.Success) {
					err = fmt.Errorf("node sandbox failed: %v", execErr)
				}

			case 1:
				// Agent step with code executor
				statusCh := make(chan map[string]interface{}, 5)
				done := make(chan struct{})
				go func() {
					for range statusCh {
					}
					close(done)
				}()
				err = runtimeSvc.ExecuteAgentStep(
					context.Background(),
					runID, stepID, "tenant-load", fmt.Sprintf("agent-%d", idx), "code_generator", "code_executor",
					`{"language":"node","code":"console.log('AGENT_COMPLETED');"}`,
					10,
					statusCh,
				)
				<-done

			case 2:
				// AgentBus pub/sub messaging
				_, err = agentBus.Publish(&bus.Message{
					RunID:         runID,
					SenderAgentID: fmt.Sprintf("agent-%d", idx),
					SenderRole:    "researcher",
					TargetTopic:   fmt.Sprintf("workflow.%s.lead", runID),
					EventType:     "findings_published",
					PayloadJSON:   fmt.Sprintf(`{"agent":%d,"metrics":100}`, idx),
				})

			case 3:
				// Fast compute step
				statusCh := make(chan map[string]interface{}, 5)
				done := make(chan struct{})
				go func() {
					for range statusCh {
					}
					close(done)
				}()
				err = runtimeSvc.ExecuteAgentStep(
					context.Background(),
					runID, stepID, "tenant-load", fmt.Sprintf("agent-%d", idx), "analyst", "analyze_data",
					`{"dataset_size":1000}`,
					5,
					statusCh,
				)
				<-done
			}

			lat := time.Since(taskStart).Milliseconds()
			latencies[idx] = lat

			if err != nil {
				atomic.AddInt32(&failureCount, 1)
				t.Logf("Agent %d failed (%dms): %v", idx, lat, err)
			} else {
				atomic.AddInt32(&successCount, 1)
			}
		}(agentIdx)
	}

	wg.Wait()
	close(busStop)

	totalDuration := time.Since(overallStart)

	// Collect final resource metrics
	finalMetrics := metricsCol.Collect()

	// Calculate latency statistics
	sort.Slice(latencies, func(i, j int) bool { return latencies[i] < latencies[j] })
	p50 := latencies[int(float64(len(latencies))*0.50)]
	p90 := latencies[int(float64(len(latencies))*0.90)]
	p99 := latencies[int(float64(len(latencies))*0.99)]

	throughput := float64(concurrentAgents) / totalDuration.Seconds()

	t.Logf("\n=======================================================")
	t.Logf("📊 LOAD TEST RESULTS: %d CONCURRENT AGENTS", concurrentAgents)
	t.Logf("=======================================================")
	t.Logf("  Total Tasks:       %d", concurrentAgents)
	t.Logf("  Successful Tasks:  %d (%.1f%%)", successCount, (float64(successCount)/float64(concurrentAgents))*100)
	t.Logf("  Failed Tasks:      %d", failureCount)
	t.Logf("  Total Duration:    %v", totalDuration.Round(time.Millisecond))
	t.Logf("  Throughput:        %.2f agents/sec", throughput)
	t.Logf("  Latency (p50):     %d ms", p50)
	t.Logf("  Latency (p90):     %d ms", p90)
	t.Logf("  Latency (p99):     %d ms", p99)
	t.Logf("  Active Workers:    %d / %d", finalMetrics.ActiveWorkers, finalMetrics.MaxWorkers)
	t.Logf("  Active Goroutines: %d", finalMetrics.ActiveGoroutines)
	t.Logf("  Allocated Memory:  %.2f MB (sys: %.2f MB)", float64(finalMetrics.MemoryUsedBytes)/(1024*1024), float64(finalMetrics.MemoryUsedBytes)/(1024*1024))
	t.Logf("  Bus Messages:      %d received", atomic.LoadInt32(&busMessagesReceived))
	t.Logf("=======================================================\n")

	if failureCount > 0 {
		t.Fatalf("Load test encountered %d failed executions", failureCount)
	}
}

func min(a, b int64) int64 {
	if a < b {
		return a
	}
	return b
}
