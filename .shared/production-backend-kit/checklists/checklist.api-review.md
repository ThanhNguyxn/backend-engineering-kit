---
id: checklist-api-review
title: API Review Checklist
description: Comprehensive checklist for reviewing REST API implementations
category: checklists
tags:
  - api
  - rest
  - review
  - quality
version: 1.0.0
scope: api
level: intermediate
maturity: stable
stacks:
  - all
---

# API Review Checklist

Use this checklist when reviewing API endpoints before deployment.

---

## 🎯 Design & Consistency

- [ ] Endpoint follows RESTful naming (`/users`, not `/getUsers`)
- [ ] HTTP methods match semantics (GET=read, POST=create, PUT=update, DELETE=remove)
- [ ] URL uses plural nouns for collections
- [ ] Nested resources max 2 levels deep
- [ ] Query parameters use consistent casing (snake_case or camelCase)

## 📥 Request Handling

- [ ] Request body schema defined and validated
- [ ] Required vs optional fields clearly documented
- [ ] Input validation runs before business logic
- [ ] File uploads sanitized and size-limited
- [ ] Content-Type header validated

## 📤 Response Handling

- [ ] Response follows standard JSON structure
- [ ] Correct HTTP status codes returned (2xx, 4xx, 5xx)
- [ ] Error responses include code, message, and request ID
- [ ] Empty arrays return `[]`, not `null`
- [ ] Dates use ISO 8601 format

## 📊 Pagination & Filtering

- [ ] List endpoints support pagination
- [ ] Maximum page size enforced (e.g., 100)
- [ ] Sorting on indexed columns only
- [ ] Total count provided (if performant)

## 📝 Documentation

- [ ] OpenAPI/Swagger spec updated
- [ ] Request/response examples provided
- [ ] Error codes documented

---

## Sources

- Google API Design Guide: https://cloud.google.com/apis/design
- Microsoft REST API Guidelines: https://github.com/microsoft/api-guidelines
- Zalando RESTful API Guidelines: https://opensource.zalando.com/restful-api-guidelines/
