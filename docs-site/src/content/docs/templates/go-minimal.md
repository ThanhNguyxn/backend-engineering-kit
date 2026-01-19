---
title: Go Minimal
description: Minimal Go HTTP server using standard library
---

# Go Minimal Template

Minimal Go HTTP server using only the standard library. No dependencies, fast compile times.

## Overview

| Property | Value |
|----------|-------|
| **ID** | `go-minimal` |
| **Stack** | Go |
| **Level** | Minimal |
| **Tags** | go, stdlib |

## Prerequisites

- Go >= 1.22

## Quick Start

```bash
# Create a new project
bek init go-minimal --name my-api

# Navigate to project
cd my-api

# Run directly
go run cmd/main.go

# Or build and run
go build -o my-api cmd/main.go
./my-api

# Server runs at http://localhost:8080
```

## Project Structure

```
my-api/
├── go.mod
└── cmd/
    └── main.go
```

## Features

### Standard Library Only

No external dependencies - just Go's powerful standard library.

```go
package main

import (
    "encoding/json"
    "log"
    "net/http"
)

func main() {
    http.HandleFunc("/health", healthHandler)
    log.Println("Starting server on :8080")
    log.Fatal(http.ListenAndServe(":8080", nil))
}
```

### JSON Responses

Built-in JSON encoding.

```go
type HealthResponse struct {
    Status    string    `json:"status"`
    Timestamp time.Time `json:"timestamp"`
    Version   string    `json:"version"`
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(HealthResponse{
        Status:    "ok",
        Timestamp: time.Now(),
        Version:   "0.1.0",
    })
}
```

### Environment Configuration

Port from environment variable.

```go
port := os.Getenv("PORT")
if port == "" {
    port = "8080"
}
```

## Scripts

```bash
# Run directly
go run cmd/main.go

# Build
go build -o my-api cmd/main.go

# Build with optimizations
go build -ldflags="-s -w" -o my-api cmd/main.go

# Run tests
go test ./...

# Format code
go fmt ./...

# Lint (requires golangci-lint)
golangci-lint run
```

## Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Welcome message |
| `GET /health` | Health check |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Server port |

## Next Steps

After scaffolding, consider adding:

1. **Router** - gorilla/mux or chi for better routing
2. **Middleware** - Logging, authentication
3. **Database** - pgx for PostgreSQL
4. **Configuration** - viper or envconfig
5. **Testing** - httptest for integration tests
