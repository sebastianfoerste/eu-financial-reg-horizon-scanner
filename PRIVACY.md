# Privacy Notes

## Data Processed

The horizon scanner may process public regulator publication metadata, parsed source paragraphs, taxonomy classifications, product-map mappings, matter signals, reviewer decisions, alert drafts, recipient metadata and delivery audit records.

## Demo Boundary

Dry-run and fixture demos should use public-source style publications and synthetic product-map data only. Do not use real client product maps, confidential implementation notes or personal recipient lists in screenshots.

## External Processing

Public regulator text may be classified by configured providers only after provider approval. Client-specific product maps and matter facts stay local.

## Retention

Persistent mode stores records in Postgres. Before sharing demos, clear local databases or use fixture-only dry runs.

## Human Review

Alerts remain drafts until a reviewer approves the alert proof packet and delivery checks. The app does not issue legal advice or send external updates autonomously.
