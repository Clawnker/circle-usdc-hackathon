# Hivemind Protocol - Product Roadmap

## Vision
**"Where agents find agents."** - The orchestration layer for autonomous agent economies.

---

## Phase 1: MVP (Hackathon Demo) 🎯
**Deadline: Feb 12, 2026**

| Feature | Status | Owner | Notes |
|---------|--------|-------|-------|
| Core dispatcher + 3 specialists | ✅ Done | Codex | magos, aura, bankr |
| x402 payment flow (demo) | ✅ Done | Codex | Fee logging in messages |
| Pricing UI before dispatch | ✅ Done | dev-pricing-ui | CostPreview component |
| Basic reputation (success rate) | ✅ Done | dev-reputation | Persisted, API exposed |
| Improved routing logic | ✅ Done | Codex | Context-aware routing |
| Automated test suite | ✅ Done | QA | 17 tests passing |
| Frontend polish | 🔄 In Progress | - | Balance display, animations |
| README.md for judges | ⏳ Pending | PM | Critical for submission |
| Demo video | ⏳ Pending | - | "One prompt. A thousand minds." |

---

## Phase 2: Post-Hackathon (Feb-Mar 2026)

### Agent Registry & Discovery
| Feature | Priority | Description |
|---------|----------|-------------|
| skill.md v2 schema | P1 | Add pricing, reputation, endpoint fields |
| `/v1/registry/search` API | P1 | Filter by capability, reputation, price |
| Marketplace UI | P1 | Browse/discover specialists |
| Agent self-registration | P2 | Providers submit their own agents |

### Enhanced Reputation
| Feature | Priority | Description |
|---------|----------|-------------|
| On-chain reputation staking | P1 | Stake SOL/USDC to become "Verified" |
| Slashing for failures | P2 | Provable failures lose stake |
| Agent-to-agent vouching | P2 | Reputation graph (PageRank-style) |
| User ratings & reviews | P2 | Post-task feedback |

### OpenClaw Integration
| Feature | Priority | Description |
|---------|----------|-------------|
| Model preference header | P1 | `X-OpenClaw-Model-Preference` |
| Use user's API keys | P2 | Reduce x402 cost, privacy-preserving |
| openclaw.json integration | P2 | Seamless local-first orchestration |

---

## Phase 3: Production (Q2 2026)

### Security & Privacy
| Feature | Priority | Description |
|---------|----------|-------------|
| IP protection (hosted execution) | P1 | Prompts never leave provider |
| TEE execution option | P2 | Verifiable privacy for premium agents |
| Encrypted prompt marketplace | P3 | Licensing for agent IP |

### Economic Layer
| Feature | Priority | Description |
|---------|----------|-------------|
| Real x402 payments on mainnet | P1 | Not just demo/devnet |
| Protocol fee (0.1-0.5%) | P1 | Revenue model |
| Dispute resolution | P2 | Challenge results, refunds |
| Max budget per task | P2 | User spending limits |
| DCA / recurring tasks | P3 | Scheduled agent workflows |

### Scale & Performance
| Feature | Priority | Description |
|---------|----------|-------------|
| Redis task persistence | P1 | Replace JSON files |
| WebSocket scaling | P2 | Multiple backend instances |
| Rate limiting | P2 | Prevent abuse |
| Caching layer | P3 | Reduce redundant specialist calls |

---

## Phase 4: Ecosystem (Q3-Q4 2026)

### Developer Experience
- SDK for building specialists
- CLI for agent registration
- Testing framework for specialists
- Documentation & tutorials

### Network Effects
- Agent referral program
- Featured specialists
- Specialist categories/tags
- Cross-chain support (Base, Ethereum)

### Advanced Orchestration
- Multi-step workflows
- Conditional routing
- Parallel specialist execution
- Result aggregation strategies

---

## Success Metrics

### Hackathon (Feb 12)
- [ ] Working demo with all 3 specialists
- [ ] x402 payments visible in UI
- [ ] Compelling README + demo video
- [ ] Judge-ready presentation

### Post-Launch (Mar 2026)
- [ ] 10+ registered specialists
- [ ] 100+ tasks processed
- [ ] $10+ in x402 volume

### Scale (Q3 2026)
- [ ] 100+ specialists
- [ ] 10,000+ tasks/month
- [ ] $1,000+ monthly x402 volume

---

## Key Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-04 | Hybrid hosting model | Self-host dispatcher, marketplace for specialists |
| 2026-02-04 | skill.md as registry standard | Like package.json for agents |
| 2026-02-04 | Hosted execution for IP protection | Prompts stay on provider's infra |
| 2026-02-04 | Protocol fee 0.1-0.5% | Sustainable revenue, scales with usage |

---

*Last updated: 2026-02-04 20:01 EST*
