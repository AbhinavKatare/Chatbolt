package concurrency

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"agent-runtime/pkg/metrics"
)

type TaskFunc func(ctx context.Context) (interface{}, error)

type Task struct {
	ID        string
	Fn        TaskFunc
	ResultCh  chan TaskResult
	Ctx       context.Context
	CreatedAt time.Time
}

type TaskResult struct {
	Value interface{}
	Err   error
}

type PoolConfig struct {
	MinWorkers        int           // Minimum worker goroutines
	MaxWorkers        int           // Maximum worker goroutines
	QueueCapacity     int           // Bounded task channel buffer
	IdleWorkerTimeout time.Duration // Worker spin-down timeout
	AdaptiveScaling   bool          // Dynamically scale based on CPU/RAM metrics
}

func DefaultPoolConfig() PoolConfig {
	return PoolConfig{
		MinWorkers:        4,
		MaxWorkers:        16,
		QueueCapacity:     100,
		IdleWorkerTimeout: 10 * time.Second,
		AdaptiveScaling:   true,
	}
}

type WorkerPool struct {
	config      PoolConfig
	metrics     *metrics.Collector
	taskQueue   chan *Task
	activeCount int32
	closed      int32
	wg          sync.WaitGroup
	ctx         context.Context
	cancel      context.CancelFunc
}

func NewWorkerPool(cfg PoolConfig, collector *metrics.Collector) *WorkerPool {
	if cfg.MinWorkers <= 0 {
		cfg.MinWorkers = 4
	}
	if cfg.MaxWorkers < cfg.MinWorkers {
		cfg.MaxWorkers = cfg.MinWorkers * 2
	}
	if cfg.QueueCapacity <= 0 {
		cfg.QueueCapacity = 100
	}

	ctx, cancel := context.WithCancel(context.Background())
	if collector != nil {
		collector.SetMaxWorkers(int32(cfg.MaxWorkers))
	}

	pool := &WorkerPool{
		config:    cfg,
		metrics:   collector,
		taskQueue: make(chan *Task, cfg.QueueCapacity),
		ctx:       ctx,
		cancel:    cancel,
	}

	// Start baseline worker goroutines
	for i := 0; i < cfg.MinWorkers; i++ {
		pool.spawnWorker()
	}

	// Start adaptive autoscaler routine if enabled
	if cfg.AdaptiveScaling {
		go pool.autoScaleRoutine()
	}

	return pool
}

func (p *WorkerPool) spawnWorker() {
	p.wg.Add(1)
	go func() {
		defer p.wg.Done()
		for {
			select {
			case <-p.ctx.Done():
				return
			case task, ok := <-p.taskQueue:
				if !ok {
					return
				}
				p.executeTask(task)
			}
		}
	}()
}

func (p *WorkerPool) executeTask(task *Task) {
	atomic.AddInt32(&p.activeCount, 1)
	if p.metrics != nil {
		p.metrics.IncActiveWorkers()
		p.metrics.SetQueuedTasks(int32(len(p.taskQueue)))
	}

	defer func() {
		atomic.AddInt32(&p.activeCount, -1)
		if p.metrics != nil {
			p.metrics.DecActiveWorkers()
			p.metrics.SetQueuedTasks(int32(len(p.taskQueue)))
		}
	}()

	// Check if task context already canceled before execution
	if err := task.Ctx.Err(); err != nil {
		task.ResultCh <- TaskResult{Err: err}
		if p.metrics != nil {
			p.metrics.RecordTaskCompleted(false)
		}
		return
	}

	res, err := task.Fn(task.Ctx)
	task.ResultCh <- TaskResult{Value: res, Err: err}
	if p.metrics != nil {
		p.metrics.RecordTaskCompleted(err == nil)
	}
}

// Submit enqueues a task and returns a channel for the result
func (p *WorkerPool) Submit(ctx context.Context, id string, fn TaskFunc) (<-chan TaskResult, error) {
	if atomic.LoadInt32(&p.closed) == 1 {
		return nil, fmt.Errorf("worker pool is stopped, cannot accept new tasks")
	}

	resultCh := make(chan TaskResult, 1)
	task := &Task{
		ID:        id,
		Fn:        fn,
		ResultCh:  resultCh,
		Ctx:       ctx,
		CreatedAt: time.Now(),
	}

	// Check if we need to dynamically scale up worker count under high queue pressure
	qLen := len(p.taskQueue)
	currentActive := int(atomic.LoadInt32(&p.activeCount))
	if qLen > 2 && currentActive >= p.config.MinWorkers && currentActive < p.config.MaxWorkers {
		p.spawnWorker()
	}

	select {
	case p.taskQueue <- task:
		if p.metrics != nil {
			p.metrics.SetQueuedTasks(int32(len(p.taskQueue)))
		}
		return resultCh, nil
	default:
		return nil, fmt.Errorf("worker pool queue capacity (%d) saturated", p.config.QueueCapacity)
	}
}

// SubmitSync submits a task and blocks until execution completes or context cancels
func (p *WorkerPool) SubmitSync(ctx context.Context, id string, fn TaskFunc) (interface{}, error) {
	resultCh, err := p.Submit(ctx, id, fn)
	if err != nil {
		return nil, err
	}

	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case res := <-resultCh:
		return res.Value, res.Err
	}
}

func (p *WorkerPool) autoScaleRoutine() {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-p.ctx.Done():
			return
		case <-ticker.C:
			if p.metrics == nil {
				continue
			}
			m := p.metrics.Collect()
			
			// If CPU > 85% or RAM > 90%, throttle max workers down to prevent machine thrashing
			if m.CPUPercent > 85.0 || m.MemoryPercent > 90.0 {
				newMax := int32(p.config.MinWorkers)
				p.metrics.SetMaxWorkers(newMax)
			} else if m.CPUPercent < 50.0 && m.MemoryPercent < 70.0 {
				p.metrics.SetMaxWorkers(int32(p.config.MaxWorkers))
			}
		}
	}
}

func (p *WorkerPool) ActiveWorkers() int {
	return int(atomic.LoadInt32(&p.activeCount))
}

func (p *WorkerPool) QueueDepth() int {
	return len(p.taskQueue)
}

func (p *WorkerPool) Shutdown(timeout time.Duration) {
	atomic.StoreInt32(&p.closed, 1)
	p.cancel()
	close(p.taskQueue)

	done := make(chan struct{})
	go func() {
		p.wg.Wait()
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(timeout):
	}
}
