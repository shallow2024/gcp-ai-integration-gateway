# Security Design

## Purpose

This gateway separates client-facing application code from the credentials and network authority needed to invoke Gemini on Vertex AI. Its primary security boundary is **between an untrusted or less-trusted calling application and the cloud AI provider**.

## Identity model

Local development uses **Application Default Credentials (ADC)** created by `gcloud auth application-default login`. A deployed workload should use an attached, dedicated service account with the narrowest practical permissions, such as the Vertex AI User role (`roles/aiplatform.user`). The gateway does not load API keys, service-account JSON values, or credential file paths from its configuration.

Client identity is intentionally outside this small demo. `X-Client-Id` only creates independent rate-limit buckets. It is not proof of identity and must be replaced or protected by an upstream identity-aware proxy, API gateway, mTLS, OAuth access-token validation, or another enterprise authentication mechanism before public deployment.

## Data-handling policy

Incoming payloads are size-limited and validated. Before provider invocation, the gateway rejects values matching common private-key, API-key, OAuth-token, authorization-header, password, or secret patterns. This is an intentionally conservative first-line control, not a full data-loss-prevention system. Production workloads should complement it with data classification, organization-specific detection rules, consent controls, and audit requirements.

The structured success log records request ID, client quota key, prompt length, provider, and model. It intentionally excludes raw prompts and model outputs. The mock adapter is the default configuration and does not send any request data outside the local process.

## Resiliency policy

The Vertex adapter retries only transient provider failures: timeouts, rate limits, and temporary service failures. The retry schedule uses capped exponential backoff with jitter. Validation and other non-transient client errors are not retried. When all attempts fail, the API returns a documented `503 AI_SERVICE_UNAVAILABLE` response and explicitly states that no generated content was returned.

## Non-goals

This sample does not claim to be a complete enterprise perimeter. It does not provide client authentication, persistent distributed rate-limit storage, organization-specific DLP, tenant authorization, request signing, SIEM export, or deployment infrastructure. The README identifies the next controls required before a production rollout.

## References

[1]: https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/start/gcp-auth "Configure Application Default Credentials for Gemini on Vertex AI"
[2]: https://docs.cloud.google.com/iam/docs/roles-permissions/aiplatform "Gemini Enterprise Agent Platform roles and permissions"
