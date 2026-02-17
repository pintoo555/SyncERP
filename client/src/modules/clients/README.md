# Client Module

The Client module manages client master records, addresses, contacts, groups, relationships, and provides a unified Client 360 view.

## Table of Contents
- [Client Rename / Legal Name Change](#client-rename--legal-name-change)
- [Soft Merge](#soft-merge)
- [Group Companies](#group-companies)
- [Contact Replacement](#contact-replacement)
- [Duplicate Detection](#duplicate-detection)
- [Client 360 View](#client-360-view)
- [API Endpoints](#api-endpoints)
- [Database Tables](#database-tables)
- [Permissions](#permissions)

---

## Client Rename / Legal Name Change

When a client changes their legal name, we **never overwrite** the old record. Instead:

1. Create a **new client record** with the new legal name (gets a new `ClientCode`).
2. Create a **relationship** between old and new:
   - Old Client -> `RelationshipType: RenamedTo` -> New Client
   - (Optionally) New Client -> `RelationshipType: RenamedFrom` -> Old Client
3. The old client record is preserved with its full history intact.

**API**: `POST /api/clients/:id/link`
```json
{
  "otherClientId": 456,
  "relationshipType": "RenamedTo",
  "effectiveFrom": "2025-04-01",
  "remarks": "Legal name change per ROC filing"
}
```

The `/aliases` endpoint returns the full rename/merge chain for any client.

---

## Soft Merge

When two client records need to be consolidated (e.g., discovered to be the same entity):

1. **Source client** is marked: `IsMerged = 1`, `MergedIntoClientId = targetId`, `IsActive = 0`
2. A **MergedWith relationship** is created.
3. No data (job cards, invoices, etc.) is physically moved.
4. Other modules should call `getEffectiveClientId(clientId)` to resolve merged chains.

**API**: `POST /api/clients/:sourceId/merge`
```json
{
  "targetClientId": 789,
  "remarks": "Duplicate record consolidation"
}
```

**getEffectiveClientId** follows the `MergedIntoClientId` chain to find the ultimate active client. This handles multi-hop merges (A -> B -> C returns C).

The Client 360 view can include merged-from clients when `?includeMerged=1` is set.

---

## Group Companies

Groups represent holding companies, conglomerates, or related business entities.

### Creating a Group
- Groups get auto-generated codes: `CG000001`, `CG000002`, etc.
- Each group can have an optional industry classification.

### Members
- Each member has a **role**: Parent, Subsidiary, Branch, Other
- A client can belong to multiple groups.
- Members are soft-deactivated (never deleted).

### Combined View
- `GET /api/clients/360/by-group/:groupId` returns:
  - All member clients
  - Combined (deduplicated) contacts across all members
  - Combined addresses across all members
  - Placeholder arrays for financial/repair history (for future integration)

---

## Contact Replacement

When a contact person leaves or changes role:

1. **Deactivate** the contact: `IsActive = 0`, `InactiveDate = now`
2. **Set replacement**: `ReplacedByContactId` points to the successor
3. **Primary promotion**: If the deactivated contact was `IsPrimary = 1`:
   - A replacement **must** be selected
   - The replacement is automatically promoted to primary

### Suggestion API
`GET /api/clients/:id/contacts/suggest-replacement/:contactId`

Returns active contacts from the same client, ranked by:
1. Same department AND designation (best match)
2. Same department (good match)
3. Same designation (partial match)
4. Other contacts (fallback)

---

## Duplicate Detection

Runs automatically on client creation (and optionally on update). Checks:

### 1. GST Number (Exact Match)
- If the provided GST number matches an existing active client, flagged immediately.

### 2. Client Name (Token Similarity)
- Names are normalized: lowercased, non-alphanumeric removed, tokenized.
- Jaccard-like similarity is computed (intersection / union of tokens).
- Threshold: 70% similarity triggers a warning.

### 3. Contact Cross-Match
- Mobile numbers and email addresses from the new client's contacts are checked against all existing client contacts.

### Response Flow
- If duplicates are found and `confirmDuplicate` is not set, API returns **409** with:
  ```json
  {
    "success": false,
    "error": "Potential duplicates found",
    "potentialDuplicates": [
      { "clientId": 1, "clientCode": "CL000001", "clientName": "...", "matchType": "GST", "matchDetail": "..." }
    ]
  }
  ```
- The UI shows a warning modal. User can "Confirm Create Anyway" which re-submits with `confirmDuplicate: true`.

---

## Client 360 View

Unified view of all client data, accessible at:
- `GET /api/clients/360/by-client/:id?includeMerged=1&includeGroup=1`
- `GET /api/clients/360/by-group/:groupId`

### By Client
Returns:
- Client details with industry join
- All addresses (with state/country names)
- All contacts (with replacement chain)
- All relationships (rename, merge, subsidiary, etc.)
- Group memberships
- Merged-from clients (if `includeMerged=1`)
- Combined group data (if `includeGroup=1`)

### Contact Deduplication
When combining contacts from multiple sources (merged/group), duplicates are removed by:
- Mobile number match
- Email match
Priority: primary contacts first, then active, then by ID.

---

## API Endpoints

### Clients
| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | /api/clients | CLIENT.VIEW | List with search/filters/pagination |
| POST | /api/clients | CLIENT.CREATE | Create (with duplicate check) |
| GET | /api/clients/:id | CLIENT.VIEW | Get details + addresses + contacts |
| PUT | /api/clients/:id | CLIENT.EDIT | Update client |
| PATCH | /api/clients/:id/status | CLIENT.EDIT | Activate/deactivate/blacklist |
| POST | /api/clients/:id/merge | CLIENT.MERGE | Merge into target |
| POST | /api/clients/:id/link | CLIENT.EDIT | Create relationship |
| GET | /api/clients/:id/aliases | CLIENT.VIEW | Get rename/merge history |

### Client 360
| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | /api/clients/360/by-client/:id | CLIENT.360.VIEW | Full client 360 |
| GET | /api/clients/360/by-group/:groupId | CLIENT.360.VIEW | Group 360 view |

### Addresses
| Method | Endpoint | Permission |
|--------|----------|------------|
| GET | /api/clients/:id/addresses | CLIENT.VIEW |
| POST | /api/clients/:id/addresses | CLIENT.EDIT |
| PUT | /api/clients/:id/addresses/:addrId | CLIENT.EDIT |
| PATCH | /api/clients/:id/addresses/:addrId/status | CLIENT.EDIT |

### Contacts
| Method | Endpoint | Permission |
|--------|----------|------------|
| GET | /api/clients/:id/contacts | CLIENT.VIEW |
| POST | /api/clients/:id/contacts | CLIENT.EDIT |
| PUT | /api/clients/:id/contacts/:contactId | CLIENT.EDIT |
| POST | /api/clients/:id/contacts/:contactId/deactivate | CLIENT.EDIT |
| GET | /api/clients/:id/contacts/suggest-replacement/:contactId | CLIENT.VIEW |

### Groups
| Method | Endpoint | Permission |
|--------|----------|------------|
| GET | /api/clients/groups | CLIENT.GROUP.VIEW |
| POST | /api/clients/groups | CLIENT.GROUP.EDIT |
| GET | /api/clients/groups/:groupId | CLIENT.GROUP.VIEW |
| POST | /api/clients/groups/:groupId/members | CLIENT.GROUP.EDIT |
| PATCH | /api/clients/groups/:groupId/members/:memberId/status | CLIENT.GROUP.EDIT |

### Industries
| Method | Endpoint | Permission |
|--------|----------|------------|
| GET | /api/industries | CLIENT.INDUSTRY.VIEW |
| POST | /api/industries | CLIENT.INDUSTRY.EDIT |
| PUT | /api/industries/:id | CLIENT.INDUSTRY.EDIT |
| PATCH | /api/industries/:id/status | CLIENT.INDUSTRY.EDIT |

---

## Database Tables

| Table | Description |
|-------|-------------|
| `utbl_Industry` | Industry master (Process, Heavy, Manufacturing, Govt, Other) |
| `utbl_Client` | Client master with merge support |
| `utbl_ClientAddress` | Multi-address per client |
| `utbl_ClientContact` | Multi-contact with replacement chain |
| `utbl_ClientGroup` | Group companies |
| `utbl_ClientGroupMember` | Group-to-client mapping with roles |
| `utbl_ClientRelationship` | Rename/merge/subsidiary relationships |

Sequences: `seq_ClientCode` (CL000001), `seq_ClientGroupCode` (CG000001)

---

## Permissions

| Code | Description |
|------|-------------|
| CLIENT.VIEW | View client list and details |
| CLIENT.CREATE | Create new clients |
| CLIENT.EDIT | Edit existing clients |
| CLIENT.DELETE | Soft-delete clients |
| CLIENT.MERGE | Merge client records |
| CLIENT.BLACKLIST | Toggle blacklist status |
| CLIENT.GROUP.VIEW | View client groups |
| CLIENT.GROUP.EDIT | Manage client groups |
| CLIENT.360.VIEW | Access Client 360 view |
| CLIENT.INDUSTRY.VIEW | View industry master |
| CLIENT.INDUSTRY.EDIT | Manage industry master |

All permissions are granted to the ADMIN role by default (migration 046).
