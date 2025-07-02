# Normalized Complex Database Model (Work in Progress)

This directory contains database record classes that represent a more normalized and complex database schema than what is currently implemented in the HTTP Cache Store.

## Overview

The current HTTP Cache Store implementation uses a simplified schema with just two main tables:
- `cache_entries` - for storing request/response metadata
- `bodies` - for storing the actual content

In contrast, the classes in this directory were designed for a more normalized database model with multiple related tables:
- URL records
- Request records
- Response records
- Headers
- Compression process records
- Body records
- Cache validation records

## Current Implementation Status

**Note: Currently, only a simpler adapter is implemented.** 

The active codebase uses a more straightforward approach with direct SQL queries in JavaScript functions rather than using these object-relational mapping classes. This approach has several advantages:

1. **Simplicity**: The two-table schema is easier to understand and maintain
2. **Performance**: Fewer joins may result in better performance for typical caching scenarios
3. **Direct Control**: SQL queries in JS functions provide precise control over database operations

These record classes are not currently used in the codebase, but they're preserved for future reference or implementation.

## Purpose

These classes are preserved for reference and potential future use. They demonstrate a more normalized approach to the database design that could be beneficial for:
- Reducing data duplication
- More efficient storage of headers
- Better relationship tracking between requests and responses
- More advanced cache validation

## Implementation Notes

The HTTP_Cache_Store_DB_Adapter is designed to be an interchangeable part of the system. This means that a more complex implementation could be created without changing the rest of the codebase.

If implemented, these record classes would work with the more complex schema defined in the `schema_common.sql` file in this directory, rather than the simplified schema currently in use.

A future implementation using this more normalized model could replace the current adapter while maintaining the same API contract, potentially offering better scalability or more advanced features for complex caching scenarios.