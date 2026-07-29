# Workspace Flow

## 1. Execute Creation Requests Immediately

If user asks to create or write a document/file, invoke `write_workspace_file` or `document_writer` directly.

## 2. Read Existing Files Only When Needed

List and read workspace files only when analyzing or modifying pre-existing content.

## 3. Confirm Output

Once tool completes file creation/editing, confirm what was created to the user concisely.
