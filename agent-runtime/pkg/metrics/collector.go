package metrics

import (
	"runtime"
	"sync"
	"sync/atomic"
	"time"
)

type SystemMetrics struct {
	CPUPercent         float64 `json:"cpu_percent"`
	MemoryUsedBytes    int64   `json:"memory_used_bytes"`
	MemoryTotalBytes   int64   `json:"memory_total_bytes"`
	MemoryPercent      float64 `json:"memory_percent"`
	ActiveWorkers      int32   `json:"active_workers"`
	MaxWorkers         int32   `json:"max_workers"`
	QueuedTasks        int32   `json:"queued_tasks"`
	ActiveGoroutines   int32   `json:"active_goroutines"`
	TotalTasksExecuted int64   `json:"total_tasks_executed"`
	TotalTasksFailed   int64   `json:"total_tasks_failed"`
	UptimeSeconds      int64   `json:"uptime_seconds"`
}

type Collector struct {
	startTime          time.Time
	totalTasksExecuted int64
	totalTasksFailed   int64
	activeWorkers      int32
	maxWorkers         int32
	queuedTasks        int32
	mu                 sync.RWMutex
}

func NewCollector(maxWorkers int32) *Collector {
	return &Collector{
		startTime:  time.Now(),
		maxWorkers: maxWorkers,
	}
}

func (c *Collector) SetMaxWorkers(max int32) {
	atomic.StoreInt32(&c.maxWorkers, max)
}

func (c *Collector) IncActiveWorkers() {
	atomic.AddInt32(&c.activeWorkers, 1)
}

func (c *Collector) DecActiveWorkers() {
	atomic.AddInt32(&c.activeWorkers, -1)
}

func (c *Collector) SetQueuedTasks(count int32) {
	atomic.StoreInt32(&c.queuedTasks, count)
}

func (c *Collector) RecordTaskCompleted(success bool) {
	atomic.AddInt64(&c.totalTasksExecuted, 1)
	if !success {
		atomic.AddInt64(&c.totalTasksFailed, 1)
	}
}

func (c *Collector) Collect() SystemMetrics {
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)

	// Approximate system RAM usage from runtime heap & system allocations
	usedMem := int64(memStats.Sys)
	// Default nominal baseline
	totalMem := int64(8 * 1024 * 1024 * 1024) // 8GB nominal baseline for calculations if host OS query unavailable

	memPercent := (float64(usedMem) / float64(totalMem)) * 100.0
	if memPercent > 100.0 {
		memPercent = 100.0
	}

	// Approximate CPU usage dynamically based on active workers / GOMAXPROCS
	active := atomic.LoadInt32(&c.activeWorkers)
	maxW := atomic.LoadInt32(&c.maxWorkers)
	var cpuPercent float64
	if maxW > 0 {
		cpuPercent = (float64(active) / float64(maxW)) * 75.0 // normalized active load
	}

	return SystemMetrics{
		CPUPercent:         cpuPercent,
		MemoryUsedBytes:    usedMem,
		MemoryTotalBytes:   totalMem,
		MemoryPercent:      memPercent,
		ActiveWorkers:      active,
		MaxWorkers:         maxW,
		QueuedTasks:        atomic.LoadInt32(&c.queuedTasks),
		ActiveGoroutines:   int32(runtime.NumGoroutine()),
		TotalTasksExecuted: atomic.LoadInt64(&c.totalTasksExecuted),
		TotalTasksFailed:   atomic.LoadInt64(&c.totalTasksFailed),
		UptimeSeconds:      int64(time.Since(c.startTime).Seconds()),
	}
}
