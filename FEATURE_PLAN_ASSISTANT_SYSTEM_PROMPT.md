# Feature Plan: Edit Assistant System Prompts

## Overview
Allow tenants to edit assistant system prompts directly from the Assistants tab. When saved, the changes should update both the local database and the actual VAPI assistant via their API.

## Current State Analysis

### Database Schema
- `Assistant` model exists with: `id`, `tenantId`, `name`, `description`, `isActive`, `createdAt`, `updatedAt`
- **Missing**: 
  - `systemPrompt` field to store the system prompt locally
  - `firstMessage` field to store the first message locally

### Current API Endpoints
- `GET /api/assistants` - Lists assistants for tenant
- `POST /api/assistants/sync` - Syncs assistants from VAPI (doesn't fetch system prompts)
- **Missing**: 
  - `GET /api/assistants/[id]` - Get single assistant details including system prompt
  - `PATCH /api/assistants/[id]` - Update assistant system prompt

### Current UI
- `AssistantsList` component displays assistants in cards
- Shows: name, description, active status, ID
- **Missing**: Edit functionality, system prompt display/editing

### VAPI API Integration
- Currently using: `GET /assistant` to list assistants
- Need to use:
  - `GET /assistant/{id}` to fetch full assistant details (including system prompt)
  - `PATCH /assistant/{id}` to update assistant (including system prompt)

## Implementation Plan

### Phase 1: Database Schema Update
1. **Add `systemPrompt` and `firstMessage` fields to Assistant model**
   - File: `prisma/schema.prisma`
   - Add: 
     - `systemPrompt String? @map("system_prompt")`
     - `firstMessage String? @map("first_message")`
   - Create migration: `prisma migrate dev --name add_system_prompt_and_first_message_to_assistant`

### Phase 2: Backend API Endpoints

#### 2.1 Get Assistant Details Endpoint
- **Route**: `GET /api/assistants/[id]`
- **File**: `app/api/assistants/[id]/route.ts` (new)
- **Functionality**:
  - Authenticate tenant user
  - Fetch assistant from database
  - If systemPrompt is null, fetch from VAPI API (`GET /assistant/{id}`)
  - Return assistant details including systemPrompt
- **Response**:
  ```json
  {
    "assistant": {
      "id": "string",
      "name": "string",
      "description": "string | null",
      "isActive": boolean,
      "systemPrompt": "string | null",
      "firstMessage": "string | null"
    }
  }
  ```

#### 2.2 Update Assistant System Prompt Endpoint
- **Route**: `PATCH /api/assistants/[id]`
- **File**: `app/api/assistants/[id]/route.ts` (same file as above)
- **Functionality**:
  - Authenticate tenant user
  - Validate tenant owns the assistant
  - Get tenant's VAPI config
  - Update VAPI assistant via `PATCH /assistant/{id}` with new system prompt
  - Update local database with new system prompt
  - Return updated assistant
- **Request Body**:
  ```json
  {
    "systemPrompt": "string",
    "firstMessage": "string"
  }
  ```
- **Response**: Updated assistant object

#### 2.3 Helper Function for VAPI Assistant Operations
- **File**: `lib/vapi.ts` (add new functions)
- **Functions**:
  - `getVAPIAssistant(assistantId: string, tenantId: string)` - Fetch assistant from VAPI
  - `updateVAPIAssistant(assistantId: string, tenantId: string, updates: { systemPrompt?: string, firstMessage?: string })` - Update assistant in VAPI

### Phase 3: UI Components

#### 3.1 Edit Assistant Dialog Component
- **File**: `components/assistants/edit-assistant-dialog.tsx` (new)
- **Features**:
  - Modal dialog with two textareas:
    - System Prompt textarea
    - First Message textarea
  - Character count for each field (optional)
  - Loading state while fetching/saving
  - Save and Cancel buttons
  - Error handling and success toast notifications
  - Labels and descriptions for each field
- **Props**:
  ```typescript
  interface EditAssistantDialogProps {
    assistantId: string
    assistantName: string
    open: boolean
    onClose: () => void
    onSaved: () => void
  }
  ```

#### 3.2 Update AssistantsList Component
- **File**: `components/assistants/assistants-list.tsx`
- **Changes**:
  - Add "Edit" button to each assistant card
  - Integrate `EditAssistantDialog` component
  - Add state for managing dialog open/close
  - Refresh list after successful save

### Phase 4: VAPI API Integration Details

#### 4.1 Fetching Assistant Details
- **Endpoint**: `GET {baseUrl}/assistant/{assistantId}`
- **Headers**: 
  - `Authorization: Bearer {privateKey}`
  - `Content-Type: application/json`
- **Response**: Assistant object with `model.messages` array containing system prompt
- **Note**: 
  - System prompt is typically in `model.messages[0].content` where `role === "system"`
  - First message is typically in `firstMessage` field at the root level of the assistant object

#### 4.2 Updating Assistant System Prompt
- **Endpoint**: `PATCH {baseUrl}/assistant/{assistantId}`
- **Headers**: Same as above
- **Body**:
  ```json
  {
    "firstMessage": "{newFirstMessage}",
    "model": {
      "messages": [
        {
          "role": "system",
          "content": "{newSystemPrompt}"
        }
      ]
    }
  }
  ```
- **Note**: 
  - May need to preserve other model settings (provider, temperature, etc.)
  - Need to preserve existing messages array structure if updating only one field

### Phase 5: Error Handling & Edge Cases

1. **VAPI API Errors**:
   - Handle 404 (assistant not found)
   - Handle 401/403 (unauthorized)
   - Handle network errors
   - Show user-friendly error messages

2. **Data Consistency**:
   - If VAPI update succeeds but DB update fails, log error and show warning
   - Consider retry logic for failed VAPI updates
   - Sync system prompt from VAPI if DB is out of sync

3. **Empty/Null System Prompts**:
   - Handle cases where assistant doesn't have a system prompt yet
   - Allow users to add a system prompt if it doesn't exist

4. **Large Prompts**:
   - Consider character limits (VAPI may have limits)
   - Show character count in UI
   - Handle truncation if needed

## File Structure

```
app/
  api/
    assistants/
      [id]/
        route.ts          # NEW: GET and PATCH endpoints
components/
  assistants/
    assistants-list.tsx      # UPDATE: Add edit button
    edit-assistant-dialog.tsx # NEW: Edit dialog component
lib/
  vapi.ts                 # UPDATE: Add assistant fetch/update functions
prisma/
  schema.prisma           # UPDATE: Add systemPrompt field
  migrations/
    YYYYMMDDHHMMSS_add_system_prompt_to_assistant/
      migration.sql       # NEW: Migration file
```

## Testing Checklist

- [ ] Database migration runs successfully
- [ ] Can fetch assistant details including system prompt
- [ ] Can update system prompt in VAPI
- [ ] Can update system prompt in local database
- [ ] UI shows edit button on assistant cards
- [ ] Edit dialog opens with current system prompt
- [ ] Can save changes successfully
- [ ] Changes reflect in VAPI assistant
- [ ] Changes persist after page refresh
- [ ] Error handling works for API failures
- [ ] Tenant isolation works (can't edit other tenant's assistants)

## Implementation Order

1. Database schema update (Phase 1)
2. VAPI helper functions (Phase 2.3)
3. API endpoints (Phase 2.1, 2.2)
4. UI dialog component (Phase 3.1)
5. Update AssistantsList (Phase 3.2)
6. Testing and error handling (Phase 5)

## Notes

- VAPI API documentation should be referenced for exact request/response formats
- System prompt location in VAPI response may vary - need to handle different structures
- Consider adding a "Sync from VAPI" option to refresh system prompt if it's been changed externally
- May want to add version history or audit logging for system prompt changes

