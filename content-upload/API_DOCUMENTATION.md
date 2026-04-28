# Content Upload Backend API Documentation

Base URL:

```text
http://localhost:3000
```

Base API prefix:

```text
/api
```

## Overview

This backend implements:

- JWT authentication for `teacher` and `principal`
- Teacher-only content upload and scheduling
- Principal-only approval and rejection workflows
- Public live content lookup by teacher and optional subject
- Pagination and filtering for content listing

## Common Conventions

### Authentication

Protected endpoints require:

```http
Authorization: Bearer <jwt-token>
```

If the token is missing or malformed, the API returns:

```json
{
  "success": false,
  "message": "Authentication required"
}
```

If the token is invalid or expired:

```json
{
  "success": false,
  "message": "Invalid or expired token"
}
```

### Success shape

Most successful responses follow this pattern:

```json
{
  "success": true,
  "message": "Optional message",
  "data": {}
}
```

List endpoints may also include:

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 4,
    "total_pages": 1
  }
}
```

### Error shape

Application errors:

```json
{
  "success": false,
  "message": "Human readable error",
  "details": {}
}
```

Unhandled server errors:

```json
{
  "success": false,
  "message": "Internal server error"
}
```

### Pagination defaults

- Default `page`: `1`
- Default `limit`: `10`
- Maximum `limit`: `100`
- Values below `1` are clamped upward

### Roles

- `teacher`
- `principal`

### Content statuses

- `pending`
- `approved`
- `rejected`

## 1. Health Check

### `GET /api/health`

Returns service health information.

Response:

```json
{
  "success": true,
  "message": "Service is healthy",
  "timestamp": "2026-04-28T10:30:00.000Z"
}
```

## 2. Auth APIs

### `POST /api/auth/register`

Registers a user and immediately returns a JWT.

Request body:

```json
{
  "name": "Teacher One",
  "email": "teacher1@example.com",
  "password": "Password123",
  "role": "teacher"
}
```

Validation rules:

- `name`: string, trimmed, min 2, max 120
- `email`: valid email, lowercased before storage
- `password`: string, min 8, max 72
- `role`: must resolve to either `teacher` or `principal`

Success response:

```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": 2,
      "name": "Teacher One",
      "email": "teacher1@example.com",
      "role": "teacher",
      "created_at": "2026-04-28T10:30:00.000Z"
    },
    "token": "jwt-token"
  }
}
```

Edge cases:

- Duplicate email returns `409` with `A user with this email already exists`
- Invalid payload returns `400` with flattened Zod errors in `details`
- Role values are normalized to lowercase
- Open registration is allowed for both teacher and principal roles

### `POST /api/auth/login`

Authenticates an existing user.

Request body:

```json
{
  "email": "teacher1@example.com",
  "password": "Password123"
}
```

Success response:

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 2,
      "name": "Teacher One",
      "email": "teacher1@example.com",
      "role": "teacher",
      "created_at": "2026-04-28T10:30:00.000Z"
    },
    "token": "jwt-token"
  }
}
```

Edge cases:

- Wrong email or password returns `401` with `Invalid email or password`
- Email is lowercased before lookup
- Invalid payload returns `400`

### `GET /api/auth/me`

Returns the currently authenticated user.

Headers:

```http
Authorization: Bearer <jwt-token>
```

