# HTTP Cache Store Database Schema

## Overview

HTTP Cache Store uses a relational database schema with two primary tables:

1. **cache_entries**: Stores request and response metadata as cache entries
2. **bodies**: Stores the actual content of requests and responses

This design separates metadata from content, allowing for efficient storage, lookups, and potential content deduplication.

## Schema Diagram

