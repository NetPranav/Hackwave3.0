# Advantages, disadvantages and trade-offs

## 1. Advantages of our approach

| Advantage | Why it matters |
|---|---|
| **Sees real behaviour, not a synthetic request** | Production traffic covers real parameters, real accounts and real edge cases that a single poll never hits |
| **Catches silent behavioural and semantic drift** | That's where the documented silent cases are (Pipedrive, Lightspeed, IRIS, Jira `=`); structural-only tools miss them |
| **Code-aware severity = low alert fatigue** | Alerts only when a changed field is used, weighted by how it's used. Teams mute noisy monitors; this one earns attention |
| **Fixes, not just alerts** | A reviewable PR in an adapter file; the fix ladder keeps risky changes with humans |
| **Safe by construction** | Read-only, fail-open, not in the request path; fallbacks can't make things worse |
| **Privacy-preserving** | Shape-only telemetry passes security reviews that payload-recording tools struggle with |
| **GitHub-native** | Login, install, PRs and CI are where developers already work; nothing new to learn |
| **Value on day one without production access** | The repo scan alone gives an API dependency map |
| **Gets better with scale** | Drift network: more customers → earlier warnings → better data |
| **Proactive add-ons** | Changelog/deprecation radar turns prose notices into PRs before changes land |

## 2. Disadvantages and honest limitations

| Limitation | Impact | Mitigation |
|---|---|---|
| **Basic drift monitoring is crowded and cheap** ($12–$149/mo pollers) | Price pressure; "isn't this X?" questions | Lead with semantic/behavioural detection, code awareness and PRs; offer a generous free tier |
| **Drift is infrequent for many teams** (almost half of Postman 2019 respondents said breakage isn't frequent enough to matter) | Insurance-like value is hard to sell | Pair with daily-use value: dependency map, deprecation radar, rate-limit forecasts, compliance map |
| **Needs an SDK in production** | Install friction; security review; one SDK per language | GitHub-only mode (no SDK) for first value; probes-only mode; open-source SDK; fail-open guarantees |
| **Low-traffic endpoints have little data** | Slower or less confident detection | Probes; confidence capped until enough samples |
| **Static code mapping is incomplete** in dynamic languages | Missed or wrong impact | Show coverage; LLM-assisted extraction marked "inferred"; runtime call-site join |
| **Statistical detectors can false-alarm** (seasonal prices, A/B tests, gradual rollouts) | Trust loss | Confirmation probes; power-of-ten rule for units; bimodal detection for rollouts; amber before red |
| **Some drift can't be fixed by an adapter** (pagination, rate limits, removed endpoints) | Less "magic" | Rung 3: clear explanation + suggested code change; still saves the diagnosis time |
| **Request-side changes** (provider now requires a new field) | We see the resulting 4xx, not the requirement | Error-shape detector + changelog radar; rung 3 only |
| **Incumbents could add parts of this** (Datadog, Postman, Lunar.dev) | Competitive risk | Speed, focus, network data; integration/partnership path |
| **Cold start for the drift network** | Network value needs many customers | Public drift feed + probes on popular public APIs seed it before customers do |
| **Hackathon scope** | Real-world complexity (auth, many languages) is beyond 10 days | Fake services with v2 switches; Node-only SDK; honest roadmap slide |

## 3. Design trade-offs

### 3.1 Capture method

| | SDK (chosen) | Proxy | Polling | eBPF |
|---|---|---|---|---|
| Real traffic | ✅ | ✅ | ❌ | ✅ |
| Risk to the app | Very low (fail-open, off hot path) | **High** (in request path) | None | Low–medium |
| Install effort | 1 line per service | Infra + config | URL + credentials | Root/DaemonSet |
| TLS | Not an issue | Base-URL swap or interception | Not an issue | Uprobes, complex |
| Language support | One SDK per language | Any | Any | Any (Linux) |
| Security review | Easy if open-source + shape-only | Hard | Easy | Hard |
| Verdict | **Primary** | No | **Secondary** (probes) | Enterprise roadmap |

### 3.2 Where the fix lives

| | Code PR (chosen) | Runtime rewrite in a proxy |
|---|---|---|
| Visibility | Reviewed, versioned in git | Hidden "magic" |
| Speed | Needs merge + deploy | Instant |
| Reversibility | Revert PR | Toggle rule |
| Trust from judges/teams | High (Dependabot-like) | Lower |
| Fits "no proxy in request path" | ✅ | ❌ |
| Verdict | **Primary** | Possible "emergency hotfix" mode later, opt-in |

### 3.3 Tolerant Reader fallbacks

| Pros | Cons |
|---|---|
| A wrong guess can't break anything; enables safe auto-fix | Fallbacks accumulate (debt) → cleanup PRs |
| Survives gradual rollouts (both fields work) | Doesn't solve meaning changes (no second field) → transforms |
| Simple to review | Falsy-value bugs if implemented with `||` → `firstPresent` helper |

### 3.4 LLM usage

| Pros | Cons |
|---|---|
| Great explanations; classifies ambiguous enum values; extracts dynamic code | Non-deterministic; can hallucinate; cost/latency |
| | Mitigation: never used for detection or auto-merge decisions; JSON schema outputs; invalid output → review; sees statistics and code, never raw data |

## 4. Risk register (hackathon)

| Risk | Probability | Impact | Mitigation | Owner |
|---|---|---|---|---|
| Live demo fails | Medium | Critical | Docker Compose offline setup; seed script; recorded backup video (day 10) | Whole team |
| GitHub webhooks unreachable at venue | Medium | High | `smee.io` tunnel + pre-opened PRs as fallback; local git mode | Backend |
| LLM API slow/down during demo | Medium | Medium | Cache explanations for demo scenarios; template fallback text | Backend |
| Scope creep (too many add-ons) | High | High | Freeze scope on day 6; add-ons limited to 2 | Lead |
| Graph looks cluttered | Medium | Medium | Filter to one repo; hide unused fields by default; React Flow chain for detail | Frontend |
| False positive during demo | Low | High | 10-minute soak test on "normal" scenario before presenting | Backend |
| Judges ask "isn't this FlareCanary?" | High | Medium | Prepared answer in [competitors.md](competitors.md) §4 | Presenter |

## 5. SWOT

| **Strengths** | **Weaknesses** |
|---|---|
| Real-traffic, semantic/behavioural detection; code-aware severity; fix PRs; privacy design; GitHub-native | Needs SDK for full value; static analysis limits; drift infrequent for some teams; small team |
| **Opportunities** | **Threats** |
| Crowded low end proves demand; AI/MCP integrations multiply dependencies; DPDP/compliance data-flow mapping; nobody has drift-frequency data (network effect); acquisition appetite (Akita, Optic, Moesif, Noname deals) | Incumbents (Datadog, Postman, Lunar.dev) extending; cheap pollers anchoring price expectations; privacy perception of any production SDK |
