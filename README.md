# logsentinel

Lightweight Express.js logging SDK that automatically captures requests, responses, and errors without slowing down your app.

## Installation

```bash
npm install logsentinel
```

## Quick Start

```javascript
import express from 'express';
import { setupLogsentinel } from 'logsentinel';

const app = express();

// Add body parsing middleware (required)
app.use(express.json());

// Setup logsentinel (one line)
setupLogsentinel(app);

// Your routes
app.get('/', (req, res) => {
  res.json({ message: 'Hello World' });
});

app.listen(3000);
```

## Configuration

Set these environment variables in your `.env` file:

```env
LOGSENTINEL_API_KEY=your_api_key_here
LOGSENTINEL_BASE_URL=https://your-server.com/logs
LOGSENTINEL_DEBUG=false
```

Or pass configuration explicitly:

```javascript
setupLogsentinel(app, {
  apiKey: 'your_api_key',
  baseUrl: 'https://your-server.com/logs',
  debug: true
});
```

## What Gets Captured

### Request Data
- HTTP method and URL
- Headers (sensitive data redacted)
- Query parameters
- Request body (sanitized, size-capped at 10KB)
- Client IP address

### Response Data
- Status code
- Headers (sensitive data redacted)
- Response body (sanitized, size-capped at 10KB)
- Content type

### Error Data
- Error message
- Stack trace
- Status code

### Metadata
- Timestamp
- Request duration
- Unique request ID

## Features

### Non-Blocking
Logs are queued and sent asynchronously. Your app never waits for log delivery.

### Automatic Batching
Logs are sent in batches of 50 or every 5 seconds (whichever comes first).

### Retry Logic
Failed requests are retried up to 3 times with exponential backoff.

### Sanitization
Sensitive data (passwords, tokens, API keys) is automatically redacted.

### Size Limits
Request and response bodies are capped at 10KB to prevent memory issues.

### Debug Mode
Enable debug mode to see all log operations in your console:

```env
LOGSENTINEL_DEBUG=true
```

### Graceful Shutdown
Remaining logs are flushed when your app shuts down.

## Security

The SDK automatically redacts sensitive fields including:
- Passwords
- Tokens
- API keys
- Authorization headers
- Credit card numbers
- Social security numbers

## Performance

- Zero blocking: All logging happens asynchronously
- Memory safe: Queue is capped at 1000 logs
- Minimal overhead: Only captures what's needed
- Circular reference handling: Safe JSON serialization

## License

MIT
