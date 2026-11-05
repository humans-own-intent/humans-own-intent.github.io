/**
 * sample-data.js - Comprehensive Sample Mindmap
 * Demonstrates multiple hierarchy levels, notes, tags, statuses, and custom key-value attributes.
 */

export const SAMPLE_MINDMAP = {
  title: "Cloud Infrastructure Architecture",
  description: "High-level overview of multi-region cloud deployment and microservices strategy.",
  status: "active",
  tags: ["architecture", "cloud", "production", "2026"],
  owner: "Platform Architecture Team",
  docUrl: "https://example.com/docs/cloud-architecture",
  subtopics: [
    {
      title: "Edge & Networking",
      notes: "Global CDN, DNS failover, and DDoS mitigation layer.",
      status: "in-progress",
      tags: ["network", "security", "cdn"],
      priority: "critical",
      subtopics: [
        {
          title: "Cloudflare Anycast CDN",
          description: "Global routing edge caching static assets and terminating TLS 1.3.",
          status: "completed",
          tags: ["edge", "cdn", "tls"],
          cacheHitRatio: "94.2%",
          latencyP99: "18ms"
        },
        {
          title: "API Gateway (Kong)",
          notes: "Reverse proxy for rate limiting, JWT validation, and canary routing.",
          status: "in-progress",
          tags: ["gateway", "auth"],
          rateLimit: "10,000 req/min per tenant",
          assignee: "Alex Rivera"
        },
        {
          title: "Geo-DNS Routing",
          description: "Latency-based DNS routing with health-check automatic failover between primary and secondary regions.",
          status: "planned",
          tags: ["dns", "resilience"],
          dnsTtlSeconds: 60
        }
      ]
    },
    {
      title: "Microservices Tier",
      notes: "Containerized workload services running on managed Kubernetes clusters.",
      status: "completed",
      tags: ["kubernetes", "docker", "services"],
      clusterVersion: "v1.30.2",
      subtopics: [
        {
          title: "Identity & Access (Auth)",
          description: "OAuth2 / OIDC provider with biometric MFA support and session token revocation.",
          status: "completed",
          tags: ["security", "auth", "oauth2"],
          mfaEnforced: true,
          tokenExpiryHours: 12
        },
        {
          title: "Order Processing Engine",
          notes: "Event-driven workflow managing checkout, inventory reservations, and payment charging.",
          status: "in-progress",
          tags: ["orders", "events", "kafka"],
          throughputTps: 3500,
          leadDev: "Maya Chen"
        },
        {
          title: "Recommendation Service",
          description: "Machine learning model serving real-time personalized product affinities.",
          status: "planned",
          tags: ["ai", "ml", "inference"],
          modelFramework: "ONNX Runtime",
          gpuAccelerated: true
        }
      ]
    },
    {
      title: "Data Persistence",
      notes: "Distributed relational, document, and memory cache stores.",
      status: "active",
      tags: ["database", "storage", "sql"],
      subtopics: [
        {
          title: "CockroachDB Cluster",
          description: "Multi-master distributed SQL database with ACID guarantees across 3 availability zones.",
          status: "completed",
          tags: ["sql", "acid", "distributed"],
          nodeCount: 9,
          storageGb: 4500,
          backupSchedule: "Hourly WAL + Daily Snapshot"
        },
        {
          title: "Redis Cluster (Cache)",
          notes: "In-memory caching layer with read-replicas for session states and hot product catalogs.",
          status: "completed",
          tags: ["cache", "memory", "redis"],
          maxMemoryGb: 128,
          evictionPolicy: "volatile-lru"
        },
        {
          title: "Event Store (Apache Kafka)",
          description: "Append-only distributed event stream backing the event-sourcing architecture.",
          status: "in-progress",
          tags: ["events", "streaming", "kafka"],
          retentionDays: 30,
          partitionCount: 32
        }
      ]
    },
    {
      title: "Observability & SRE",
      notes: "Metrics, structured distributed tracing, continuous profiling, and alerting.",
      status: "planned",
      tags: ["monitoring", "telemetry", "tracing"],
      subtopics: [
        {
          title: "OpenTelemetry Collector",
          description: "Unified telemetry agent capturing OTLP traces and exporting to ClickHouse and Jaeger.",
          status: "in-progress",
          tags: ["opentelemetry", "traces"],
          samplingRate: "10%"
        },
        {
          title: "Prometheus & Grafana",
          notes: "Time-series monitoring dashboards with PagerDuty escalation integrations.",
          status: "completed",
          tags: ["metrics", "alerts"],
          retentionDays: 90
        },
        {
          title: "SLO & Error Budgets",
          description: "Service Level Objectives enforcing 99.95% availability for tier-1 customer endpoints.",
          status: "active",
          tags: ["sre", "slo", "budget"],
          targetUptime: "99.95%"
        }
      ]
    }
  ]
};
