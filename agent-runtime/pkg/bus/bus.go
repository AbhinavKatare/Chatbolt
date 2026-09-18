package bus

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"
	"sync"
	"time"
)

type Message struct {
	MessageID     string `json:"message_id"`
	RunID         string `json:"run_id"`
	SenderAgentID string `json:"sender_agent_id"`
	SenderRole    string `json:"sender_role"`
	TargetTopic   string `json:"target_topic"`
	EventType     string `json:"event_type"`
	PayloadJSON   string `json:"payload_json"`
	TimestampMs   int64  `json:"timestamp_ms"`
}

type Subscription struct {
	ID        string
	Topics    []string
	Channel   chan *Message
	closed    bool
	mu        sync.Mutex
}

func (s *Subscription) Matches(topic string) bool {
	for _, pattern := range s.Topics {
		if MatchTopic(pattern, topic) {
			return true
		}
	}
	return false
}

func (s *Subscription) Close() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.closed {
		s.closed = true
		close(s.Channel)
	}
}

// AgentBus provides high-throughput, in-memory topic-based messaging between agents
type AgentBus struct {
	mu            sync.RWMutex
	subscriptions map[string]*Subscription
	bufferSize    int
}

func NewAgentBus(bufferSize int) *AgentBus {
	if bufferSize <= 0 {
		bufferSize = 100
	}
	return &AgentBus{
		subscriptions: make(map[string]*Subscription),
		bufferSize:    bufferSize,
	}
}

func (b *AgentBus) Subscribe(subscriberID string, topics []string) *Subscription {
	b.mu.Lock()
	defer b.mu.Unlock()

	// If existing subscription, close it first
	if existing, ok := b.subscriptions[subscriberID]; ok {
		existing.Close()
	}

	sub := &Subscription{
		ID:      subscriberID,
		Topics:  topics,
		Channel: make(chan *Message, b.bufferSize),
	}
	b.subscriptions[subscriberID] = sub
	return sub
}

func (b *AgentBus) Unsubscribe(subscriberID string) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if sub, ok := b.subscriptions[subscriberID]; ok {
		sub.Close()
		delete(b.subscriptions, subscriberID)
	}
}

// Publish delivers a message to all subscribers matching the target topic
func (b *AgentBus) Publish(msg *Message) (int, error) {
	if msg == nil {
		return 0, fmt.Errorf("cannot publish nil message")
	}

	if msg.MessageID == "" {
		msg.MessageID = generateID("msg")
	}
	if msg.TimestampMs == 0 {
		msg.TimestampMs = time.Now().UnixMilli()
	}

	b.mu.RLock()
	defer b.mu.RUnlock()

	deliveredCount := 0
	for _, sub := range b.subscriptions {
		if sub.Matches(msg.TargetTopic) {
			sub.mu.Lock()
			if !sub.closed {
				select {
				case sub.Channel <- msg:
					deliveredCount++
				default:
					// Channel full: drop oldest or log slow subscriber to prevent head-of-line blocking
					select {
					case <-sub.Channel:
					default:
					}
					sub.Channel <- msg
					deliveredCount++
				}
			}
			sub.mu.Unlock()
		}
	}

	return deliveredCount, nil
}

func (b *AgentBus) SubscriberCount() int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return len(b.subscriptions)
}

// MatchTopic checks pattern matching: "workflow.*", "team.123.lead", "*"
func MatchTopic(pattern, topic string) bool {
	if pattern == "*" || pattern == topic {
		return true
	}
	if strings.HasSuffix(pattern, ".*") {
		prefix := strings.TrimSuffix(pattern, ".*")
		return strings.HasPrefix(topic, prefix)
	}
	if strings.HasSuffix(pattern, "*") {
		prefix := strings.TrimSuffix(pattern, "*")
		return strings.HasPrefix(topic, prefix)
	}
	return false
}

func generateID(prefix string) string {
	bytes := make([]byte, 8)
	_, _ = rand.Read(bytes)
	return fmt.Sprintf("%s-%s", prefix, hex.EncodeToString(bytes))
}