Success response:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 2,
      "email": "teacher1@example.com",
      "role": "teacher"
    }
  }
}
```

Edge cases:

- Missing token returns `401`
- Invalid or expired token returns `401`

## 3. Teacher Content APIs

### `POST /api/content/upload`

Uploads image content and creates a `pending` content record.

Access:

- `teacher` only

Content type:

```text
multipart/form-data
```

Form fields:

- `title`: required
- `subject`: required
- `description`: optional
- `file`: required image file
- `start_time`: optional ISO datetime
- `end_time`: optional ISO datetime
- `rotation_duration_minutes`: optional positive integer
- `rotation_order`: optional positive integer as string or number-like form value

Example request fields:

```text
title=Math Practice Set
subject=maths
description=Chapter 5 worksheet
file=<image>
start_time=2026-04-27T09:00:00.000Z
end_time=2026-04-27T11:00:00.000Z
rotation_duration_minutes=5
rotation_order=1
```

Success response:

```json
{
  "success": true,
  "message": "Content uploaded successfully and sent for approval",
  "data": {
    "id": 10,
    "title": "Math Practice Set",
    "subject": "maths",
    "status": "pending",
    "file_url": "http://localhost:3000/uploads/1777300000000-file.png",
    "rotation_order": 1,
    "duration_minutes": 5
  }
}
```

Edge cases:

- Missing file returns `400` with `File is required`
- Only these MIME types are allowed:
  - `image/jpeg`
  - `image/jpg`
  - `image/png`
  - `image/gif`
- Unsupported file type returns `400` with `Only JPG, PNG, and GIF files are allowed`
- File size limit is controlled by `MAX_FILE_SIZE_MB` and defaults to `10 MB`
- `rotation_duration_minutes` in multipart requests may arrive as a string like `"5"` and is accepted
- If only one of `start_time` or `end_time` is provided, returns `400` with `Both start_time and end_time must be provided together`
- If `end_time <= start_time`, returns `400` with `end_time must be later than start_time`
- If schedule fields are provided, a subject slot and schedule row are created in the same transaction
- If schedule creation fails after file upload, the uploaded file is deleted from disk
- Uploaded content always starts as `pending`, not `approved`
- `subject` is normalized to lowercase before storage
- If `rotation_duration_minutes` is omitted but scheduling is provided, the backend uses `DEFAULT_ROTATION_DURATION_MINUTES` which defaults to `5`
- If `rotation_order` is omitted but scheduling is provided, the backend auto-assigns the next order for that subject slot

### `PATCH /api/content/:id/schedule`

Creates or updates a schedule for an existing content item.

Access:

- `teacher` only

Request body:

```json
{
  "start_time": "2026-04-27T09:00:00.000Z",
  "end_time": "2026-04-27T11:00:00.000Z",
  "rotation_duration_minutes": 5,
  "rotation_order": 1
}
```

Notes:

- `rotation_duration_minutes` may also be sent as a string like `"5"`
- `rotation_order` may also be sent as a string like `"1"`

Success response:

```json
{
  "success": true,
  "message": "Schedule updated successfully",
  "data": {
    "id": 10,
    "start_time": "2026-04-27T09:00:00.000Z",
    "end_time": "2026-04-27T11:00:00.000Z",
    "rotation_order": 1,
    "duration_minutes": 5
  }
}
```

Edge cases:

- Content not found returns `404` with `Content not found`
- A teacher can only schedule their own content; otherwise `403` with `You can only schedule your own content`
- Both `start_time` and `end_time` are required for scheduling
- Invalid ISO datetimes return `400`
- `end_time <= start_time` returns `400`
- If `rotation_duration_minutes` is omitted, the backend uses the default configured duration
- If `rotation_order` is omitted:
  - existing schedule keeps its current order
  - unscheduled content gets the next available subject order
- Scheduling does not automatically approve content

### `GET /api/content`

Lists content.

Access:

- `teacher`: only sees own content
- `principal`: can see all content unless filtered

Query params:

- `page`
- `limit`
- `subject`
- `status`
- `teacher_id`

Example:

```http
GET /api/content?page=1&limit=10&status=pending&subject=maths
```

Success response:

```json
{
  "success": true,
  "data": [
    {
      "id": 10,
      "title": "Math Practice Set",
      "subject": "maths",
      "status": "pending",
      "rotation_order": 1,
      "duration_minutes": 5
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "total_pages": 1
  }
}
```

Edge cases:

- Teacher requests ignore cross-user access and are always restricted to the authenticated teacher’s own content
- `subject` and `status` are normalized to lowercase for filtering
- `teacher_id` is applied as a filter, mainly useful for principals
- If no rows match, returns `200` with an empty `data` array
- `limit` is capped at `100`

## 4. Principal Review APIs

### `GET /api/content/pending`

Lists only pending content.

Access:

- `principal` only

Success response:

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 0,
    "total_pages": 1
  }
}
```

Edge cases:

- Teachers receive `403`
- Empty queue returns `200` with an empty list

### `PATCH /api/content/:id/approve`

Approves pending content.

Access:

- `principal` only

Success response:

```json
{
  "success": true,
  "message": "Content approved successfully",
  "data": {
    "id": 10,
    "status": "approved",
    "approved_by": 1,
    "approved_at": "2026-04-28T10:30:00.000Z"
  }
}
```

Edge cases:

- Content not found returns `404`
- Rejected content cannot be approved directly; returns `409` with `Rejected content cannot be approved directly`
- Approving already approved content is idempotent and returns the existing content record
- Approval clears any prior rejection reason

### `PATCH /api/content/:id/reject`

Rejects content and stores a reason.

Access:

- `principal` only

Request body:

```json
{
  "rejection_reason": "Image is blurry and unreadable."
}
```

Success response:

```json
{
  "success": true,
  "message": "Content rejected successfully",
  "data": {
    "id": 10,
    "status": "rejected",
    "rejection_reason": "Image is blurry and unreadable."
  }
}
```

Edge cases:

- `rejection_reason` is required; otherwise `400`
- Content not found returns `404`
- Approved content cannot be rejected directly; returns `409` with:

```text
Approved content cannot be rejected directly. Update the schedule or create a new revision instead.
```

- Rejecting a pending or already rejected item updates it to `rejected`
- Rejection clears `approved_by` and `approved_at`

## 5. Public Live Content API

### `GET /api/content/live/:teacherId`

Returns the currently active content per subject for a given teacher.

Access:

- public

Optional query:

- `subject`

Examples:

```http
GET /api/content/live/2
GET /api/content/live/2?subject=maths
```

Success response:

```json
{
  "success": true,
  "data": [
    {
      "subject": "maths",
      "content": {
        "id": 10,
        "title": "Math Practice Set",
        "status": "approved",
        "rotation_order": 1,
        "duration_minutes": 5
      }
    }
  ]
}
```

Edge cases:

- Invalid `teacherId` such as `0`, negative values, or non-integers returns:

```json
{
  "success": true,
  "data": [],
  "message": "No content available"
}
```

- The endpoint is rate limited
  - window: `PUBLIC_RATE_LIMIT_WINDOW_MS`, default `60000`
  - max requests: `PUBLIC_RATE_LIMIT_MAX`, default `60`
- Only `approved` content is considered
- Content without both `start_time` and `end_time` is ignored
- Content outside its active time window is ignored
- Content without a valid positive `duration_minutes` is ignored
- Rotation happens independently per subject
- If `subject` is omitted, the API returns one active item per subject
- If `subject` is provided, the API returns either:
  - one active item in `data`
  - or an empty `data` array
- If no content is eligible, returns `200` with empty `data`
- Rotation anchor for a subject is the earliest active `start_time` among eligible content
- Rotation loops continuously using modulo math when elapsed time exceeds a full cycle

## 6. Content Object Reference

Typical content object fields:

```json
{
  "id": 10,
  "title": "Math Practice Set",
  "description": "Chapter 5 worksheet",
  "subject": "maths",
  "file_url": "http://localhost:3000/uploads/1777300000000-file.png",
  "file_path": "/absolute/path/to/uploads/1777300000000-file.png",
  "file_type": "image/png",
  "file_size": 102400,
  "uploaded_by": 2,
  "status": "pending",
  "rejection_reason": null,
  "approved_by": null,
  "approved_at": null,
  "start_time": "2026-04-27T09:00:00.000Z",
  "end_time": "2026-04-27T11:00:00.000Z",
  "created_at": "2026-04-28T10:30:00.000Z",
  "updated_at": "2026-04-28T10:30:00.000Z",
  "rotation_order": 1,
  "duration_minutes": 5
}
```

## 7. Important Business Rules

- Registration is open for both roles
- Uploaded content is immediately stored as `pending`
- Approval is required before content can appear in the public live API
- Scheduling alone does not make content live
- A live item must be:
  - approved
  - inside its start and end window
  - scheduled with a positive duration
- Subject names are normalized to lowercase
- Public files are served from:

```text
/uploads/:filename
```

## 8. Suggested Test Cases

### Auth

- Register teacher
- Register principal
- Register duplicate email
- Login with wrong password
- Call `/me` with expired token

### Upload and scheduling

- Upload valid PNG with no schedule
- Upload valid PNG with full schedule
- Upload with only `start_time`
- Upload with `end_time` before `start_time`
- Upload with invalid `rotation_duration_minutes`
- Upload non-image file
- Upload file larger than configured max size
- Teacher schedules their own content
- Teacher tries to schedule another teacher’s content

### Review

- Principal approves pending content
- Principal rejects pending content
- Principal rejects without `rejection_reason`
- Principal tries to approve rejected content
- Principal tries to reject approved content

### Public live API

- Valid teacher with one active approved item
- Valid teacher with multiple subject rotations
- Valid teacher with no approved items
- Invalid teacher ID
- Subject filter with no match
- Content outside active time window
