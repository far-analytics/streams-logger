# Changelog

All breaking changes to this project will be documented in this file.

This project adheres to Semantic Versioning.

## [3.0.0] 2025-12-28

- `LogContext` is now an interface instead of a class.
- Changes were made to stack trace parsing in order to make the implementation less brittle and more performant. Please see [Log context properties](https://github.com/far-analytics/streams-logger?tab=readme-ov-file#log-context-properties) for the currently supported properties.
- The `LogContext` object now contains a `location` property which may contain the path portion of the stack trace line. You can optionally parse this string in your formatter and add the selected path segments to your logged message.

## [2.0.0] 2025-12-21

- A root logger is no longer attached to each `Logger` instance by default. Please see the documentation on how to implement hierarchical logging.
