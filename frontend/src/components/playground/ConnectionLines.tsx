'use client'
import React from 'react'

interface Connection {
  fromAgent: any
  toAgent: any
  fromPos: { x: number; y: number }
  toPos: { x: number; y: number }
  status: 'idle' | 'active' | 'complete' | 'error'
  label?: string
}

const CARD_W = 200
const CARD_H = 160

function getPath(from: { x: number; y: number }, to: { x: number; y: number }) {
  const x1 = from.x + CARD_W
  const y1 = from.y + CARD_H / 2
  const x2 = to.x
  const y2 = to.y + CARD_H / 2
  const dx = Math.abs(x2 - x1) * 0.5
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
}

function getVertPath(from: { x: number; y: number }, to: { x: number; y: number }) {
  const x1 = from.x + CARD_W / 2
  const y1 = from.y + CARD_H
  const x2 = to.x + CARD_W / 2
  const y2 = to.y
  const dy = (y2 - y1) * 0.5
  return `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`
}

export function ConnectionLines({ connections, canvasW, canvasH }: {
  connections: Connection[]
  canvasW: number
  canvasH: number
}) {
  return (
    <svg
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}
      width={canvasW} height={canvasH}
    >
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#E5E7EB" />
        </marker>
        <marker id="arrow-active" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#B8FF00" />
        </marker>
        <marker id="arrow-complete" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#22C55E" />
        </marker>
        <style>{`
          @keyframes dash { to { stroke-dashoffset: -24; } }
          .flow-line { animation: dash 0.8s linear infinite; }
        `}</style>
      </defs>

      {connections.map((conn, i) => {
        const isVert = Math.abs(conn.fromPos.x - conn.toPos.x) < 50
        const path = isVert ? getVertPath(conn.fromPos, conn.toPos) : getPath(conn.fromPos, conn.toPos)
        const midX = isVert
          ? conn.fromPos.x + CARD_W / 2
          : (conn.fromPos.x + CARD_W + conn.toPos.x) / 2
        const midY = isVert
          ? (conn.fromPos.y + CARD_H + conn.toPos.y) / 2
          : (conn.fromPos.y + CARD_H / 2 + conn.toPos.y + CARD_H / 2) / 2

        const strokeColor = conn.status === 'active' ? '#B8FF00' : conn.status === 'complete' ? '#22C55E' : conn.status === 'error' ? '#EF4444' : '#E5E7EB'
        const strokeW = conn.status === 'active' ? 2.5 : 2
        const markerEnd = conn.status === 'active' ? 'url(#arrow-active)' : conn.status === 'complete' ? 'url(#arrow-complete)' : 'url(#arrow)'

        return (
          <g key={i}>
            {/* Base line */}
            <path d={path} fill="none" stroke={strokeColor} strokeWidth={strokeW} markerEnd={markerEnd} />
            {/* Animated dash for active */}
            {conn.status === 'active' && (
              <path d={path} fill="none" stroke="#B8FF00" strokeWidth={2.5}
                strokeDasharray="8 8" className="flow-line" />
            )}
            {/* Label pill */}
            {conn.label && (
              <g transform={`translate(${midX - 30}, ${midY - 9})`}>
                <rect x={0} y={0} width={60} height={18} rx={9} fill="white" stroke="#E5E7EB" strokeWidth={1} />
                <text x={30} y={12} textAnchor="middle" fontSize={8} fill="#9CA3AF" fontFamily="monospace">{conn.label.slice(0, 10)}</text>
              </g>
            )}
            {/* Traveling dot for active */}
            {conn.status === 'active' && (
              <circle r={5} fill="#B8FF00">
                <animateMotion dur="1.5s" repeatCount="indefinite" path={path} />
              </circle>
            )}
          </g>
        )
      })}
    </svg>
  )
}
