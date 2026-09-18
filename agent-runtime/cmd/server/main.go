package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"agent-runtime/pkg/bus"
	"agent-runtime/pkg/circuitbreaker"
	"agent-runtime/pkg/concurrency"
	"agent-runtime/pkg/metrics"
	"agent-runtime/pkg/sandbox"
	"agent-runtime/pkg/service"
)

func main() {
	log.Println("⚡ Starting Chatbolt Agent-Runtime Service...")

	// 1. Parse configuration from environment
	httpPort := getEnv("PORT", getEnv("HTTP_PORT", "8081"))
	maxWorkers, _ := strconv.Atoi(getEnv("MAX_CONCURRENT_AGENTS", "16"))
	minWorkers, _ := strconv.Atoi(getEnv("MIN_CONCURRENT_AGENTS", "4"))
	busBufferSize, _ := strconv.Atoi(getEnv("BUS_BUFFER_SIZE", "200"))

	// 2. Initialize subsystems
	metricsCollector := metrics.NewCollector(int32(maxWorkers))
	cbRegistry := circuitbreaker.NewRegistry(circuitbreaker.DefaultConfig())
	agentBus := bus.NewAgentBus(busBufferSize)
	sandboxExec := sandbox.NewExecutor()

	poolCfg := concurrency.PoolConfig{
		MinWorkers:        minWorkers,
		MaxWorkers:        maxWorkers,
		QueueCapacity:     200,
		IdleWorkerTimeout: 15 * time.Second,
		AdaptiveScaling:   true,
	}
	workerPool := concurrency.NewWorkerPool(poolCfg, metricsCollector)
	defer workerPool.Shutdown(5 * time.Second)

	// 3. Initialize Runtime Service
	runtimeSvc := service.NewRuntimeService(
		workerPool,
		sandboxExec,
		agentBus,
		cbRegistry,
		metricsCollector,
	)

	// 4. Setup HTTP Router & Server
	mux := http.NewServeMux()
	runtimeSvc.RegisterHTTPRoutes(mux)

	// Add CORS middleware
	handler := corsMiddleware(mux)

	server := &http.Server{
		Addr:         ":" + httpPort,
		Handler:      handler,
		ReadTimeout:  60 * time.Second,
		WriteTimeout: 60 * time.Second,
	}

	// 5. Start Server in background
	go func() {
		log.Printf("🚀 Agent-Runtime HTTP & SSE Server listening on http://0.0.0.0:%s\n", httpPort)
		log.Printf("   ├─ Health:   http://localhost:%s/health\n", httpPort)
		log.Printf("   ├─ Metrics:  http://localhost:%s/metrics\n", httpPort)
		log.Printf("   ├─ Sandbox:  POST http://localhost:%s/api/sandbox/exec\n", httpPort)
		log.Printf("   ├─ Steps:    POST http://localhost:%s/api/agent/step\n", httpPort)
		log.Printf("   └─ AgentBus: POST http://localhost:%s/api/bus/publish\n", httpPort)

		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Fatal server error: %v", err)
		}
	}()

	// 6. Graceful Shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit

	log.Println("🛑 Shutting down Agent-Runtime Service...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Printf("Server forced shutdown error: %v\n", err)
	}
	log.Println("✅ Agent-Runtime Service cleanly stopped.")
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, X-Requested-With")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
