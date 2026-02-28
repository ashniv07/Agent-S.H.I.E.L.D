# agent S.H.I.E.L.D

Real-time AI governance and security layer using LangGraph multi-agent architecture with Anthropic Claude.

## Features

- **Multi-Agent Pipeline**: Orchestrator, Worker Monitor, Error Analyzer, Severity Classifier, and Fix Proposer agents
- **Real-time Monitoring**: WebSocket-based live updates
- **Kill Switch**: Immediate agent blocking capabilities
- **Audit Trail**: Complete logging of all decisions with reasoning chains
- **Policy Enforcement**: Rule-based and LLM-based violation detection

## Quick Start

### Prerequisites

- Node.js 18+
- Anthropic API Key

### Installation

```bash
# Install backend dependencies
npm install


```

### Configuration

Create a `.env` file in the root directory:

```env
ANTHROPIC_API_KEY=your-api-key-here
PORT=3001
HOST=localhost
DATABASE_PATH=./data/watchdog.db
NODE_ENV=development
```

### Running

```bash
# Terminal 1: Start the backend
npm run dev

```

- Backend: http://localhost:3001


## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/requests` | Submit request for analysis |
| GET | `/api/requests` | List all requests |
| GET | `/api/requests/:id` | Get specific request |
| GET | `/api/audit` | Get audit logs |
| GET | `/api/audit/stats/summary` | Get statistics |
| GET | `/api/agents` | List all agents |
| POST | `/api/agents/:id/killswitch` | Trigger kill switch |
| POST | `/api/agents/:id/restore` | Restore agent |

## Testing

```bash
# Test a request
curl -X POST http://localhost:3001/api/requests \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "agent-1",
    "action": "read_file",
    "target": "/etc/passwd",
    "context": "User requested system info"
  }'
```

## Architecture

```
Incoming Request
       │
       ▼
┌──────────────┐
│ Orchestrator │ ──▶ Initial assessment & routing
└──────────────┘
       │
       ▼
┌──────────────┐
│Worker Monitor│ ──▶ Deep inspection & intent analysis
└──────────────┘
       │
       ▼
┌──────────────┐
│Error Analyzer│ ──▶ Violation detection
└──────────────┘
       │
       ▼
┌────────────────┐
│Severity Classifier│ ──▶ Risk assessment
└────────────────┘
       │
       ▼
┌────────────────┐
│ Fix Proposer   │ ──▶ Remediation suggestions
└────────────────┘
       │
       ▼
┌────────────────┐
│Decision Engine │ ──▶ APPROVE / FLAG / KILL
└────────────────┘
```

## License

MIT
